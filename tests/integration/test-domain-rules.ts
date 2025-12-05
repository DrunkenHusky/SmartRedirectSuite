
import { findMatchingRule, preprocessRule } from '../../shared/ruleMatching';
import { generateUrlWithRule } from '../../client/src/lib/url-utils';
import { RULE_MATCHING_CONFIG } from '../../shared/constants';

const config = {
  ...RULE_MATCHING_CONFIG,
  DEBUG: true
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected ${expected} but got ${actual}`);
  }
}

console.log("Running Domain Rules Tests...");

// Test 1: Domain Matcher matches exact domain
{
  console.log("Test 1: Domain Matcher matches exact domain");
  const rule = {
    id: '1',
    matcher: 'www.google.ch',
    targetUrl: 'https://new-google.ch',
    redirectType: 'domain' as const,
    autoRedirect: false,
    createdAt: new Date().toISOString()
  };

  const processed = [preprocessRule(rule, config)];
  const match = findMatchingRule('http://www.google.ch/some/path', processed, config);

  assert(!!match, 'Should match domain');
  assertEqual(match?.rule.matcher, 'www.google.ch', 'Matcher should be correct');

  const newUrl = generateUrlWithRule('http://www.google.ch/some/path', match!.rule);
  assertEqual(newUrl, 'https://new-google.ch/some/path', 'Redirect URL should preserve path');
}

// Test 2: Domain Matcher matches domain ignoring protocol
{
  console.log("Test 2: Domain Matcher matches domain ignoring protocol");
  const rule = {
    id: '1',
    matcher: 'old-site.com',
    targetUrl: 'https://new-site.com',
    redirectType: 'domain' as const,
    autoRedirect: false,
    createdAt: new Date().toISOString()
  };

  const processed = [preprocessRule(rule, config)];
  const match = findMatchingRule('https://old-site.com/foo', processed, config);
  assert(!!match, 'Should match https domain');
}

// Test 3: Domain Matcher does NOT match different domain
{
  console.log("Test 3: Domain Matcher does NOT match different domain");
  const rule = {
    id: '1',
    matcher: 'old-site.com',
    targetUrl: 'https://new-site.com',
    redirectType: 'domain' as const,
    autoRedirect: false,
    createdAt: new Date().toISOString()
  };

  const processed = [preprocessRule(rule, config)];
  const match = findMatchingRule('https://other-site.com/foo', processed, config);
  assert(!match, 'Should not match different domain');
}

// Test 4: Path Matcher with Domain Redirect: keeps path
{
  console.log("Test 4: Path Matcher with Domain Redirect: keeps path");
  const rule = {
    id: '2',
    matcher: '/blog',
    targetUrl: 'https://new-blog.com',
    redirectType: 'domain' as const, // 'domain' type with path matcher
    autoRedirect: false,
    createdAt: new Date().toISOString()
  };

  const processed = [preprocessRule(rule, config)];
  const match = findMatchingRule('http://mysite.com/blog/post-1', processed, config);

  assert(!!match, 'Should match path');

  // Note: generateUrlWithRule logic for 'domain' type should extract path from oldUrl and append to target domain
  const newUrl = generateUrlWithRule('http://mysite.com/blog/post-1', match!.rule);
  assertEqual(newUrl, 'https://new-blog.com/blog/post-1', 'Should replace domain and keep path');
}

// Test 5: Domain Matcher with Partial Redirect (Special Case from url-utils)
{
  console.log("Test 5: Domain Matcher with Partial Redirect");
  // This verifies the specific logic I fixed in url-utils.ts
  const rule = {
    id: '3',
    matcher: 'legacy.com',
    targetUrl: 'https://modern.com/archive',
    redirectType: 'partial' as const,
    autoRedirect: false,
    createdAt: new Date().toISOString()
  };

  // If redirectType is 'partial' but matcher is domain, it should replace domain with targetUrl/path
  const oldUrl = 'http://legacy.com/docs/v1/page.html';
  const newUrl = generateUrlWithRule(oldUrl, rule);

  // Expected: https://modern.com/archive/docs/v1/page.html
  // Because logic is: targetBase (= targetUrl) + normalizedOldPath
  assertEqual(newUrl, 'https://modern.com/archive/docs/v1/page.html', 'Should prefix path with target URL path');
}

console.log("All tests passed!");
