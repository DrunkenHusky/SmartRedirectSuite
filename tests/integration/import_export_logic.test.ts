import { test } from 'node:test';
import assert from 'node:assert';
import { ImportExportService } from '../../server/import-export';

test('ImportExportService - Logic Validation', async (t) => {
  await t.test('should parse CSV with new fields correctly', () => {
    const csvContent = `Matcher,Target URL,Type,Discard Query Params,Static Query Params,Search Replace
/old,https://new.com,partial,true,"[{""key"":""s"",""value"":""1""}]","[{""search"":""foo"",""replace"":""bar""}]"
`;
    const buffer = Buffer.from(csvContent);
    const result = ImportExportService.parseFile(buffer, 'test.csv');
    const normalized = ImportExportService.normalizeRules(result, { encodeImportedUrls: false });

    assert.strictEqual(normalized.length, 1);
    const rule = normalized[0].rule;

    assert.strictEqual(rule.matcher, '/old');
    assert.strictEqual(rule.targetUrl, 'https://new.com');
    assert.strictEqual(rule.redirectType, 'partial');
    assert.strictEqual(rule.discardQueryParams, true);

    assert.deepStrictEqual(rule.staticQueryParams, [{ key: 's', value: '1', skipEncoding: false }]);
    assert.deepStrictEqual(rule.searchAndReplace, [{ search: 'foo', replace: 'bar', caseSensitive: false }]);

    assert.strictEqual(normalized[0].isValid, true);
  });

  await t.test('should report error for invalid logic (Discard + Forward)', () => {
    const csvContent = `Matcher,Target URL,Type,Discard Query Params,Keep Query Params
/old,https://new.com,partial,true,true
`;
    const buffer = Buffer.from(csvContent);
    const result = ImportExportService.parseFile(buffer, 'test.csv');
    const normalized = ImportExportService.normalizeRules(result);

    assert.strictEqual(normalized.length, 1);
    const item = normalized[0];

    // isValid might be false or true depending on schema check vs logic check order.
    // The code pushes error to errors array.
    assert.strictEqual(item.isValid, false);
    assert.ok(item.errors.some(e => e.includes('Parameters cannot be both discarded and kept')));
  });

  await t.test('should validate JSON fields', () => {
    const csvContent = `Matcher,Target URL,Type,Static Query Params
/old,https://new.com,partial,"invalid-json"
`;
    const buffer = Buffer.from(csvContent);
    const result = ImportExportService.parseFile(buffer, 'test.csv');
    const normalized = ImportExportService.normalizeRules(result);

    const item = normalized[0];

    // The logic in ImportExportService adds error for invalid JSON.
    // If errors.length > 0, isValid is set to false.
    assert.ok(item.errors.some(e => e.includes('Invalid JSON format')));
  });
});
