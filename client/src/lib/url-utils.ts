import { z } from "zod";
import type { GeneralSettings } from "@shared/schema";

/**
 * URL-Hilfsfunktionen für die Migration
 */

export interface AppliedGlobalRule {
  id: string;
  type: 'search' | 'static' | 'kept';
  description: string;
}

export function generateNewUrl(oldUrl: string, newDomain?: string): string {
  try {
    let url = oldUrl;
    
    // Sicherstellen dass HTTPS verwendet wird
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = 'https://' + url;
    }
    
    // Doppelte Slashes entfernen (außer nach Protokoll)
    url = url.replace(/([^:]\/)\/+/g, '');
    
    // Host durch neue Domain ersetzen
    const targetDomain = newDomain || 'https://thisisthenewurl.com/';
    const cleanDomain = targetDomain.replace(/\/$/, ''); // Remove trailing slash
    url = url.replace(/(https?:\/\/)[^\/]+/, cleanDomain);
    
    return url;
  } catch (error) {
    console.error('URL generation error:', error);
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
        console.error("Error in Search and Replace:", e);
        return url;
    }
}

export function generateUrlWithRule(
  oldUrl: string, 
  rule: {
    matcher: string;
    targetUrl?: string;
    redirectType?: 'wildcard' | 'partial' | 'domain';
    discardQueryParams?: boolean;
    forwardQueryParams?: boolean;
    keptQueryParams?: { keyPattern: string; valuePattern?: string; targetKey?: string; skipEncoding?: boolean }[];
    staticQueryParams?: { key: string; value: string; skipEncoding?: boolean }[];
    searchAndReplace?: { search: string; replace: string; caseSensitive: boolean }[];
  },
  newDomain?: string,
  generalSettings?: GeneralSettings
): { url: string; appliedGlobalRules: AppliedGlobalRule[] } {
  const appliedGlobalRules: AppliedGlobalRule[] = [];
  try {
    const redirectType = rule.redirectType || 'partial';
    let finalUrl = '';

    // --- 1. Determine Base Target URL ---
    
    if (redirectType === 'wildcard' && rule.targetUrl) {
      finalUrl = rule.targetUrl;
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

      if (rule.discardQueryParams) {
         try {
             const [pathPart] = path.split('?');
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
      finalUrl = cleanDomain + cleanPath;

    } else if (redirectType === 'partial' && rule.targetUrl) {
      const baseDomain = newDomain || 'https://thisisthenewurl.com/';
      const cleanDomain = baseDomain.replace(/\/$/, '');
      
      let oldPath = extractPath(oldUrl);

      if (rule.discardQueryParams) {
           if (oldPath.includes('?')) {
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
         finalUrl = targetBase + normalizedOldPath;
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
        finalUrl = cleanDomain + newPath;
      }
    } else {
      return { url: generateNewUrl(oldUrl, newDomain), appliedGlobalRules: [] };
    }

    // --- 2. Apply Search & Replace ---

    // Prepare effective search & replace list
    let effectiveSearchReplace: any[] = [];

    // Add global rules first (if not overridden by rule)
    if (generalSettings?.globalSearchAndReplace) {
        effectiveSearchReplace = generalSettings.globalSearchAndReplace.filter(g => {
            // Check if rule overrides this global (same search term)
            return !(rule.searchAndReplace || []).some(r => r.search === g.search);
        });
    }

    // Add rule rules
    if (rule.searchAndReplace) {
        effectiveSearchReplace = [...effectiveSearchReplace, ...rule.searchAndReplace];
    }

    // Apply sequentially
    for (const item of effectiveSearchReplace) {
        const result = applySearchAndReplaceSingle(finalUrl, item);
        if (result !== finalUrl) {
            finalUrl = result;
            if (item.id) {
                appliedGlobalRules.push({
                    id: item.id,
                    type: 'search',
                    description: `S&R: "${item.search}" -> "${item.replace || ''}"`
                });
            }
        }
    }

    // --- 3. Handle Query Parameters ---

    if (redirectType === 'wildcard') {
        if (rule.forwardQueryParams) {
             try {
                const oldUrlObj = new URL(oldUrl);
                if (oldUrlObj.search) {
                    finalUrl = appendQueryString(finalUrl, oldUrlObj.search);
                }
             } catch(e) {}
        } else if (rule.discardQueryParams) {
             // Handle Kept Params (Rule + Global)
             let effectiveKeptParams: any[] = rule.keptQueryParams || [];

             if (generalSettings?.globalKeptQueryParams) {
                 effectiveKeptParams = [...effectiveKeptParams, ...generalSettings.globalKeptQueryParams];
             }

             if (effectiveKeptParams.length > 0) {
                 const { queryString, matchedRules } = getKeptQueryStringWithLog(oldUrl, effectiveKeptParams);
                 finalUrl = appendQueryString(finalUrl, queryString);
                 appliedGlobalRules.push(...matchedRules);
             }
        }
    } else {
        // Partial / Domain
        // If discardQueryParams was ON, we stripped them above.
        // We use kept params to add back specific ones.
        // If discardQueryParams was OFF, params are still there (for Domain/Partial logic depending on implementation).
        // Wait, for Domain/Partial, if discardQueryParams is FALSE, the base path calculation preserved query params.
        // If TRUE, it stripped them.

        if (rule.discardQueryParams) {
             let effectiveKeptParams: any[] = rule.keptQueryParams || [];
             if (generalSettings?.globalKeptQueryParams) {
                 effectiveKeptParams = [...effectiveKeptParams, ...generalSettings.globalKeptQueryParams];
             }

             if (effectiveKeptParams.length > 0) {
                 const { queryString, matchedRules } = getKeptQueryStringWithLog(oldUrl, effectiveKeptParams);
                 finalUrl = appendQueryString(finalUrl, queryString);
                 appliedGlobalRules.push(...matchedRules);
             }
        }
    }

    // Append Static Params (Always, and Last)
    // Prepare effective static params
    let effectiveStaticParams: any[] = [];

    // Add global rules first (if not overridden by rule)
    if (generalSettings?.globalStaticQueryParams) {
        effectiveStaticParams = generalSettings.globalStaticQueryParams.filter(g => {
            return !(rule.staticQueryParams || []).some(r => r.key === g.key);
        });
    }

    // Add rule rules
    if (rule.staticQueryParams) {
        effectiveStaticParams = [...effectiveStaticParams, ...rule.staticQueryParams];
    }

    if (effectiveStaticParams.length > 0) {
      const { queryString, matchedRules } = getStaticQueryStringWithLog(effectiveStaticParams);
      finalUrl = appendQueryString(finalUrl, queryString);
      appliedGlobalRules.push(...matchedRules);
    }

    return { url: finalUrl, appliedGlobalRules };
  } catch (error) {
    console.error('URL generation with rule error:', error);
    return { url: generateNewUrl(oldUrl, newDomain), appliedGlobalRules: [] };
  }
}

export function extractPath(url: string): string {
  try {
    const urlObj = new URL(url, 'http://dummy.com');
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    const pathMatch = url.match(/^https?:\/\/[^\/]+(\/.*)?$/);
    if (pathMatch) return pathMatch[1] || '/';
    return url.startsWith('/') ? url : '/' + url;
  }
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    return new Promise((resolve, reject) => {
      if (document.execCommand('copy')) {
        textArea.remove();
        resolve();
      } else {
        textArea.remove();
        reject(new Error('Copy command failed'));
      }
    });
  }
}

export interface SmartSearchRule {
  pattern?: string;
  order: number;
  searchUrl?: string | null;
  pathPattern?: string | null;
  skipEncoding?: boolean;
}

function extractLastPathSegment(url: string): string | null {
  try {
      const urlObj = new URL(url, 'http://dummy.com');
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(s => s && s.trim().length > 0);
      return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : null;
  } catch (e) {
      try {
        const pathMatch = url.match(/^https?:\/\/[^\/]+(\/.*)?$/);
        const path = pathMatch?.[1] || '/';
        const segments = path.split('/').filter(s => s && s.trim().length > 0);
        return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : null;
      } catch (err) {
        return null;
      }
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
    console.error('Error building static query string:', e);
    return { queryString: '', matchedRules: [] };
  }
}

// Wrapper for backward compatibility if needed, though mostly internal usage
function getStaticQueryString(staticParams: any[]) {
    return getStaticQueryStringWithLog(staticParams).queryString;
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
        console.error("Invalid regex in keptQueryParams", e);
      }
    }

    return { queryString: parts.length > 0 ? '?' + parts.join('&') : '', matchedRules };
  } catch (e) {
    return { queryString: '', matchedRules: [] };
  }
}

