import { test } from 'node:test';
import assert from 'node:assert';
import { generateUrlWithRule } from '../../client/src/lib/url-utils.js';

test('Task 1: Wildcard Rule with Static Query Params', (t) => {
  const oldUrl = 'https://old.com/foo';
  const rule = {
    matcher: '/foo',
    targetUrl: 'https://new.com/bar',
    redirectType: 'wildcard' as const,
    staticQueryParams: [{ key: 'source', value: 'migration' }],
    // UI logic: If forward is false, discard is implicitly true
    discardQueryParams: true,
    forwardQueryParams: false,
  };

  const result = generateUrlWithRule(oldUrl, rule);
  assert.strictEqual(result, 'https://new.com/bar?source=migration');
});

test('Task 1: Wildcard Rule with Kept Query Params (Renaming)', (t) => {
  const oldUrl = 'https://old.com/foo?file=123&ignore=me';
  const rule = {
    matcher: '/foo',
    targetUrl: 'https://new.com/bar',
    redirectType: 'wildcard' as const,
    // UI logic: If forward is false, discard is implicitly true
    discardQueryParams: true,
    forwardQueryParams: false,
    keptQueryParams: [{ keyPattern: 'file', targetKey: 'id' }],
  };

  const result = generateUrlWithRule(oldUrl, rule);
  assert.strictEqual(result, 'https://new.com/bar?id=123');
});

test('Task 2: Search and Replace (Simple)', (t) => {
  const oldUrl = 'https://old.com/sites/my-site';
  const rule = {
    matcher: '/sites',
    targetUrl: '/sites',
    redirectType: 'partial' as const,
    searchAndReplace: [
      { search: '/sites', replace: '/teams', caseSensitive: false }
    ]
  };
  const newDomain = 'https://new.com';

  const result = generateUrlWithRule(oldUrl, rule, newDomain);
  assert.strictEqual(result, 'https://new.com/teams/my-site');
});

test('Task 2: Search and Replace (Case Sensitive)', (t) => {
  const oldUrl = 'https://old.com/Site/Page';
  const rule = {
    matcher: '/Site',
    targetUrl: '/Site',
    redirectType: 'partial' as const,
    searchAndReplace: [
      { search: 'Site', replace: 'Team', caseSensitive: true },
      { search: 'page', replace: 'doc', caseSensitive: true }
    ]
  };
  const newDomain = 'https://new.com';

  const result = generateUrlWithRule(oldUrl, rule, newDomain);
  assert.strictEqual(result, 'https://new.com/Team/Page');
});

test('Task 2: Search and Replace (Deletion)', (t) => {
  const oldUrl = 'https://old.com/foo/bar';
  const rule = {
    matcher: '/foo',
    targetUrl: '/foo',
    redirectType: 'partial' as const,
    searchAndReplace: [
      { search: '/foo', replace: '', caseSensitive: false }
    ]
  };
  const newDomain = 'https://new.com';

  const result = generateUrlWithRule(oldUrl, rule, newDomain);
  assert.strictEqual(result, 'https://new.com/bar');
});

test('Order of Operations: Match -> Search/Replace -> Params', (t) => {
  const oldUrl = 'https://old.com/base?p1=1';
  const rule = {
    matcher: '/base',
    targetUrl: '/base',
    redirectType: 'partial' as const,
    discardQueryParams: true,
    keptQueryParams: [{ keyPattern: 'p1', targetKey: 'p2' }],
    staticQueryParams: [{ key: 'static', value: '2' }],
    searchAndReplace: [
        { search: '/base', replace: '/replaced', caseSensitive: false }
    ]
  };
  const newDomain = 'https://new.com';

  const result = generateUrlWithRule(oldUrl, rule, newDomain);
  assert.strictEqual(result, 'https://new.com/replaced?p2=1&static=2');
});

test('Wildcard: Forward vs Discard priority', (t) => {
    // If forward is true, it forwards all.
    const oldUrl = 'https://old.com/foo?a=1';
    const rule = {
        matcher: '/foo',
        targetUrl: 'https://new.com/bar',
        redirectType: 'wildcard' as const,
        forwardQueryParams: true,
        // UI Logic: If forward is true, discard is implicitly false
        discardQueryParams: false,
        keptQueryParams: []
    };
    const result = generateUrlWithRule(oldUrl, rule);
    assert.strictEqual(result, 'https://new.com/bar?a=1');
});
