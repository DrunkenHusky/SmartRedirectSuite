const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'pages', 'migration.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Declare variables
const initStart = content.indexOf('const initializePage = async () => {');
if (initStart !== -1) {
    const insertPos = content.indexOf('let currentMatchQuality = 0;', initStart);
    if (insertPos !== -1) {
        content = content.slice(0, insertPos) +
            `let currentMatchQuality = 0;
        let redirectStrategy = undefined;
        let appliedGlobalRules = [];
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
    const matchLevelYellow = content.indexOf("setMatchLevel('yellow');", smartSearchStart);
    if (matchLevelYellow !== -1) {
         content = content.slice(0, matchLevelYellow) +
            "redirectStrategy = 'smart-search';\n                    " +
            content.slice(matchLevelYellow);
    }
}

// Domain Fallback (Standard Domain Replacement)
// We need to find the specific else block.
// It matches "Standard Domain Replacement" comment
const domainFallbackComment = content.indexOf("// Standard Domain Replacement");
if (domainFallbackComment !== -1) {
    const matchLevelRed = content.indexOf("setMatchLevel('red');", domainFallbackComment);
    if (matchLevelRed !== -1) {
         content = content.slice(0, matchLevelRed) +
            "redirectStrategy = 'domain-fallback';\n                    " +
            content.slice(matchLevelRed);
    }
}

// Fallback inside Smart Search (Extraction fails)
const extractionFailFallback = content.indexOf("// Fallback if extraction fails or no search URL");
if (extractionFailFallback !== -1) {
    const redSet = content.indexOf("setMatchLevel('red');", extractionFailFallback);
    if (redSet !== -1) {
        content = content.slice(0, redSet) + "redirectStrategy = 'domain-fallback';\n                             " + content.slice(redSet);
    }
}

// 4. Update track calls
// Auto-redirect track
const trackAutoBodyEnd = content.indexOf("feedback: settings.enableFeedbackSurvey ? 'auto-redirect' : undefined");
if (trackAutoBodyEnd !== -1) {
    // Find the next }
    const insertPoint = content.indexOf("}", trackAutoBodyEnd);
    if (insertPoint !== -1) {
        content = content.slice(0, insertPoint) + `,
              redirectStrategy,
              appliedGlobalRules` + content.slice(insertPoint);
    }
}

// Normal track
const trackNormalBodyEnd = content.indexOf("matchQuality: currentMatchQuality,");
if (trackNormalBodyEnd !== -1) {
    // Find the next } (closing the object)
    const insertPoint = content.indexOf("}", trackNormalBodyEnd);
    if (insertPoint !== -1) {
        content = content.slice(0, insertPoint) + `,
            redirectStrategy,
            appliedGlobalRules` + content.slice(insertPoint);
    }
}

// 5. Update useEffect
const useEffectUpdate = 'setNewUrl(generateUrlWithRule(currentUrl, matchingRule, settings.defaultNewDomain));';
const useEffectReplace = 'setNewUrl(generateUrlWithRule(currentUrl, matchingRule, settings.defaultNewDomain, settings).url);';
content = content.replace(useEffectUpdate, useEffectReplace);

fs.writeFileSync(filePath, content);
console.log("Migration page updated");
