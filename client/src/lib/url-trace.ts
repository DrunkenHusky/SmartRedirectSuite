import { extractPath, generateNewUrl, extractSearchTerm } from "./url-utils";
import { GeneralSettings } from "@shared/schema";

export interface UrlTraceStep {
    description: string;
    urlBefore: string;
    urlAfter: string;
    changed: boolean;
    type: 'rule' | 'global' | 'cleanup' | 'final';
    detailedDiff?: any;
}

export interface AppliedGlobalRule {
  id: string;
  type: 'search' | 'static' | 'kept';
  description: string;
}

export interface UrlTraceResult {
    originalUrl: string;
    finalUrl: string;
    steps: UrlTraceStep[];
    appliedGlobalRules: AppliedGlobalRule[];
  searchFallback?: string;
}

function extractPath(url: string): string {
  try {
    const urlObj = new URL(url, 'http://dummy.com');
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    const pathMatch = url.match(/^https?:\/\/[^\/]+(\/.*)?$/);
    if (pathMatch) return pathMatch[1] || '/';
    return url.startsWith('/') ? url : '/' + url;
  }
}

function generateNewUrl(oldUrl: string, newDomain?: string): string {
  try {
    let url = oldUrl;
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = 'https://' + url;
    }
    url = url.replace(/([^:]\/)\/+/g, '');
    const targetDomain = newDomain || 'https://thisisthenewurl.com/';
    const cleanDomain = targetDomain.replace(/\/$/, '');
    url = url.replace(/(https?:\/\/)[^\/]+/, cleanDomain);
    return url;
  } catch (error) {
    return oldUrl;
  }
}

function applySearchAndReplaceSingle(url: string, item: { search: string; replace: string; caseSensitive: boolean }): string {
    if (!item.search) return url;
    try {
        const replaceValue = item.replace || "";
        if (item.caseSensitive) {
            const escapedSearch = item.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedSearch, 'g');
            return url.replace(regex, replaceValue);
        } else {
            const escapedSearch = item.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedSearch, 'gi');
            return url.replace(regex, replaceValue);
        }
    } catch (e) {
        return url;
    }
}

function appendQueryString(url: string, queryString: string): string {
  if (!queryString) return url;
  const [base, hash] = url.split('#');
  const queryPart = queryString.substring(1);
  if (base.includes('?')) {
    return `${base}&${queryPart}${hash ? '#' + hash : ''}`;
  } else {
    return `${base}?${queryPart}${hash ? '#' + hash : ''}`;
  }
}

function getStaticQueryStringWithLog(staticParams: { key: string; value: string; skipEncoding?: boolean; id?: string }[]): { queryString: string, matchedRules: AppliedGlobalRule[] } {
  const matchedRules: AppliedGlobalRule[] = [];
  try {
    const parts: string[] = [];
    staticParams.forEach(p => {
      if (p.key) {
        const key = encodeURIComponent(p.key);
        const value = p.skipEncoding ? (p.value || '') : encodeURIComponent(p.value || '');
        parts.push(`${key}=${value}`);

        if (p.id) {
            matchedRules.push({
                id: p.id,
                type: 'static',
                description: `Static: ${p.key}=${p.value}`
            });
        }
      }
    });
    return { queryString: parts.length > 0 ? '?' + parts.join('&') : '', matchedRules };
  } catch (e) {
    return { queryString: '', matchedRules: [] };
  }
}

function getKeptQueryStringWithLog(oldUrl: string, keptRules: { keyPattern: string; valuePattern?: string; targetKey?: string; skipEncoding?: boolean; id?: string }[]): { queryString: string, matchedRules: AppliedGlobalRule[] } {
  const matchedRules: AppliedGlobalRule[] = [];
  try {
    const urlObj = new URL(oldUrl, 'http://dummy.com');
    const entries = Array.from(urlObj.searchParams.entries());
    const parts: string[] = [];
    const addedIndices = new Set<number>();

    for (const rule of keptRules) {
      if (!rule.keyPattern) continue;
      try {
        const keyRegex = new RegExp(rule.keyPattern);
        const valRegex = rule.valuePattern ? new RegExp(rule.valuePattern) : null;
        let ruleMatched = false;

        entries.forEach(([key, value], index) => {
          if (!addedIndices.has(index)) {
            if (keyRegex.test(key)) {
              if (!valRegex || valRegex.test(value)) {
                const finalKey = (rule.targetKey && rule.targetKey.trim() !== '') ? rule.targetKey : key;
                const encodedKey = encodeURIComponent(finalKey);
                const encodedValue = rule.skipEncoding ? value : encodeURIComponent(value);
                parts.push(`${encodedKey}=${encodedValue}`);
                addedIndices.add(index);
                ruleMatched = true;
              }
            }
          }
        });

        if (ruleMatched && rule.id) {
            matchedRules.push({
                id: rule.id,
                type: 'kept',
                description: `Kept: ${rule.keyPattern} ${rule.targetKey ? '-> '+rule.targetKey : ''}`
            });
        }
      } catch (e) {
        // ignore invalid regex
      }
    }

    return { queryString: parts.length > 0 ? '?' + parts.join('&') : '', matchedRules };
  } catch (e) {
    return { queryString: '', matchedRules: [] };
  }
}

