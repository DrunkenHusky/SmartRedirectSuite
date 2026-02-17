
import { test, expect } from '@playwright/test';
import { ImportExportService } from '../../server/import-export';

test.describe('Import Encoding Logic', () => {

  test('should encode URLs when option is true (default)', () => {
    const rawRules = [
      {
        'Matcher': '/path with spaces',
        'Target URL': 'https://example.com/target with spaces'
      }
    ];

    // Default behavior (true)
    const resultDefault = ImportExportService.normalizeRules(rawRules);
    expect(resultDefault[0].rule.matcher).toBe('/path%20with%20spaces');
    expect(resultDefault[0].rule.targetUrl).toBe('https://example.com/target%20with%20spaces');

    // Explicitly true
    const resultTrue = ImportExportService.normalizeRules(rawRules, { encodeImportedUrls: true });
    expect(resultTrue[0].rule.matcher).toBe('/path%20with%20spaces');
    expect(resultTrue[0].rule.targetUrl).toBe('https://example.com/target%20with%20spaces');
  });

  test('should NOT encode URLs when option is false', () => {
    const rawRules = [
      {
        'Matcher': '/path with spaces',
        'Target URL': 'https://example.com/target with spaces'
      }
    ];

    const resultFalse = ImportExportService.normalizeRules(rawRules, { encodeImportedUrls: false });
    expect(resultFalse[0].rule.matcher).toBe('/path with spaces');
    expect(resultFalse[0].rule.targetUrl).toBe('https://example.com/target with spaces');
  });

  test('should handle special characters correctly', () => {
     const rawRules = [
      {
        'Matcher': '/päth',
        'Target URL': 'https://example.com/tärget'
      }
    ];

    // Encoded
    const resultEncoded = ImportExportService.normalizeRules(rawRules, { encodeImportedUrls: true });
    expect(resultEncoded[0].rule.matcher).toBe('/p%C3%A4th');

    // Not encoded
    const resultRaw = ImportExportService.normalizeRules(rawRules, { encodeImportedUrls: false });
    expect(resultRaw[0].rule.matcher).toBe('/päth');
  });

  test('should handle already encoded URLs correctly (avoid double encoding)', () => {
    const rawRules = [
      {
        'Matcher': '/path%20with%20spaces',
        'Target URL': 'https://example.com/target%20with%20spaces'
      }
    ];

    const result = ImportExportService.normalizeRules(rawRules, { encodeImportedUrls: true });
    // Should remain single-encoded
    expect(result[0].rule.matcher).toBe('/path%20with%20spaces');
    expect(result[0].rule.targetUrl).toBe('https://example.com/target%20with%20spaces');
  });

  test('should handle malformed encoded URLs gracefully', () => {
    const rawRules = [
      {
        'Matcher': '/path%with%invalid',
        'Target URL': 'https://example.com/target%with%invalid'
      }
    ];

    const result = ImportExportService.normalizeRules(rawRules, { encodeImportedUrls: true });
    // Should encode the literal % as %25
    expect(result[0].rule.matcher).toBe('/path%25with%25invalid');
    expect(result[0].rule.targetUrl).toBe('https://example.com/target%25with%25invalid');
  });
});