// Wrapper
function getKeptQueryString(oldUrl: string, keptRules: any[]) {
    return getKeptQueryStringWithLog(oldUrl, keptRules).queryString;
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

export function extractSearchTerm(
  url: string,
  rules: SmartSearchRule[] = [],
  legacyRegex?: string | null
): { searchTerm: string | null; searchUrl?: string | null; skipEncoding?: boolean } {
  let searchTerm: string | null = null;
  let searchUrl: string | null = null;
  let skipEncoding: boolean | undefined = undefined;

  if (rules && rules.length > 0) {
    const candidateRules = rules.filter(rule => {
        if (!rule.pathPattern) return true;
        try {
            const path = extractPath(url);
            const pattern = rule.pathPattern.toLowerCase();
            const lowerPath = path.toLowerCase();
            if (!lowerPath.startsWith(pattern)) return false;
            if (lowerPath.length === pattern.length) return true;
            const nextChar = lowerPath[pattern.length];
            return ['/', '?', '#'].includes(nextChar);
        } catch (e) {
            console.error("Error matching path pattern:", rule.pathPattern, e);
            return false;
        }
    });

    candidateRules.sort((a, b) => {
        const aHasPattern = !!(a.pattern && a.pattern.trim() !== '');
        const bHasPattern = !!(b.pattern && b.pattern.trim() !== '');
        if (aHasPattern && !bHasPattern) return -1;
        if (!aHasPattern && bHasPattern) return 1;
        return 0;
    });

    for (const rule of candidateRules) {
      try {
        if (!rule.pattern || rule.pattern.trim() === '') {
            const term = extractLastPathSegment(url);
            if (term) {
                searchTerm = term;
                if (rule.searchUrl) {
                    searchUrl = rule.searchUrl;
                }
                skipEncoding = rule.skipEncoding;
                return { searchTerm, searchUrl, skipEncoding };
            }
            continue;
        }

        const regex = new RegExp(rule.pattern);
        const match = regex.exec(url);
        if (match && match[1]) {
          try {
            searchTerm = decodeURIComponent(match[1]);
          } catch {
            searchTerm = match[1];
          }
          if (rule.searchUrl) {
            searchUrl = rule.searchUrl;
          }
          skipEncoding = rule.skipEncoding;
          return { searchTerm, searchUrl, skipEncoding };
        }
      } catch (regexError) {
        console.error("Invalid smart search regex rule:", rule.pattern, regexError);
      }
    }
  }

  if (!searchTerm && legacyRegex) {
    try {
      const regex = new RegExp(legacyRegex);
      const match = regex.exec(url);
      if (match && match[1]) {
        try {
          searchTerm = decodeURIComponent(match[1]);
        } catch {
          searchTerm = match[1];
        }
        return { searchTerm, searchUrl: null, skipEncoding: undefined };
      }
    } catch (regexError) {
      console.error("Invalid smart search regex:", regexError);
    }
  }

  if (!searchTerm) {
    searchTerm = extractLastPathSegment(url);
  }

  return { searchTerm, searchUrl, skipEncoding };
}
