import {
    extractPath,
    generateNewUrl,
    extractSearchTerm,
    applySearchAndReplaceSingle,
    appendQueryString,
    processKeptQueryParams,
    processStaticQueryParams,
    type SmartSearchRule,
    type AppliedGlobalRule
} from "@shared/url-utils";
import { generateUrlWithRule } from "@shared/url-trace";

// Re-export shared utilities
export {
    extractPath,
    generateNewUrl,
    extractSearchTerm,
    applySearchAndReplaceSingle,
    appendQueryString,
    processKeptQueryParams,
    processStaticQueryParams,
    generateUrlWithRule,
    type SmartSearchRule,
    type AppliedGlobalRule
};

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
