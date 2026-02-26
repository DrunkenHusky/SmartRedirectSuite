import {
    extractPath,
    generateNewUrl,
    extractSearchTerm,
    applySearchAndReplaceSingle,
    appendQueryString,
    getKeptQueryStringWithLog,
    getStaticQueryStringWithLog,
    type AppliedGlobalRule
} from "./url-utils";
import type { GeneralSettings } from "./schema";

export interface UrlTraceStep {
    description: string;
    urlBefore: string;
    urlAfter: string;
    changed: boolean;
    type: 'rule' | 'global' | 'cleanup' | 'final';
    detailedDiff?: any;
}

export type { AppliedGlobalRule };

export interface UrlTraceResult {
    originalUrl: string;
    finalUrl: string;
    steps: UrlTraceStep[];
    appliedGlobalRules: AppliedGlobalRule[];
    searchFallback?: string;
}

export function traceUrlGeneration(
  oldUrl: string,
  rule: any,
  newDomain?: string,
  generalSettings?: GeneralSettings
): UrlTraceResult {
  const trace: UrlTraceStep[] = [];
  const appliedGlobalRules: AppliedGlobalRule[] = [];
  let currentUrl = oldUrl;

  try {
    const redirectType = rule.redirectType || 'partial';
    const oldPath = extractPath(oldUrl);

    // Check for auto-redirect in rule
    // (This logic is usually outside trace, but could be noted)

    // Ensure we have a valid domain to target
    const cleanDomain = (newDomain || 'https://thisisthenewurl.com/').replace(/\/$/, '');

    if (redirectType === 'partial') {
      // Logic for Partial Match
      let paramsDiscarded = false;
      let workingOldPath = oldPath;

      if (rule.discardQueryParams) {
           if (workingOldPath.includes('?')) {
               paramsDiscarded = true;
               const queryIndex = workingOldPath.indexOf('?');
               const hashIndex = workingOldPath.indexOf('#');
               if (hashIndex !== -1 && hashIndex > queryIndex) {
                    workingOldPath = workingOldPath.substring(0, queryIndex) + workingOldPath.substring(hashIndex);
               } else {
                    workingOldPath = workingOldPath.substring(0, queryIndex);
               }
           }
      }

      const isDomainMatcher = !rule.matcher.startsWith('/');
      let nextUrl = '';

      if (isDomainMatcher) {
         let targetBase = cleanDomain;
         const targetUrl = rule.targetUrl || '';
         let targetPath = targetUrl.replace(/\/$/, '');

         if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
             targetBase = targetPath;
         } else {
             targetBase = cleanDomain + (targetPath.startsWith('/') ? targetPath : '/' + targetPath);
         }

         const normalizedOldPath = workingOldPath.startsWith('/') ? workingOldPath : '/' + workingOldPath;
         nextUrl = targetBase + normalizedOldPath;
      } else {
        const cleanMatcher = rule.matcher.replace(/\/$/, '');
        const cleanTarget = rule.targetUrl.replace(/^\/|\/$/g, '');

        // Decode both sides for comparison to avoid percent-encoding case mismatches.
        // The schema lowercases hex digits (%2F -> %2f) but URL() normalizes to uppercase (%2f -> %2F).
        // Decoding both sides ensures consistent comparison regardless of encoding case.
        let decodedOldPath: string;
        let decodedMatcher: string;

        try {
          decodedOldPath = decodeURIComponent(workingOldPath);
        } catch {
          decodedOldPath = workingOldPath;
        }

        try {
          decodedMatcher = decodeURIComponent(cleanMatcher);
        } catch {
          decodedMatcher = cleanMatcher;
        }

        let newPath;
        if (decodedOldPath.toLowerCase().startsWith(decodedMatcher.toLowerCase())) {
          const remainingDecoded = decodedOldPath.substring(decodedMatcher.length);
          newPath = '/' + cleanTarget + remainingDecoded;
        } else {
          const matcherIndex = decodedOldPath.toLowerCase().indexOf(decodedMatcher.toLowerCase());
          if (matcherIndex !== -1) {
            const beforeMatch = decodedOldPath.substring(0, matcherIndex);
            const afterMatch = decodedOldPath.substring(matcherIndex + decodedMatcher.length);
            newPath = beforeMatch + '/' + cleanTarget + afterMatch;
          } else {
            newPath = '/' + cleanTarget;
          }
        }
        nextUrl = cleanDomain + newPath;
      }


      trace.push({
          description: "Applied Partial/Path Rule" + (paramsDiscarded ? " (Query Params Discarded)" : ""),
          urlBefore: currentUrl,
          urlAfter: nextUrl,
          changed: currentUrl !== nextUrl,
          type: 'rule'
      });
      currentUrl = nextUrl;

    } else if (redirectType === 'wildcard') {
      // Logic for Wildcard Match
      let nextUrl = '';
      const cleanMatcher = rule.matcher.replace(/\*$/, '');
      const rawTarget = rule.targetUrl || '';

      let workingOldPath = oldPath;

      // Handle query params discarding for wildcard
      if (rule.discardQueryParams) {
           if (workingOldPath.includes('?')) {
               const queryIndex = workingOldPath.indexOf('?');
               const hashIndex = workingOldPath.indexOf('#');
               if (hashIndex !== -1 && hashIndex > queryIndex) {
                    workingOldPath = workingOldPath.substring(0, queryIndex) + workingOldPath.substring(hashIndex);
               } else {
                    workingOldPath = workingOldPath.substring(0, queryIndex);
               }
           }
      }

      // Check if it's a domain wildcard or path wildcard
      const isDomainMatcher = !rule.matcher.startsWith('/');

      if (isDomainMatcher) {
          // Fall back to domain replacement for domain wildcard for now
          const targetDomain = rule.targetUrl || cleanDomain;
          nextUrl = generateNewUrl(oldUrl, targetDomain);
      } else {

          let decodedOldPathWild: string;
          let decodedMatcherWild: string;
          try {
            decodedOldPathWild = decodeURIComponent(workingOldPath);
          } catch {
            decodedOldPathWild = workingOldPath;
          }
          try {
            decodedMatcherWild = decodeURIComponent(cleanMatcher);
          } catch {
            decodedMatcherWild = cleanMatcher;
          }


          // Compare decoded strings instead of raw encoded strings
          if (decodedOldPathWild.toLowerCase().startsWith(decodedMatcherWild.toLowerCase())) {
              const suffix = decodedOldPathWild.substring(decodedMatcherWild.length);

              let targetBase = rawTarget;

              // Smart slash handling: if matcher implies directory wildcard, ensure target has trailing slash
              if (cleanMatcher.endsWith('/') && !targetBase.endsWith('/')) {
                  targetBase += '/';
              }

              // Ensure targetBase has leading slash if it's a relative path (not http/s) AND not empty
              if (!targetBase.startsWith('http') && !targetBase.startsWith('/') && targetBase.length > 0) {
                   targetBase = '/' + targetBase;
              }

              if (targetBase.startsWith('http')) {
                  nextUrl = targetBase + suffix;
              } else {
                  // Standard path concatenation
                  nextUrl = cleanDomain + targetBase + suffix;
              }
          } else {
              // Fallback
              nextUrl = cleanDomain + workingOldPath;
          }
      }

      trace.push({
          description: "Applied Wildcard Rule",
          urlBefore: currentUrl,
          urlAfter: nextUrl,
          changed: currentUrl !== nextUrl,
          type: 'rule'
      });
      currentUrl = nextUrl;

    } else if (redirectType === 'domain') {
      // Logic for Domain Replacement
      const targetDomain = rule.targetUrl || cleanDomain;
      const nextUrl = generateNewUrl(oldUrl, targetDomain);

      trace.push({
          description: "Applied Domain Replacement Rule",
          urlBefore: currentUrl,
          urlAfter: nextUrl,
          changed: currentUrl !== nextUrl,
          type: 'rule'
      });
      currentUrl = nextUrl;

    } else {
        let fallbackUrl = currentUrl;

        if (generalSettings?.defaultRedirectMode === "search") {
             // Smart Search Logic
             try {
                 const { searchTerm, searchUrl, skipEncoding } = extractSearchTerm(oldUrl, generalSettings.smartSearchRules, generalSettings.smartSearchRegex);
                 const targetSearchUrl = searchUrl || generalSettings.defaultSearchUrl;

                 if (searchTerm && targetSearchUrl) {
                     const shouldUseSkipEncoding = skipEncoding !== undefined ? skipEncoding : generalSettings.defaultSearchSkipEncoding;
                     const finalSearchTerm = shouldUseSkipEncoding ? searchTerm : encodeURIComponent(searchTerm);
                     fallbackUrl = targetSearchUrl + finalSearchTerm;

                     trace.push({
                        description: `Smart Search Fallback: "${searchTerm}"`,
                        urlBefore: currentUrl,
                        urlAfter: fallbackUrl,
                        changed: true,
                        type: 'rule'
                     });

                     // We don't apply global rules to search results usually, but logic allows it.
                     // Returning here to match logic in MigrationPage which stops at search result
                     return { originalUrl: oldUrl, finalUrl: fallbackUrl, steps: trace, appliedGlobalRules: [], searchFallback: fallbackUrl };
                 }
             } catch (e) {
                 trace.push({ description: "Smart Search Error", urlBefore: currentUrl, urlAfter: currentUrl, changed: false, type: 'rule' });
             }
        }

        // Domain Fallback
        const fallback = generateNewUrl(oldUrl, newDomain);
        trace.push({
            description: "Fallback Generation (Default Redirect)",
            urlBefore: currentUrl,
            urlAfter: fallback,
            changed: currentUrl !== fallback,
            type: 'rule'
        });

        // Update currentUrl for global rules application
        currentUrl = fallback;
    }

    let effectiveSearchReplace: any[] = [];

    if (generalSettings?.globalSearchAndReplace) {
        effectiveSearchReplace = generalSettings.globalSearchAndReplace.filter((g: any) => {
            return !(rule.searchAndReplace || []).some((r: any) => r.search === g.search);
        });
    }

    if (rule.searchAndReplace) {
        effectiveSearchReplace = [...effectiveSearchReplace, ...rule.searchAndReplace || []];
    }

    for (const item of effectiveSearchReplace) {
        const result = applySearchAndReplaceSingle(currentUrl, item);
        if (result !== currentUrl) {
            const isGlobal = !!item.id;

            trace.push({
                description: `Search & Replace: "${item.search}" -> "${item.replace || ''}"`,
                urlBefore: currentUrl,
                urlAfter: result,
                changed: true,
                type: isGlobal ? 'global' : 'rule'
            });

            if (isGlobal) {
                appliedGlobalRules.push({
                    id: item.id,
                    type: 'search',
                    description: `S&R: "${item.search}" -> "${item.replace || ''}"`
                });
            }
            currentUrl = result;
        }
    }

    if (redirectType === 'wildcard') {
        if (rule.forwardQueryParams) {
             try {
                const oldUrlObj = new URL(oldUrl);
                if (oldUrlObj.search) {
                    const beforeAppend = currentUrl;
                    currentUrl = appendQueryString(currentUrl, oldUrlObj.search);
                    if (currentUrl !== beforeAppend) {
                        trace.push({
                            description: "Forwarded Query Parameters (Wildcard)",
                            urlBefore: beforeAppend,
                            urlAfter: currentUrl,
                            changed: true,
                            type: 'rule'
                        });
                    }
                }
             } catch(e) {}
        } else if (rule.discardQueryParams) {
             let effectiveKeptParams: any[] = rule.keptQueryParams || [];

             if (generalSettings?.globalKeptQueryParams) {
                 effectiveKeptParams = [...effectiveKeptParams, ...generalSettings.globalKeptQueryParams || []];
             }

             if (effectiveKeptParams.length > 0) {
                 const { queryString, matchedRules } = getKeptQueryStringWithLog(oldUrl, effectiveKeptParams);
                 const beforeAppend = currentUrl;
                 currentUrl = appendQueryString(currentUrl, queryString);
                 if (matchedRules && Array.isArray(matchedRules)) appliedGlobalRules.push(...matchedRules);

                 if (currentUrl !== beforeAppend) {
                     trace.push({
                        description: "Restored Kept Query Parameters",
                        urlBefore: beforeAppend,
                        urlAfter: currentUrl,
                        changed: true,
                        type: 'rule'
                     });
                 }
             }
        }
    } else {
        if (rule.discardQueryParams) {
             let effectiveKeptParams: any[] = rule.keptQueryParams || [];
             if (generalSettings?.globalKeptQueryParams) {
                 effectiveKeptParams = [...effectiveKeptParams, ...generalSettings.globalKeptQueryParams || []];
             }

             if (effectiveKeptParams.length > 0) {
                 const { queryString, matchedRules } = getKeptQueryStringWithLog(oldUrl, effectiveKeptParams);
                 const beforeAppend = currentUrl;
                 currentUrl = appendQueryString(currentUrl, queryString);
                 if (matchedRules && Array.isArray(matchedRules)) appliedGlobalRules.push(...matchedRules);

                 if (currentUrl !== beforeAppend) {
                     trace.push({
                        description: "Restored Kept Query Parameters",
                        urlBefore: beforeAppend,
                        urlAfter: currentUrl,
                        changed: true,
                        type: 'rule'
                     });
                 }
             }
        }
    }

    let effectiveStaticParams: any[] = [];

    if (generalSettings?.globalStaticQueryParams) {
        effectiveStaticParams = generalSettings.globalStaticQueryParams.filter((g: any) => {
            return !(rule.staticQueryParams || []).some((r: any) => r.key === g.key);
        });
    }

    if (rule.staticQueryParams) {
        effectiveStaticParams = [...effectiveStaticParams, ...rule.staticQueryParams || []];
    }

    if (effectiveStaticParams.length > 0) {
      const { queryString, matchedRules } = getStaticQueryStringWithLog(effectiveStaticParams);
      const beforeAppend = currentUrl;
      currentUrl = appendQueryString(currentUrl, queryString);
      if (matchedRules && Array.isArray(matchedRules)) appliedGlobalRules.push(...matchedRules);

      if (currentUrl !== beforeAppend) {
         trace.push({
            description: "Appended Static Query Parameters",
            urlBefore: beforeAppend,
            urlAfter: currentUrl,
            changed: true,
            type: 'global'
         });
      }
    }

    return {
        originalUrl: oldUrl,
        finalUrl: currentUrl,
        steps: trace,
        appliedGlobalRules
    };
  } catch (error) {
    console.error('URL generation trace error:', error);
    return {
        originalUrl: oldUrl,
        finalUrl: generateNewUrl(oldUrl, newDomain),
        steps: [],
        appliedGlobalRules: []
    };
  }
}

export function generateUrlWithRule(
  oldUrl: string,
  rule: any,
  newDomain?: string,
  generalSettings?: GeneralSettings
): { url: string; appliedGlobalRules: AppliedGlobalRule[]; searchFallback?: string } {
    const trace = traceUrlGeneration(oldUrl, rule, newDomain, generalSettings);
    return {
        url: trace.finalUrl,
        appliedGlobalRules: trace.appliedGlobalRules,
        searchFallback: trace.searchFallback
    };
}
