const fs = require('fs');
const path = require('path');

// Fix 1: GlobalRulesSettings.tsx
const globalSettingsPath = path.join('client', 'src', 'components', 'admin', 'GlobalRulesSettings.tsx');
try {
    let content = fs.readFileSync(globalSettingsPath, 'utf8');
    // Replace "-> " with "&rarr; " inside the span
    content = content.replace(
        'Global (hier) -> Regel-spezifisch',
        'Global (hier) &rarr; Regel-spezifisch'
    );
    fs.writeFileSync(globalSettingsPath, content);
    console.log('Fixed GlobalRulesSettings.tsx');
} catch (e) {
    console.error('Error fixing GlobalRulesSettings.tsx:', e);
}

// Fix 2: migration.tsx
const migrationPath = path.join('client', 'src', 'pages', 'migration.tsx');
try {
    let content = fs.readFileSync(migrationPath, 'utf8');

    // Fix duplicates in auto-redirect track call
    // The pattern likely looks like:
    // feedback: settings.enableFeedbackSurvey ? 'auto-redirect' : undefined
    // ,
    //   redirectStrategy,
    //   appliedGlobalRules,
    // redirectStrategy,
    // appliedGlobalRules}),

    // We can use a regex to clean this up.
    // Use a regex that matches the block and replaces it with the clean version.

    const duplicatePattern = /feedback: settings\.enableFeedbackSurvey \? 'auto-redirect' : undefined\s*,\s*redirectStrategy,\s*appliedGlobalRules,\s*redirectStrategy,\s*appliedGlobalRules\}\),/;
    const replacement = "feedback: settings.enableFeedbackSurvey ? 'auto-redirect' : undefined, redirectStrategy, appliedGlobalRules }),";

    if (duplicatePattern.test(content)) {
        content = content.replace(duplicatePattern, replacement);
        console.log('Fixed duplicates in migration.tsx (Auto-redirect)');
    } else {
        // Fallback: try to just replace the repeated part if strict matching failed due to whitespace
        content = content.replace(
            /redirectStrategy,\s*appliedGlobalRules,\s*redirectStrategy,\s*appliedGlobalRules/,
            "redirectStrategy, appliedGlobalRules"
        );
    }

    // Fix duplicates in normal track call?
    // Based on previous plan execution, I might have messed up both or just one.
    // The previous plan updated both.

    // Let's look for any remaining double occurrences.
    // "redirectStrategy,\n              appliedGlobalRules,\n            redirectStrategy,\n            appliedGlobalRules"

    const doubleEntryRegex = /redirectStrategy,\s*appliedGlobalRules,\s*redirectStrategy,\s*appliedGlobalRules/g;
    content = content.replace(doubleEntryRegex, "redirectStrategy, appliedGlobalRules");

    fs.writeFileSync(migrationPath, content);
    console.log('Fixed migration.tsx');
} catch (e) {
    console.error('Error fixing migration.tsx:', e);
}
