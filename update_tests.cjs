const fs = require('fs');
const path = require('path');

const filePath = path.join('tests', 'test_advanced_rules.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace direct usage with .url property access
// Regex to match "const result = generateUrlWithRule(...);"
// and replace with "const result = generateUrlWithRule(...).url;"

content = content.replace(
    /const result = generateUrlWithRule\((.*)\);/g,
    "const result = generateUrlWithRule($1).url;"
);

// Check if any other usage exists.
// I see "const result = generateUrlWithRule('https://old.com/test/path', rule);"
// and "const result = generateUrlWithRule(oldUrl, rule);"

fs.writeFileSync(filePath, content);
console.log('Tests updated');
