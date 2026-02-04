import { test } from 'node:test';
import assert from 'node:assert';
import { findMatchingRule, RuleMatchingConfig } from '../shared/ruleMatching';
import { UrlRule } from '../shared/schema';

const CONFIG: RuleMatchingConfig = {
  WEIGHT_PATH_SEGMENT: 100,
  WEIGHT_QUERY_PAIR: 50,
  PENALTY_WILDCARD: -10,
  BONUS_EXACT_MATCH: 200,
  TRAILING_SLASH_POLICY: "ignore",
  CASE_SENSITIVITY_PATH: false,
  CASE_SENSITIVITY_QUERY: false
};

test('Rule Matching: Strict Segment Boundary', (t) => {
  const rule: UrlRule = {
    id: '1',
    matcher: '/test-persist',
    targetUrl: '/new',
    redirectType: 'partial',
    autoRedirect: false,
    discardQueryParams: false,
    keptQueryParams: [],
    forwardQueryParams: false,
    staticQueryParams: [],
    searchAndReplace: [],
    infoText: '',
    createdAt: new Date().toISOString()
  };

  // 1. Exact match (Should match)
  const match1 = findMatchingRule('/test-persist', [rule], CONFIG);
  assert.ok(match1, 'Should match exact path');

  // 2. Subpath match (Should match)
  const match2 = findMatchingRule('/test-persist/sub', [rule], CONFIG);
  assert.ok(match2, 'Should match subpath');

  // 3. Extended path segment match (Should NOT match)
  // Current behavior: Matches because "test-persist-extra" starts with "test-persist"
  // Desired behavior: Should NOT match
  const match3 = findMatchingRule('/test-persist-extra', [rule], CONFIG);

  // This assert will fail currently, confirming the issue
  assert.strictEqual(match3, null, 'Should NOT match extended path segment');
});
