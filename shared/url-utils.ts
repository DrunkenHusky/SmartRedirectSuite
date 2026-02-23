import { z } from "zod";

export interface SmartSearchRule {
  pattern?: string;
  order: number;
  searchUrl?: string | null;
  pathPattern?: string | null;
  skipEncoding?: boolean;
}

export interface AppliedGlobalRule {
  id: string;
  type: 'search' | 'static' | 'kept';
  description: string;
}

export function generateNewUrl(oldUrl: string, newDomain?: string): string {
  try {
    let url = oldUrl;

    // Ensure HTTPS
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = 'https://' + url;
    }

    // Remove double slashes (except after protocol)
    url = url.replace(/([^:]\/)\/+/g, '');

    // Replace host with new domain
    const targetDomain = newDomain || 'https://thisisthenewurl.com/';
    const cleanDomain = targetDomain.replace(/\/$/, ''); // Remove trailing slash
    url = url.replace(/(https?:\/\/)[^\/]+/, cleanDomain);

    return url;
  } catch (error) {
    console.error('URL generation error:', error);
    return oldUrl;
  }
}

export function applySearchAndReplaceSingle(url: string, item: { search: string; replace: string; caseSensitive: boolean }): string {
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

export function appendQueryString(url: string, queryString: string): string {
  if (!queryString) return url;

  const [base, hash] = url.split('#');
  const queryPart = queryString.substring(1);

  if (base.includes('?')) {
    return `${base}&${queryPart}${hash ? '#' + hash : ''}`;
  } else {
    return `${base}?${queryPart}${hash ? '#' + hash : ''}`;
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

export function getStaticQueryStringWithLog(staticParams: { key: string; value: string; skipEncoding?: boolean; id?: string }[]): { queryString: string, matchedRules: AppliedGlobalRule[] } {
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

export function getKeptQueryStringWithLog(oldUrl: string, keptRules: { keyPattern: string; valuePattern?: string; targetKey?: string; skipEncoding?: boolean; id?: string }[]): { queryString: string, matchedRules: AppliedGlobalRule[] } {
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
              let processedValue = value;
              let shouldKeep = true;

              if (valRegex) {
                  const match = valRegex.exec(value);
                  if (match) {
                      if (match.length > 1) {
                          processedValue = match[1];
                      } else {
                          processedValue = match[0];
                      }
                  } else {
                      shouldKeep = false;
                  }
              }

              if (shouldKeep) {
                const finalKey = (rule.targetKey && rule.targetKey.trim() !== '') ? rule.targetKey : key;
                const encodedKey = encodeURIComponent(finalKey);
                const encodedValue = rule.skipEncoding ? processedValue : encodeURIComponent(processedValue);
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

export function getMatchingSuffix(originalPath: string, matcher: string): string | null {
  const cleanMatcher = matcher.replace(/\/$/, '');
  let decodedMatcher = '';
  try {
      decodedMatcher = decodeURIComponent(cleanMatcher).toLowerCase();
  } catch (e) {
      decodedMatcher = cleanMatcher.toLowerCase();
  }

  let currentDecoded = '';
  let i = 0;
  const len = originalPath.length;

  while (i < len) {
      if (currentDecoded === decodedMatcher) {
          return originalPath.substring(i);
      }

      if (currentDecoded.length > decodedMatcher.length) {
           break;
      }

      const char = originalPath[i];
      if (char === '%' && i + 2 < len) {
          const hex = originalPath.substring(i + 1, i + 3);
          if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
              try {
                  const decodedChar = decodeURIComponent('%' + hex);
                  currentDecoded += decodedChar.toLowerCase();
                  i += 3;
                  continue;
              } catch (e) {
                  // fall through
              }
          }
      }

      currentDecoded += char.toLowerCase();
      i++;
  }

  if (currentDecoded === decodedMatcher) {
      return originalPath.substring(i);
  }

  return null;
}