export function traceUrlGeneration(
  oldUrl: string,
  rule: {
    matcher: string;
    targetUrl?: string;
    redirectType?: 'wildcard' | 'partial' | 'domain';
    discardQueryParams?: boolean;
    forwardQueryParams?: boolean;
    keptQueryParams?: any[];
    staticQueryParams?: any[];
    searchAndReplace?: any[];
  },
  newDomain?: string,
  generalSettings?: GeneralSettings
): UrlTraceResult {
  const trace: UrlTraceStep[] = [];
  const appliedGlobalRules: AppliedGlobalRule[] = [];

  trace.push({
      description: "Initial URL",
      urlBefore: oldUrl,
      urlAfter: oldUrl,
      changed: false,
      type: 'rule'
  });

  try {
    const redirectType = rule.redirectType || 'partial';
    let currentUrl = oldUrl;
    let nextUrl = '';

    if (redirectType === 'wildcard' && rule.targetUrl) {
      nextUrl = rule.targetUrl;
    } else if (redirectType === 'domain') {
      let targetDomain = newDomain || 'https://thisisthenewurl.com/';

      if (rule.targetUrl && (rule.targetUrl.startsWith('http://') || rule.targetUrl.startsWith('https://'))) {
        try {
          const targetUrlObj = new URL(rule.targetUrl);
          targetDomain = targetUrlObj.origin;
        } catch (e) {}
      } else if (rule.targetUrl && !rule.targetUrl.startsWith('/')) {
         targetDomain = rule.targetUrl;
         if (!targetDomain.startsWith('http')) {
             targetDomain = 'https://' + targetDomain;
         }
      }

      const cleanDomain = targetDomain.replace(/\/$/, '');
      let path = extractPath(oldUrl);

      let paramsDiscarded = false;
      if (rule.discardQueryParams) {
         try {
             const [pathPart] = path.split('?');
             if (path.includes('?')) paramsDiscarded = true;

             if (path.includes('#')) {
                 const hashIndex = path.indexOf('#');
                 const queryIndex = path.indexOf('?');
                 if (queryIndex !== -1 && queryIndex < hashIndex) {
                     path = path.substring(0, queryIndex) + path.substring(hashIndex);
                 } else if (queryIndex !== -1) {
                     path = path.substring(0, queryIndex);
                 }
             } else {
                 path = pathPart;
             }
         } catch (e) {}
      }

      const cleanPath = path.startsWith('/') ? path : '/' + path;
      nextUrl = cleanDomain + cleanPath;

      trace.push({
          description: "Applied Domain Rule" + (paramsDiscarded ? " (Query Params Discarded)" : ""),
          urlBefore: currentUrl,
          urlAfter: nextUrl,
          changed: currentUrl !== nextUrl,
          type: 'rule'
      });
      currentUrl = nextUrl;

    } else if (redirectType === 'partial' && rule.targetUrl) {
      const baseDomain = newDomain || 'https://thisisthenewurl.com/';
      const cleanDomain = baseDomain.replace(/\/$/, '');

      let oldPath = extractPath(oldUrl);

      let paramsDiscarded = false;
      if (rule.discardQueryParams) {
           if (oldPath.includes('?')) {
               paramsDiscarded = true;
               const queryIndex = oldPath.indexOf('?');
               const hashIndex = oldPath.indexOf('#');
               if (hashIndex !== -1 && hashIndex > queryIndex) {
                    oldPath = oldPath.substring(0, queryIndex) + oldPath.substring(hashIndex);
               } else {
                    oldPath = oldPath.substring(0, queryIndex);
               }
           }
      }

      const isDomainMatcher = !rule.matcher.startsWith('/');

      if (isDomainMatcher) {
         let targetBase = cleanDomain;
         const targetUrl = rule.targetUrl || '';
         let targetPath = targetUrl.replace(/\/$/, '');

         if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
             targetBase = targetPath;
         } else {
             targetBase = cleanDomain + (targetPath.startsWith('/') ? targetPath : '/' + targetPath);
         }

         const normalizedOldPath = oldPath.startsWith('/') ? oldPath : '/' + oldPath;
         nextUrl = targetBase + normalizedOldPath;
      } else {
        const cleanMatcher = rule.matcher.replace(/\/$/, '');
        const cleanTarget = rule.targetUrl.replace(/^\/|\/$/g, '');

        let newPath;
        if (oldPath.toLowerCase().startsWith(cleanMatcher.toLowerCase())) {
          const remainingPath = oldPath.substring(cleanMatcher.length);
          newPath = '/' + cleanTarget + remainingPath;
        } else {
          const matcherIndex = oldPath.toLowerCase().indexOf(cleanMatcher.toLowerCase());
          if (matcherIndex !== -1) {
            const beforeMatch = oldPath.substring(0, matcherIndex);
            const afterMatch = oldPath.substring(matcherIndex + cleanMatcher.length);
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

    } else {
        let fallbackUrl = currentUrl;

        if (generalSettings?.defaultRedirectMode === "search") {
             // Smart Search Logic
             try {
                 const { searchTerm, searchUrl, skipEncoding } = extractSearchTerm(oldUrl, generalSettings.smartSearchRules);
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
        effectiveSearchReplace = generalSettings.globalSearchAndReplace.filter(g => {
            return !(rule.searchAndReplace || []).some(r => r.search === g.search);
        });
    }

    if (rule.searchAndReplace) {
        effectiveSearchReplace = [...effectiveSearchReplace, ...rule.searchAndReplace];
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
                 effectiveKeptParams = [...effectiveKeptParams, ...generalSettings.globalKeptQueryParams];
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
                 effectiveKeptParams = [...effectiveKeptParams, ...generalSettings.globalKeptQueryParams];
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
        effectiveStaticParams = generalSettings.globalStaticQueryParams.filter(g => {
            return !(rule.staticQueryParams || []).some(r => r.key === g.key);
        });
    }

    if (rule.staticQueryParams) {
        effectiveStaticParams = [...effectiveStaticParams, ...rule.staticQueryParams];
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
