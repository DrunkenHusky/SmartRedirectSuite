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

export function generateUrlWithRule(
  oldUrl: string, 
  rule: {
    matcher: string;
    targetUrl?: string;
    redirectType?: 'wildcard' | 'partial' | 'domain';
    discardQueryParams?: boolean;
    forwardQueryParams?: boolean;
  },
  newDomain?: string
): string {
  try {
    const redirectType = rule.redirectType || 'partial';
    
    if (redirectType === 'wildcard' && rule.targetUrl) {
      // Vollständig: Replace entire URL with target URL
      let finalUrl = rule.targetUrl;

      // If forwardQueryParams is set, append query params from oldUrl
      if (rule.forwardQueryParams) {
        try {
          const oldUrlObj = new URL(oldUrl);
          if (oldUrlObj.search) {
             const targetUrlObj = new URL(finalUrl.startsWith('http') ? finalUrl : 'https://dummy' + finalUrl);
             // If target already has params, merge? Or just append?
             // Logic: Append if params exist, or create new.
             // Simplest approach: Use URL object
             // But finalUrl might be just a path or invalid URL if relative
             if (finalUrl.startsWith('http')) {
                const finalObj = new URL(finalUrl);
                oldUrlObj.searchParams.forEach((val, key) => {
                    finalObj.searchParams.append(key, val);
                });
                finalUrl = finalObj.toString();
             } else {
                 // It's likely a relative URL or opaque string
                 // Just append ?query or &query
                 const hasQuery = finalUrl.includes('?');
                 finalUrl += (hasQuery ? '&' : '?') + oldUrlObj.search.substring(1);
             }
          }
        } catch (e) {
          // Ignore if oldUrl invalid
        }
      }
      return finalUrl;
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

      // Handle discardQueryParams for domain rules
      if (rule.discardQueryParams) {
         try {
             // extractPath returns path+query+hash. We need to strip query.
             // We can reconstruct it.
             // But extractPath is robust.
             // Let's just use URL parsing if possible, or split by ?
             const [pathPart, ...rest] = path.split('?');
             // If hash exists in rest, preserve it? "Remove all link-parameters" usually means query string.
             // User said "remove all link-parameters". Hash is usually client-side but part of link.
             // Let's assume we remove query params (everything after ?) but hash?
             // Usually hash is preserved by browser anyway on redirect if not specified,
             // but here we are generating the target URL string.
             // Let's remove query params only.
             if (path.includes('#')) {
                 const hashIndex = path.indexOf('#');
                 const queryIndex = path.indexOf('?');
                 if (queryIndex !== -1 && queryIndex < hashIndex) {
                     // Query is before hash
                     path = path.substring(0, queryIndex) + path.substring(hashIndex);
                 } else if (queryIndex !== -1) {
                     // Query is after hash (unusual but possible in some frameworks)
                     path = path.substring(0, queryIndex);
                 }
             } else {
                 path = pathPart;
             }
         } catch (e) {
             // fallback
         }
      }

      // Ensure path starts with /
      const cleanPath = path.startsWith('/') ? path : '/' + path;

      return cleanDomain + cleanPath;

    } else if (redirectType === 'partial' && rule.targetUrl) {
      // Teilweise: Replace path segments from matcher onwards, preserve additional segments/params/anchors
      const baseDomain = newDomain || 'https://thisisthenewurl.com/';
      const cleanDomain = baseDomain.replace(/\/$/, '');
      
      // Extract the full path with query params and hash  
      let oldPath = extractPath(oldUrl);

       // Handle discardQueryParams for partial rules
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
      
      // Check if matcher is a domain rule
      const isDomainMatcher = !rule.matcher.startsWith('/');

      if (isDomainMatcher) {
         // If matcher is a domain, handle redirect
         let targetBase = cleanDomain;
         // Ensure targetUrl is treated as a string to prevent null/undefined errors
         const targetUrl = rule.targetUrl || '';
         let targetPath = targetUrl.replace(/\/$/, ''); // Remove trailing slash if present

         // If targetUrl is an absolute URL, use it as the new base
         if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
             // For domain matcher, we essentially just want to swap the domain but potentially append a path prefix
             targetBase = targetPath;
         } else {
             // targetUrl is relative path, append to cleanDomain
             targetBase = cleanDomain + (targetPath.startsWith('/') ? targetPath : '/' + targetPath);
         }

         // oldPath includes initial slash usually.
         // Ensure we don't double slash if targetBase ends with slash (it shouldn't)
         // or oldPath starts with slash.

         const normalizedOldPath = oldPath.startsWith('/') ? oldPath : '/' + oldPath;

         // If targetBase already contains a path, we append oldPath to it
         return targetBase + normalizedOldPath;
      }

      // Standard Path Matcher Logic
      const cleanMatcher = rule.matcher.replace(/\/$/, '');
      const cleanTarget = rule.targetUrl.replace(/^\/|\/$/g, '');
      
      let newPath;
      
      // Check if the path starts with the matcher
      if (oldPath.toLowerCase().startsWith(cleanMatcher.toLowerCase())) {
        // Replace the matching part with target, keep everything after it
        const remainingPath = oldPath.substring(cleanMatcher.length);
        newPath = '/' + cleanTarget + remainingPath;
      } else {
        // Check if matcher appears anywhere in the path
        const matcherIndex = oldPath.toLowerCase().indexOf(cleanMatcher.toLowerCase());
        if (matcherIndex !== -1) {
          const beforeMatch = oldPath.substring(0, matcherIndex);
          const afterMatch = oldPath.substring(matcherIndex + cleanMatcher.length);
          newPath = beforeMatch + '/' + cleanTarget + afterMatch;
        } else {
          // Matcher not found, use target as new path
          newPath = '/' + cleanTarget;
        }
      }
      
      return cleanDomain + newPath;
    } else {
      // No valid rule or no targetUrl - fallback to domain replacement only
      return generateNewUrl(oldUrl, newDomain);
    }
  } catch (error) {
    console.error('URL generation with rule error:', error);
    return generateNewUrl(oldUrl, newDomain);
  }
}

export function extractPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    // Fallback für invalide URLs
    const pathMatch = url.match(/^https?:\/\/[^\/]+(\/.*)?$/);
    return pathMatch?.[1] || '/';
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
      return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch (e) {
      // Fallback for invalid URLs
      const pathMatch = url.match(/^https?:\/\/[^\/]+(\/.*)?$/);
      const path = pathMatch?.[1] || '/';
      const segments = path.split('/').filter(s => s && s.trim().length > 0);
      return segments.length > 0 ? segments[segments.length - 1] : null;
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
          searchTerm = match[1];
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
        searchTerm = match[1];
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
