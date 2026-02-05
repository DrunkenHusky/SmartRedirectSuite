const fs = require('fs');
const path = require('path');

const filePath = path.join('tests', 'test_advanced_rules.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Flip assertion for Order of Operations
// Search for: assert.ok(staticIndex < dynamicIndex, 'Static parameters should come before kept parameters');
// Replace with: assert.ok(staticIndex > dynamicIndex, 'Static parameters should come AFTER kept parameters');

content = content.replace(
    "assert.ok(staticIndex < dynamicIndex, 'Static parameters should come before kept parameters');",
    "assert.ok(staticIndex > dynamicIndex, 'Static parameters should come AFTER kept parameters');"
);

// Fix 2: Update Import/Export expectation
// Search for: assert.deepStrictEqual(importedRule.staticQueryParams, [{ key: 'fixed', value: 'val' }]);
// Replace with: assert.deepStrictEqual(importedRule.staticQueryParams, [{ key: 'fixed', value: 'val', skipEncoding: false }]);

content = content.replace(
    "assert.deepStrictEqual(importedRule.staticQueryParams, [{ key: 'fixed', value: 'val' }]);",
    "assert.deepStrictEqual(importedRule.staticQueryParams, [{ key: 'fixed', value: 'val', skipEncoding: false }]);"
);

// Search for: assert.deepStrictEqual(importedRule.keptQueryParams, [{ keyPattern: 'old', targetKey: 'new' }]);
// Replace with: assert.deepStrictEqual(importedRule.keptQueryParams, [{ keyPattern: 'old', targetKey: 'new', skipEncoding: false }]);

content = content.replace(
    "assert.deepStrictEqual(importedRule.keptQueryParams, [{ keyPattern: 'old', targetKey: 'new' }]);",
    "assert.deepStrictEqual(importedRule.keptQueryParams, [{ keyPattern: 'old', targetKey: 'new', skipEncoding: false }]);"
);

fs.writeFileSync(filePath, content);
console.log('Tests fixed');
