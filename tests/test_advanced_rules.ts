
import { test } from 'node:test';
import assert from 'node:assert';
import { generateUrlWithRule, SmartSearchRule, extractSearchTerm } from '../client/src/lib/url-utils';
import { ImportExportService } from '../server/import-export';
import { UrlRule } from '../shared/schema';

// Mock Rule
const mockRule: any = {
  matcher: '/test',
  targetUrl: 'https://target.com/new',
  redirectType: 'partial',
  discardQueryParams: true,
  keptQueryParams: [],
  staticQueryParams: [],
};

test('Advanced Rules: Static Parameters', (t) => {
  const rule = {
    ...mockRule,
    staticQueryParams: [
      { key: 'source', value: 'migration' },
      { key: 'version', value: '2' }
    ]
  };

  const result = generateUrlWithRule('https://old.com/test/path', rule).url;
  assert.ok(result.includes('source=migration'));
  assert.ok(result.includes('version=2'));
  // Verify order (approximate as query param order isn't strictly guaranteed by standards but implementation does append in order)
  const sourceIndex = result.indexOf('source=migration');
  const versionIndex = result.indexOf('version=2');
  assert.ok(sourceIndex < versionIndex, 'Static parameters should be appended in order');
});

test('Advanced Rules: Kept Parameters with Renaming', (t) => {
  const rule = {
    ...mockRule,
    keptQueryParams: [
      { keyPattern: 'file', targetKey: 'f' }, // Rename file -> f
      { keyPattern: 'id', targetKey: '' },   // Keep id as id
      { keyPattern: 'type' }                 // Keep type as type (undefined targetKey)
    ]
  };

  const oldUrl = 'https://old.com/test?file=doc.pdf&id=123&type=A&ignore=me';
  const result = generateUrlWithRule(oldUrl, rule).url;

  assert.ok(result.includes('f=doc.pdf'), 'Renamed parameter should exist');
  assert.ok(!result.includes('file=doc.pdf'), 'Original parameter name should be gone if renamed');
  assert.ok(result.includes('id=123'), 'Parameter with empty targetKey should be kept as is');
  assert.ok(result.includes('type=A'), 'Parameter with undefined targetKey should be kept as is');
  assert.ok(!result.includes('ignore=me'), 'Discarded parameter should not exist');
});

test('Advanced Rules: Order of Operations (Static then Kept)', (t) => {
  const rule = {
    ...mockRule,
    staticQueryParams: [
        { key: 'static', value: '1' }
    ],
    keptQueryParams: [
        { keyPattern: 'dynamic', targetKey: 'd' }
    ]
  };

  const oldUrl = 'https://old.com/test?dynamic=value';
  const result = generateUrlWithRule(oldUrl, rule).url;

  // Expected: ?static=1&d=value
  const staticIndex = result.indexOf('static=1');
  const dynamicIndex = result.indexOf('d=value');

  assert.ok(staticIndex !== -1, 'Static param missing');
  assert.ok(dynamicIndex !== -1, 'Kept param missing');
  assert.ok(staticIndex > dynamicIndex, 'Static parameters should come AFTER kept parameters');
});

test('Import/Export: Static and Renamed Params', (t) => {
  const rules: UrlRule[] = [{
      id: 'uuid-123',
      matcher: '/test',
      targetUrl: '/target',
      redirectType: 'partial',
      discardQueryParams: true,
      keptQueryParams: [{ keyPattern: 'old', targetKey: 'new' }],
      staticQueryParams: [{ key: 'fixed', value: 'val' }],
      autoRedirect: false,
      forwardQueryParams: false,
      createdAt: new Date().toISOString()
  } as any];

  // Test JSON Import/Export via CSV Logic
  const csv = ImportExportService.generateCSV(rules);
  const parsed = ImportExportService.parseFile(Buffer.from(csv), 'test.csv');
  const normalized = ImportExportService.normalizeRules(parsed);

  const importedRule = normalized[0].rule;

  assert.deepStrictEqual(importedRule.staticQueryParams, [{ key: 'fixed', value: 'val', skipEncoding: false }]);
  assert.deepStrictEqual(importedRule.keptQueryParams, [{ keyPattern: 'old', targetKey: 'new', skipEncoding: false }]);
});
