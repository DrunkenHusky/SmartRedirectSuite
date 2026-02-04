/**
 * URL-Hilfsfunktionen für die Migration
 */

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
    url = url.replace(/([^:]\/)\/+/g, '$1');
    
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

function applySearchAndReplace(url: string, replacements: { search: string; replace: string; caseSensitive: boolean }[]): string {
  let result = url;
  if (!replacements || replacements.length === 0) return result;

  for (const item of replacements) {
    if (!item.search) continue;

    try {
        const replaceValue = item.replace || ""; // Empty string for deletion
        if (item.caseSensitive) {
            // Global replacement, case sensitive
            // Using RegExp with 'g' flag for global replacement
            // Escape special characters in search string to treat it as literal
            const escapedSearch = item.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedSearch, 'g');
            result = result.replace(regex, replaceValue);
        } else {
            // Case insensitive requires Regex with 'gi'
            const escapedSearch = item.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedSearch, 'gi');
            result = result.replace(regex, replaceValue);
        }
    } catch (e) {
        console.error("Error in Search and Replace:", e);
    }
  }
  return result;
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
  newDomain?: string
): string {
  try {
    const redirectType = rule.redirectType || 'partial';
    let finalUrl = '';

    // --- 1. Determine Base Target URL ---
    
    if (redirectType === 'wildcard' && rule.targetUrl) {
      // Vollständig: Replace entire URL with target URL
      finalUrl = rule.targetUrl;
    } else if (redirectType === 'domain') {
      // Domain Replacement: Keep the path exactly as is, just swap the domain

      let targetDomain = newDomain || 'https://thisisthenewurl.com/';

      if (rule.targetUrl && (rule.targetUrl.startsWith('http://') || rule.targetUrl.startsWith('https://'))) {
        try {
          const targetUrlObj = new URL(rule.targetUrl);
          targetDomain = targetUrlObj.origin;
        } catch (e) {
          // If invalid URL, fall back to default logic or keep current targetDomain
        }
      } else if (rule.targetUrl && !rule.targetUrl.startsWith('/')) {
         targetDomain = rule.targetUrl;
         if (!targetDomain.startsWith('http')) {
             targetDomain = 'https://' + targetDomain;
         }
      }

      const cleanDomain = targetDomain.replace(/\/$/, '');
      let path = extractPath(oldUrl);

      // Handle discardQueryParams for domain rules (strip from base path)
      if (rule.discardQueryParams) {
         try {
             const [pathPart] = path.split('?');
             // Preserve hash if present? Usually discardQueryParams means discard query string.
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
         } catch (e) {
             // fallback
         }
      }

      const cleanPath = path.startsWith('/') ? path : '/' + path;
      finalUrl = cleanDomain + cleanPath;

    } else if (redirectType === 'partial' && rule.targetUrl) {
      // Teilweise: Replace path segments from matcher onwards
      const baseDomain = newDomain || 'https://thisisthenewurl.com/';
      const cleanDomain = baseDomain.replace(/\/$/, '');
      
      let oldPath = extractPath(oldUrl);

       // Handle discardQueryParams for partial rules (strip from base path)
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
        // Standard Path Matcher Logic
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
      return generateNewUrl(oldUrl, newDomain);
    }

    // --- 2. Apply Search & Replace ---
    if (rule.searchAndReplace && rule.searchAndReplace.length > 0) {
        finalUrl = applySearchAndReplace(finalUrl, rule.searchAndReplace);
    }

    // --- 3. Handle Query Parameters ---

    // Logic:
    // a) Kept/Forwarded Params (Source)
    // b) Static Params (Target) - Appended last as per requirement

    if (redirectType === 'wildcard') {
        if (rule.forwardQueryParams) {
             // Append all params from oldUrl
             try {
                const oldUrlObj = new URL(oldUrl);
                if (oldUrlObj.search) {
                    finalUrl = appendQueryString(finalUrl, oldUrlObj.search);
                }
             } catch(e) {}
        } else if (rule.discardQueryParams && rule.keptQueryParams && rule.keptQueryParams.length > 0) {
             // Append explicitly kept params
             const keptString = getKeptQueryString(oldUrl, rule.keptQueryParams);
             finalUrl = appendQueryString(finalUrl, keptString);
        }
    } else {
        // Partial / Domain
        // If discardQueryParams was ON, we stripped them from base path above.
        // So we only need to add back 'kept' ones.
        // If discardQueryParams was OFF, they are still in 'path' -> 'finalUrl'.

        if (rule.discardQueryParams && rule.keptQueryParams && rule.keptQueryParams.length > 0) {
            const keptString = getKeptQueryString(oldUrl, rule.keptQueryParams);
            finalUrl = appendQueryString(finalUrl, keptString);
        }
    }

    // Append Static Params (Always, and Last)
    if (rule.staticQueryParams && rule.staticQueryParams.length > 0) {
      const staticString = getStaticQueryString(rule.staticQueryParams);
      finalUrl = appendQueryString(finalUrl, staticString);
    }

    return finalUrl;
  } catch (error) {
    console.error('URL generation with rule error:', error);
    return generateNewUrl(oldUrl, newDomain);
  }
}

