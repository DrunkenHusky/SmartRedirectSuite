import { read, utils, write } from '@e965/xlsx';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { UrlRule, importUrlRuleSchema } from '@shared/schema';

// Defined column mapping
const COLUMN_MAPPING = {
  matcher: ['Matcher', 'matcher', 'Quelle', 'Source'],
  targetUrl: ['Target URL', 'targetUrl', 'Ziel', 'Target'],
  redirectType: ['Type', 'redirectType', 'Typ'],
  infoText: ['Info', 'infoText', 'Beschreibung'],
  autoRedirect: ['Auto Redirect', 'autoRedirect', 'Automatisch'],
  discardQueryParams: ['Discard Query Params', 'discardQueryParams', 'Parameter entfernen'],
  forwardQueryParams: ['Keep Query Params', 'forwardQueryParams', 'Parameter behalten'],
  id: ['ID', 'id']
};

export interface ParsedRuleResult {
  rule: Partial<UrlRule>;
  isValid: boolean;
  errors: string[];
  status: 'new' | 'update' | 'invalid';
}

export class ImportExportService {
  /**
   * Parse uploaded file buffer (Excel or CSV) into rules
   */
  static parseFile(buffer: Buffer, filename: string): any[] {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      return this.parseCSV(buffer);
    } else if (['xlsx', 'xls'].includes(ext || '')) {
      return this.parseExcel(buffer);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  private static parseCSV(buffer: Buffer): any[] {
    const content = buffer.toString('utf-8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  private static parseExcel(buffer: Buffer): any[] {
    const workbook = read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return utils.sheet_to_json(worksheet);
  }

  /**
   * Normalize parsed data to internal Rule structure
   */
  static normalizeRules(
    rawRules: any[],
    options: { encodeImportedUrls?: boolean } = { encodeImportedUrls: true },
    existingRules: UrlRule[] = []
  ): ParsedRuleResult[] {
    // Create lookup map for faster matching by matcher
    const existingRulesByMatcher = new Map(existingRules.map(r => [r.matcher, r]));
    const existingRulesById = new Map(existingRules.map(r => [r.id, r]));

    return rawRules.map(row => {
      const rule: any = {};
      const errors: string[] = [];

      // Map columns
      const getValue = (keys: string[]) => {
        for (const key of keys) {
          // Case insensitive check for key
          const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
          if (foundKey) return row[foundKey];
        }
        return undefined;
      };

      rule.matcher = getValue(COLUMN_MAPPING.matcher);
      rule.targetUrl = getValue(COLUMN_MAPPING.targetUrl);

      // Encode matcher and targetUrl to handle special characters and spaces if enabled
      if (options.encodeImportedUrls) {
        if (typeof rule.matcher === 'string') {
          rule.matcher = encodeURI(rule.matcher);
        }
        if (typeof rule.targetUrl === 'string') {
          rule.targetUrl = encodeURI(rule.targetUrl);
        }
      }

      rule.redirectType = getValue(COLUMN_MAPPING.redirectType);
      rule.infoText = getValue(COLUMN_MAPPING.infoText);
      rule.autoRedirect = getValue(COLUMN_MAPPING.autoRedirect);
      rule.discardQueryParams = getValue(COLUMN_MAPPING.discardQueryParams);
      rule.forwardQueryParams = getValue(COLUMN_MAPPING.forwardQueryParams);
      rule.id = getValue(COLUMN_MAPPING.id);
      // Handle empty string IDs as undefined (common in Excel/CSV imports)
      if (rule.id === '' || (typeof rule.id === 'string' && rule.id.trim() === '')) {
        rule.id = undefined;
      }

      // Normalize Types
      if (rule.redirectType) {
        const type = String(rule.redirectType).toLowerCase();
        if (type.includes('wild') || type === 'complete') rule.redirectType = 'wildcard';
        else if (type.includes('part') || type === 'partial') rule.redirectType = 'partial';
        else if (type.includes('domain')) rule.redirectType = 'domain';
      } else {
        rule.redirectType = 'partial'; // Default
      }

      // Normalize AutoRedirect
      if (rule.autoRedirect !== undefined) {
        const ar = String(rule.autoRedirect).toLowerCase();
        rule.autoRedirect = ['true', '1', 'yes', 'ja', 'on'].includes(ar);
      } else {
        rule.autoRedirect = false;
      }

      // Normalize discardQueryParams
      if (rule.discardQueryParams !== undefined) {
        const dqp = String(rule.discardQueryParams).toLowerCase();
        rule.discardQueryParams = ['true', '1', 'yes', 'ja', 'on'].includes(dqp);
      } else {
        rule.discardQueryParams = false;
      }

      // Normalize forwardQueryParams
      if (rule.forwardQueryParams !== undefined) {
        const fqp = String(rule.forwardQueryParams).toLowerCase();
        rule.forwardQueryParams = ['true', '1', 'yes', 'ja', 'on'].includes(fqp);
      } else {
        rule.forwardQueryParams = false;
      }

      // Validation using Zod schema (partially)
      // We manually check required fields because the Zod schema might be too strict for initial parsing
      if (!rule.matcher) errors.push('Matcher (Quelle) is required');
      if (!rule.targetUrl) errors.push('Target URL (Ziel) is required');

      // Attempt to validate with Zod if basic checks pass
      let isValid = errors.length === 0;
      if (isValid) {
        const result = importUrlRuleSchema.safeParse(rule);
        if (!result.success) {
           // We extract friendly error messages
           result.error.issues.forEach(err => {
             // Skip ID errors as we handle them separately (optional vs uuid)
             if (err.path.includes('id') && !rule.id) return;
             if (err.path.includes('id') && rule.id && err.code === 'invalid_string') {
               errors.push('Invalid ID format');
               return;
             }
             errors.push(`${err.path.join('.')}: ${err.message}`);
           });
           if (errors.length > 0) isValid = false;
        } else {
          // Use the transformed values
          Object.assign(rule, result.data);
        }
      }

      // Determine status based on ID or Matcher existence
      let status: 'new' | 'update' | 'invalid' = 'new';

      if (!isValid) {
        status = 'invalid';
      } else {
        if (rule.id && existingRulesById.has(rule.id)) {
          status = 'update';
        } else if (existingRulesByMatcher.has(rule.matcher)) {
          status = 'update';
        } else if (rule.id && !existingRulesById.has(rule.id)) {
           // ID provided but not found -> treat as new (with specific ID)
           // But waiting, storage.importUrlRules says:
           // "ID provided but not found - create new"
           status = 'new';
        } else {
           status = 'new';
        }
      }

      return {
        rule,
        isValid,
        errors,
        status
      };
    });
  }

  /**
   * Generate CSV content
   */
  static generateCSV(rules: UrlRule[]): string {
    const data = rules.map(rule => ({
      ID: rule.id,
      Matcher: rule.matcher,
      'Target URL': rule.targetUrl,
      Type: rule.redirectType,
      Info: rule.infoText,
      'Auto Redirect': rule.autoRedirect ? 'true' : 'false',
      'Discard Query Params': rule.discardQueryParams ? 'true' : 'false',
      'Keep Query Params': rule.forwardQueryParams ? 'true' : 'false'
    }));

    return stringify(data, { header: true });
  }

  /**
   * Generate Excel buffer
   */
  static generateExcel(rules: UrlRule[]): Buffer {
    const data = rules.map(rule => ({
      ID: rule.id,
      Matcher: rule.matcher,
      'Target URL': rule.targetUrl,
      Type: rule.redirectType,
      Info: rule.infoText,
      'Auto Redirect': rule.autoRedirect,
      'Discard Query Params': rule.discardQueryParams,
      'Keep Query Params': rule.forwardQueryParams
    }));

    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, worksheet, 'Rules');

    // Explicitly using type 'buffer' which returns a Buffer in Node.js
    const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as unknown as Buffer;
  }
}
