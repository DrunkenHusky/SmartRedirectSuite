import { test } from 'node:test';
import assert from 'node:assert';
import { extractSearchTerm } from '../client/src/lib/url-utils';

test('URL Utils: Strict Matcher Boundary', (t) => {
    // Scenario: Rule is "/sample-old-path" (no trailing slash)
    // URL is "/sample-old-path+2-0/Search/..."
    // This should NOT match.

    const rules = [{
        pattern: '', // No specific regex, use path matcher
        pathPattern: '/sample-old-path',
        order: 0,
        searchUrl: 'https://matched.com' // Set searchUrl to verify match
    }];

    // 1. Exact match
    const match1 = extractSearchTerm('/sample-old-path', rules);
    assert.strictEqual(match1.searchTerm, 'sample-old-path');
    assert.strictEqual(match1.searchUrl, 'https://matched.com');

    // 2. Subpath match (with slash)
    const match2 = extractSearchTerm('/sample-old-path/searchme', rules);
    assert.strictEqual(match2.searchTerm, 'searchme');
    assert.strictEqual(match2.searchUrl, 'https://matched.com');

    // 3. Extended path match (should FAIL with fix)
    // startsWith('/sample-old-path') is true for '/sample-old-path+2-0'
    const match3 = extractSearchTerm('/sample-old-path+2-0/Search/', rules);

    // If it falls back to last path segment (default behavior when NO rule matches),
    // searchUrl should be null (unless default searchUrl is used, but here we check rule specific).
    // The logic: if NO rule matches, it returns:
    // { searchTerm: lastSegment, searchUrl: null, ... }

    assert.strictEqual(match3.searchUrl, null, 'Should not match rule with extended path');
});
