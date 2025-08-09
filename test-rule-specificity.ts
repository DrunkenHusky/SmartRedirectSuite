import assert from 'node:assert/strict';
import { selectMostSpecificRule } from './shared/ruleMatching';
import { RULE_MATCHING_CONFIG } from './shared/constants';
import type { UrlRule } from './shared/schema';

function makeRule(id: string, matcher: string, createdOffset = 0): UrlRule {
  return {
    id,
    matcher,
    targetUrl: '',
    redirectType: 'partial',
    infoText: '',
    autoRedirect: false,
    createdAt: new Date(2020, 0, 1 + createdOffset).toISOString(),
  };
}

// Basis: /subsite vs /subsite/xyz
{
  const rules = [makeRule('1', '/subsite'), makeRule('2', '/subsite/xyz')];
  const r = selectMostSpecificRule('/subsite/xyz', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.matcher, '/subsite/xyz');
}

// Basis: query match
{
  const rules = [makeRule('1', '/subsite'), makeRule('2', '/subsite?document.aspx=123')];
  const r = selectMostSpecificRule('/subsite?document.aspx=123', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.matcher, '/subsite?document.aspx=123');
}

// Query dominance same path
{
  const rules = [makeRule('1', '/a/b'), makeRule('2', '/a/b?x=1')];
  const r = selectMostSpecificRule('/a/b?x=1', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.matcher, '/a/b?x=1');
}

// Wildcard vs static
{
  const rules = [makeRule('1', '/a/*'), makeRule('2', '/a/b')];
  const r = selectMostSpecificRule('/a/b', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.matcher, '/a/b');
}

// Wildcard with query enriched rule
{
  const rules = [makeRule('1', '/a/:id/c'), makeRule('2', '/a/123/c?x=1')];
  const r = selectMostSpecificRule('/a/123/c?x=1', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.matcher, '/a/123/c?x=1');
}

// Trailing slash equivalence
{
  const rules = [makeRule('1', '/x/y', 0), makeRule('2', '/x/y/', 1)];
  const r = selectMostSpecificRule('/x/y/', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.id, '1');
}

// Multi-query order
{
  const rules = [makeRule('1', '/p?q=1&q=2'), makeRule('2', '/p?q=2&q=1')];
  const r = selectMostSpecificRule('/p?q=2&q=1', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.id, '1');
}

// Deterministic tie-breaker
{
  const rules = [makeRule('1', '/same'), makeRule('2', '/same', 1)];
  const r = selectMostSpecificRule('/same', rules, RULE_MATCHING_CONFIG);
  assert.equal(r?.id, '1');
}

// Performance smoke test
{
  const bigRules: UrlRule[] = [];
  for (let i = 0; i < 10000; i++) {
    bigRules.push(makeRule(String(i), `/p/${i}`));
  }
  const start = Date.now();
  const r = selectMostSpecificRule('/p/9999', bigRules, RULE_MATCHING_CONFIG);
  const duration = Date.now() - start;
  assert.equal(r?.matcher, '/p/9999');
  assert.ok(duration < 1000, `Performance too slow: ${duration}ms`);
}

console.log('specificity tests passed');
