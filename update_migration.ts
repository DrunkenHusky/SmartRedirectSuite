import fs from 'fs';
import path from 'path';

const filePath = path.join('client', 'src', 'pages', 'migration.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Declare variables
const initStart = content.indexOf('const initializePage = async () => {');
if (initStart !== -1) {
    const insertPos = content.indexOf('let currentMatchQuality = 0;', initStart);
    if (insertPos !== -1) {
        content = content.slice(0, insertPos) +
            `let currentMatchQuality = 0;
        let redirectStrategy: 'rule' | 'smart-search' | 'domain-fallback' | undefined;
        let appliedGlobalRules: any[] = [];
        ` +
            content.slice(insertPos + 'let currentMatchQuality = 0;'.length);
    }
}

// 2. Update generateUrlWithRule call
const genUrlCall = 'redirectUrl = generateUrlWithRule(url, rule, settings.defaultNewDomain);';
const genUrlReplace = `
            const generationResult = generateUrlWithRule(url, rule, settings.defaultNewDomain, settings);
            redirectUrl = generationResult.url;
            appliedGlobalRules = generationResult.appliedGlobalRules;
            redirectStrategy = 'rule';
`;
content = content.replace(genUrlCall, genUrlReplace);

// 3. Set redirectStrategy for Fallbacks
// Smart Search
const smartSearchStart = content.indexOf("if (settings.defaultRedirectMode === 'search') {");
if (smartSearchStart !== -1) {
    // Find where we set matchLevel to yellow, indicating smart search attempt
    const matchLevelYellow = content.indexOf("setMatchLevel('yellow');", smartSearchStart);
    if (matchLevelYellow !== -1) {
         content = content.slice(0, matchLevelYellow) +
            "redirectStrategy = 'smart-search';\n                    " +
            content.slice(matchLevelYellow);
    }
}

// Domain Fallback
// We look for the else block of defaultRedirectMode === 'search'
const domainFallbackStart = content.indexOf("} else {", smartSearchStart); // This finds the else for search mode
if (domainFallbackStart !== -1) {
    const matchLevelRed = content.indexOf("setMatchLevel('red');", domainFallbackStart);
    if (matchLevelRed !== -1) {
         content = content.slice(0, matchLevelRed) +
            "redirectStrategy = 'domain-fallback';\n                    " +
            content.slice(matchLevelRed);
    }
}

// Also handle the fallback within smart search (extraction failed)
const smartSearchFallback = content.indexOf("setMatchLevel('red');", smartSearchStart); // inside catch or else
// Note: There are two setMatchLevel('red') inside the search block logic (one in else, one in catch?)
// The code has:
// } else {
//    // Fallback if extraction fails
//    setMatchLevel('red');
//    generatedNewUrl = generateNewUrl(url, settings.defaultNewDomain);
//    if (settings.autoRedirect) { ... }
// }
// This fallback actually does Domain Replacement logic (generateNewUrl).
// So I should set redirectStrategy = 'domain-fallback' there too.

// Find "Fallback if extraction fails" comment
const extractionFailFallback = content.indexOf("// Fallback if extraction fails or no search URL");
if (extractionFailFallback !== -1) {
    const redSet = content.indexOf("setMatchLevel('red');", extractionFailFallback);
    if (redSet !== -1) {
        content = content.slice(0, redSet) + "redirectStrategy = 'domain-fallback';\n                             " + content.slice(redSet);
    }
}

// 4. Update track calls
// There are two track calls. One for auto-redirect, one for normal display.

// Auto-redirect track
const trackAutoBodyEnd = content.indexOf("feedback: settings.enableFeedbackSurvey ? 'auto-redirect' : undefined");
if (trackAutoBodyEnd !== -1) {
    const insertPoint = content.indexOf("})", trackAutoBodyEnd);
    content = content.slice(0, insertPoint) + `,
              redirectStrategy,
              appliedGlobalRules` + content.slice(insertPoint);
}

// Normal track
const trackNormalBodyEnd = content.indexOf("matchQuality: currentMatchQuality,");
if (trackNormalBodyEnd !== -1) {
    const insertPoint = content.indexOf("})", trackNormalBodyEnd);
    content = content.slice(0, insertPoint) + `,
            redirectStrategy,
            appliedGlobalRules` + content.slice(insertPoint);
}

// 5. Update useEffect for URL updates when settings change
// "setNewUrl(generateUrlWithRule(currentUrl, matchingRule, settings.defaultNewDomain));"
// This just updates the UI link, doesn't need to capture logs for tracking (tracking happens once on load).
// But generateUrlWithRule now returns an object.
const useEffectUpdate = 'setNewUrl(generateUrlWithRule(currentUrl, matchingRule, settings.defaultNewDomain));';
const useEffectReplace = 'setNewUrl(generateUrlWithRule(currentUrl, matchingRule, settings.defaultNewDomain, settings).url);';
content = content.replace(useEffectUpdate, useEffectReplace);

fs.writeFileSync(filePath, content);
