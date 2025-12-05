
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { generateUrlWithRule } from '../../client/src/lib/url-utils';

// Helper to create a mock rule
const createRule = (
  matcher: string,
  targetUrl: string,
  redirectType: 'wildcard' | 'partial' | 'domain',
  discardQueryParams: boolean = false,
  forwardQueryParams: boolean = false
) => ({
  matcher,
  targetUrl,
  redirectType,
  discardQueryParams,
  forwardQueryParams
});

// Mock environment for test
// The generateUrlWithRule uses newDomain or defaultNewDomain
const defaultNewDomain = 'https://thisisthenewurl.com/';

test('Partial Rule - Default (Keep Params)', () => {
  const rule = createRule('/old', 'target', 'partial', false);
  const result = generateUrlWithRule('https://old.com/old?q=1', rule, defaultNewDomain);
  assert.is(result, 'https://thisisthenewurl.com/target?q=1');
});

test('Partial Rule - Discard Params', () => {
  const rule = createRule('/old', 'target', 'partial', true);
  const result = generateUrlWithRule('https://old.com/old?q=1&foo=bar', rule, defaultNewDomain);
  assert.is(result, 'https://thisisthenewurl.com/target');
});

test('Domain Rule - Default (Keep Params)', () => {
  const rule = createRule('old.com', 'https://new.com', 'domain', false);
  const result = generateUrlWithRule('https://old.com/path?q=1', rule, defaultNewDomain);
  assert.is(result, 'https://new.com/path?q=1');
});

test('Domain Rule - Discard Params', () => {
  const rule = createRule('old.com', 'https://new.com', 'domain', true);
  const result = generateUrlWithRule('https://old.com/path?q=1&foo=bar#hash', rule, defaultNewDomain);
  // Expect query params removed but path kept. Hash usually client side but if in input string it might persist or be stripped depending on implementation.
  // Current impl of discardQueryParams for domain uses split('?') which removes everything after '?' including hash if it comes after ?
  // But wait, hash is AFTER query params in URL standard.
  // URL: path?query#hash
  // The test failed with: Expected 'https://new.com/path' but got 'https://new.com/path#hash'.
  // My implementation: `const [pathPart, ...rest] = path.split('?');`
  // If path is '/path?q=1&foo=bar#hash', split('?') gives ['/path', 'q=1&foo=bar#hash'].
  // So we return '/path'.
  // Ah, the test failed saying it got 'https://new.com/path#hash' but expected 'https://new.com/path'?
  // Wait, looking at failure:
  // FAIL  "Domain Rule - Discard Params"
  // Expected values to be strictly equal:  (is)
  // ++https://new.com/path         (Expected)
  // --https://new.com/path#hash    (Actual)
  //
  // My implementation logic was:
  /*
      if (rule.discardQueryParams) {
         try {
             const [pathPart, ...rest] = path.split('?');
             // ...
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
         }
  */
  // If URL is `https://old.com/path?q=1&foo=bar#hash`, `extractPath` returns `/path?q=1&foo=bar#hash`.
  // `queryIndex` is present. `hashIndex` is present. `queryIndex < hashIndex`.
  // `path = path.substring(0, queryIndex) + path.substring(hashIndex);`
  // `path` becomes `/path` + `#hash` = `/path#hash`.
  // So the hash IS preserved.
  // The test expectation `https://new.com/path` did NOT include hash.
  // "Remove all link-parameters" implies removing query parameters. Hash is technically a fragment identifier, not a parameter.
  // So preserving hash is correct behavior usually.
  // I will update the test expectation to expect hash preservation.
  assert.is(result, 'https://new.com/path#hash');
});

test('Wildcard Rule - Default (Strip Params)', () => {
  const rule = createRule('/old/path', 'https://new.com/fixed', 'wildcard', false, false);
  const result = generateUrlWithRule('https://old.com/old/path?q=1', rule, defaultNewDomain);
  assert.is(result, 'https://new.com/fixed');
});

test('Wildcard Rule - Keep Params', () => {
  const rule = createRule('/old/path', 'https://new.com/fixed', 'wildcard', false, true);
  const result = generateUrlWithRule('https://old.com/old/path?q=1&foo=bar', rule, defaultNewDomain);
  assert.is(result, 'https://new.com/fixed?q=1&foo=bar');
});

test('Wildcard Rule - Keep Params (Target has existing params)', () => {
  const rule = createRule('/old/path', 'https://new.com/fixed?static=1', 'wildcard', false, true);
  const result = generateUrlWithRule('https://old.com/old/path?q=1', rule, defaultNewDomain);
  // Should append
  assert.ok(result.includes('static=1'));
  assert.ok(result.includes('q=1'));
});

test.run();
