const fs = require('fs');
const path = require('path');

const files = [
    'tests/client/url-generation.test.ts',
    'tests/integration/test-domain-rules.ts',
    'tests/integration/test-param-handling.ts'
];

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        // Replace all occurrences
        content = content.replace(
            /const (\w+) = generateUrlWithRule\((.*?)\);/g,
            "const  = generateUrlWithRule().url;"
        );
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    } catch (e) {
        console.error(`Failed to update ${file}: ${e.message}`);
    }
});