export function extractPath(url: string): string {
  try {
    const urlObj = new URL(url, 'http://dummy.com');
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    // Fallback für invalide URLs
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
    // Fallback für nicht-sichere Kontexte
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
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(s => s && s.trim().length > 0);
      return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : null;
  } catch (e) {
      // Fallback for invalid URLs
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

function getStaticQueryString(staticParams: { key: string; value: string; skipEncoding?: boolean }[]): string {
  try {
    // We build the query string manually to support skipEncoding
    const parts: string[] = [];
    staticParams.forEach(p => {
      if (p.key) {
        const key = encodeURIComponent(p.key);
        // If skipEncoding is true, assume p.value is already safe/encoded as desired.
        // Otherwise, use standard encoding.
        const value = p.skipEncoding ? (p.value || '') : encodeURIComponent(p.value || '');
        parts.push(`${key}=${value}`);
      }
    });
    return parts.length > 0 ? '?' + parts.join('&') : '';
  } catch (e) {
    console.error('Error building static query string:', e);
    return '';
  }
}

function getKeptQueryString(oldUrl: string, keptRules: { keyPattern: string; valuePattern?: string; targetKey?: string; skipEncoding?: boolean }[]): string {
  try {
    const urlObj = new URL(oldUrl, 'http://dummy.com'); // Base needed for relative URLs
    const entries = Array.from(urlObj.searchParams.entries());
    // We construct parts manually to support skipEncoding
    const parts: string[] = [];
    const addedIndices = new Set<number>();

    for (const rule of keptRules) {
      if (!rule.keyPattern) continue;
      try {
        const keyRegex = new RegExp(rule.keyPattern);
        const valRegex = rule.valuePattern ? new RegExp(rule.valuePattern) : null;

        entries.forEach(([key, value], index) => {
          if (!addedIndices.has(index)) {
            if (keyRegex.test(key)) {
              if (!valRegex || valRegex.test(value)) {
                // Use targetKey if present and not empty, otherwise use original key
                const finalKey = (rule.targetKey && rule.targetKey.trim() !== '') ? rule.targetKey : key;

                const encodedKey = encodeURIComponent(finalKey);
                // Check if this rule wants to skip encoding for the value
                // NOTE: 'value' from searchParams is ALREADY decoded.
                // If we want to keep "new%20file.pdf" as-is from source "new%20file.pdf",
                // searchParams decodes it to "new file.pdf".
                // If we skip encoding, we put "new file.pdf" -> invalid URL often.
                // But user wants "new%20file.pdf" specifically to avoid "+".
                // If skipEncoding is true, we should try to use `encodeURI` (space to %20) instead of `encodeURIComponent`?
                // Or maybe the user implies they want `encodeURI` behavior (strict percent encoding) vs `URLSearchParams` (application/x-www-form-urlencoded).
                // Let's interpret `skipEncoding` here as "Use strict percent encoding (%20) instead of +" for kept params?
                // OR: Maybe they want raw access?
                // Issue description: "Original Link: .../?file=new%20file.pdf". "Calculated Link: ...?file=new+file.pdf". "Expected: ...?file=new%20file.pdf".
                // Browser `URLSearchParams` encodes space as `+`. `encodeURIComponent` encodes space as `%20`.
                // So if we use manual construction with `encodeURIComponent`, we get `%20`.
                // If `skipEncoding` is FALSE (default), we should probably match standard behavior (or just use encodeURIComponent which is safer for URLs anyway?).
                // Let's see: `URLSearchParams` is standard for query strings.
                // If I use `parts.push(k=v)`, I must encode.
                // If I use `encodeURIComponent(value)`, " " -> "%20".
                // If I use `URLSearchParams`, " " -> "+".
                // User wants "%20". So actually, switching to manual `encodeURIComponent` WITHOUT `skipEncoding` might solve it?
                // But wait, user explicitly asked for "Nicht kodieren" option.
                // If "Nicht kodieren" is checked, we assume value is raw and put it in directly.
                // If NOT checked, we use `encodeURIComponent` (which gives %20).

                const encodedValue = rule.skipEncoding ? value : encodeURIComponent(value);
                parts.push(`${encodedKey}=${encodedValue}`);

                addedIndices.add(index);
              }
            }
          }
        });
      } catch (e) {
        console.error("Invalid regex in keptQueryParams", e);
      }
    }

    return parts.length > 0 ? '?' + parts.join('&') : '';
  } catch (e) {
    return '';
  }
}

function appendQueryString(url: string, queryString: string): string {
  if (!queryString) return url;

  const [base, hash] = url.split('#');
  // queryString includes '?'
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

  // 1. Try Rules
  if (rules && rules.length > 0) {
    // Filter and Sort rules:
    // 1. Filter: Include only rules where pathPattern matches (or is empty)
    // 2. Sort: Prioritize rules WITH a pattern over rules WITHOUT a pattern (to ensure specific regex wins over generic fallback)

    const candidateRules = rules.filter(rule => {
        if (!rule.pathPattern) return true;
        try {
            const path = extractPath(url);
            // Standard prefix matching (case-insensitive)
            // Behaves like 'partial' match in generateUrlWithRule
            return path.toLowerCase().startsWith(rule.pathPattern.toLowerCase());
        } catch (e) {
            console.error("Error matching path pattern:", rule.pathPattern, e);
            return false;
        }
    });

    // Stable sort prioritizing defined patterns
    candidateRules.sort((a, b) => {
        const aHasPattern = !!(a.pattern && a.pattern.trim() !== '');
        const bHasPattern = !!(b.pattern && b.pattern.trim() !== '');

        if (aHasPattern && !bHasPattern) return -1; // a comes first
        if (!aHasPattern && bHasPattern) return 1;  // b comes first
        return 0; // maintain original relative order
    });

    for (const rule of candidateRules) {
      try {
        // Check if pattern is missing or empty -> Use Last Part Logic
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

  // 2. Legacy Regex Fallback
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

  // 3. Fallback to last path segment
  if (!searchTerm) {
    searchTerm = extractLastPathSegment(url);
  }

  return { searchTerm, searchUrl, skipEncoding };
}
