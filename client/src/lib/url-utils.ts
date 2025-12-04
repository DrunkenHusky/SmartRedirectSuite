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
  rule: { matcher: string; targetUrl?: string; redirectType?: 'wildcard' | 'partial' | 'domain' },
  newDomain?: string
): string {
  try {
    const redirectType = rule.redirectType || 'partial';
    
    if (redirectType === 'wildcard' && rule.targetUrl) {
      // Vollständig: Replace entire URL with target URL - no original URL parts are preserved
      return rule.targetUrl;
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
      const path = extractPath(oldUrl);

      // Ensure path starts with /
      const cleanPath = path.startsWith('/') ? path : '/' + path;

      return cleanDomain + cleanPath;

    } else if (redirectType === 'partial' && rule.targetUrl) {
      // Teilweise: Replace path segments from matcher onwards, preserve additional segments/params/anchors
      const baseDomain = newDomain || 'https://thisisthenewurl.com/';
      const cleanDomain = baseDomain.replace(/\/$/, '');
      
      // Extract the full path with query params and hash  
      const oldPath = extractPath(oldUrl);
      
      // Clean up matcher and target
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
