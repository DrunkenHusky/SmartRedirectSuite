import { read, utils, write } from '@e965/xlsx';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { UrlRule, importUrlRuleSchema } from '@shared/schema';

// Defined column mapping
// These keys define which CSV/Excel columns map to which internal rule properties.
// Multiple variations are supported to handle different languages and formats.
const COLUMN_MAPPING = {
  matcher: ['Matcher', 'matcher', 'Quelle', 'Source'],
  targetUrl: ['Target URL', 'targetUrl', 'Ziel', 'Target'],
  redirectType: ['Type', 'redirectType', 'Typ'],
  infoText: ['Info', 'infoText', 'Beschreibung'],
  autoRedirect: ['Auto Redirect', 'autoRedirect', 'Automatisch'],
  discardQueryParams: ['Discard Query Params', 'discardQueryParams', 'Parameter entfernen'],
  keptQueryParams: ['Kept Query Params', 'keptQueryParams', 'Parameter Ausnahmen'],
  staticQueryParams: ['Static Query Params', 'staticQueryParams', 'Statische Parameter'],
  forwardQueryParams: ['Keep Query Params', 'forwardQueryParams', 'Parameter behalten'],
  searchAndReplace: ['Search Replace', 'searchAndReplace', 'Suchen Ersetzen'],
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
      rule.keptQueryParams = getValue(COLUMN_MAPPING.keptQueryParams);
      rule.staticQueryParams = getValue(COLUMN_MAPPING.staticQueryParams);
      rule.forwardQueryParams = getValue(COLUMN_MAPPING.forwardQueryParams);
      rule.searchAndReplace = getValue(COLUMN_MAPPING.searchAndReplace);
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

      // Normalize keptQueryParams (parse JSON string if needed)
      if (rule.keptQueryParams !== undefined && rule.keptQueryParams !== null && rule.keptQueryParams !== '') {
        try {
          if (typeof rule.keptQueryParams === 'string') {
            // Try to parse JSON
            rule.keptQueryParams = JSON.parse(rule.keptQueryParams);
          }

          // Validate structure
          if (!Array.isArray(rule.keptQueryParams)) {
             rule.keptQueryParams = [];
             // Only add error if it wasn't empty string (which we filtered out)
             errors.push('Kept Query Params must be a valid JSON array');
          } else {
             // Filter invalid items
             rule.keptQueryParams = rule.keptQueryParams.filter((item: any) =>
                item && typeof item === 'object' && typeof item.keyPattern === 'string'
             ).map((item: any) => ({
                ...item,
                skipEncoding: !!item.skipEncoding // Ensure boolean
             }));
          }
        } catch (e) {
          errors.push('Invalid JSON format for Kept Query Params');
          rule.keptQueryParams = [];
        }
      } else {
        rule.keptQueryParams = [];
      }

      // Normalize staticQueryParams (parse JSON string if needed)
      if (rule.staticQueryParams !== undefined && rule.staticQueryParams !== null && rule.staticQueryParams !== '') {
        try {
          if (typeof rule.staticQueryParams === 'string') {
            // Try to parse JSON
            rule.staticQueryParams = JSON.parse(rule.staticQueryParams);
          }

          // Validate structure
          if (!Array.isArray(rule.staticQueryParams)) {
             rule.staticQueryParams = [];
             // Only add error if it wasn't empty string (which we filtered out)
             errors.push('Static Query Params must be a valid JSON array');
          } else {
             // Filter invalid items
             rule.staticQueryParams = rule.staticQueryParams.filter((item: any) =>
                item && typeof item === 'object' && typeof item.key === 'string' && typeof item.value === 'string'
             ).map((item: any) => ({
                ...item,
                skipEncoding: !!item.skipEncoding // Ensure boolean
             }));
          }
        } catch (e) {
          errors.push('Invalid JSON format for Static Query Params');
          rule.staticQueryParams = [];
        }
      } else {
        rule.staticQueryParams = [];
      }

      // Normalize forwardQueryParams
      if (rule.forwardQueryParams !== undefined) {
        const fqp = String(rule.forwardQueryParams).toLowerCase();
        rule.forwardQueryParams = ['true', '1', 'yes', 'ja', 'on'].includes(fqp);
      } else {
        rule.forwardQueryParams = false;
      }

      // Normalize searchAndReplace (parse JSON string if needed)
      if (rule.searchAndReplace !== undefined && rule.searchAndReplace !== null && rule.searchAndReplace !== '') {
        try {
          if (typeof rule.searchAndReplace === 'string') {
            // Try to parse JSON
            rule.searchAndReplace = JSON.parse(rule.searchAndReplace);
          }

          // Validate structure
          if (!Array.isArray(rule.searchAndReplace)) {
             rule.searchAndReplace = [];
             // Only add error if it wasn't empty string
             errors.push('Search Replace must be a valid JSON array');
          } else {
             // Filter invalid items
             rule.searchAndReplace = rule.searchAndReplace.filter((item: any) =>
                item && typeof item === 'object' && typeof item.search === 'string'
             );
          }
        } catch (e) {
          errors.push('Invalid JSON format for Search Replace');
          rule.searchAndReplace = [];
        }
      } else {
        rule.searchAndReplace = [];
      }

      // Cross-validation for query params settings
      if (rule.discardQueryParams && rule.forwardQueryParams) {
        errors.push('Parameters cannot be both discarded and kept / Parameter können nicht gleichzeitig entfernt und behalten werden');
      }

      // Type-specific query params validation
      // Validate that the correct flags are used for the rule type to avoid ambiguity
      if (rule.redirectType === 'wildcard') {
        // For wildcard:
        // if forwardQueryParams is TRUE, discard must be FALSE (implicit)
        // if forwardQueryParams is FALSE, discard must be TRUE (implicit) to allow keptQueryParams
        // During import, we fix this logic to match the new UI behavior
        if (rule.forwardQueryParams) {
            rule.discardQueryParams = false;
        } else {
            rule.discardQueryParams = true;
        }
      } else if (rule.redirectType === 'partial' || rule.redirectType === 'domain') {
        if (rule.forwardQueryParams) {
           const typeName = rule.redirectType === 'domain' ? 'Domain' : 'Partial';
           errors.push(`${typeName} rules keep parameters by default. Use "Discard Query Params" to remove them.`);
        }
      }

      // Validation using Zod schema (partially)
      // We manually check required fields because the Zod schema might be too strict for initial parsing
      if (!rule.matcher) errors.push('Matcher (Quelle) is required');
      if (!rule.targetUrl) errors.push('Target URL (Ziel) is required');
      if (!rule.redirectType) errors.push('Type (Typ) is required');

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
   * Sanitize value for CSV/Excel injection protection
   * @param value The value to sanitize
   * @returns Sanitized value
   */
  private static sanitizeForCSV(value: any): any {
    if (typeof value === 'string') {
      // Prevent formula injection (CSV Injection)
      // If string starts with =, +, -, or @, prepend a single quote
      if (/^[=+\-@]/.test(value)) {
        return `'${value}`;
      }
    }
    return value;
  }

  /**
   * Generate CSV content
   */
  static generateCSV(rules: UrlRule[]): string {
    const data = rules.map(rule => ({
      ID: rule.id,
      Matcher: this.sanitizeForCSV(rule.matcher),
      'Target URL': this.sanitizeForCSV(rule.targetUrl),
      Type: rule.redirectType,
      Info: this.sanitizeForCSV(rule.infoText),
      'Auto Redirect': rule.autoRedirect ? 'true' : 'false',
      'Discard Query Params': rule.discardQueryParams ? 'true' : 'false',
      'Kept Query Params': (rule.keptQueryParams && rule.keptQueryParams.length > 0) ? JSON.stringify(rule.keptQueryParams) : '',
      'Static Query Params': (rule.staticQueryParams && rule.staticQueryParams.length > 0) ? JSON.stringify(rule.staticQueryParams) : '',
      'Keep Query Params': rule.forwardQueryParams ? 'true' : 'false',
      'Search Replace': (rule.searchAndReplace && rule.searchAndReplace.length > 0) ? JSON.stringify(rule.searchAndReplace) : ''
    }));

    return stringify(data, { header: true });
  }

  /**
   * Generate Excel buffer
   */
  static generateExcel(rules: UrlRule[]): Buffer {
    const data = rules.map(rule => ({
      ID: rule.id,
      Matcher: this.sanitizeForCSV(rule.matcher),
      'Target URL': this.sanitizeForCSV(rule.targetUrl),
      Type: rule.redirectType,
      Info: this.sanitizeForCSV(rule.infoText),
      'Auto Redirect': rule.autoRedirect,
      'Discard Query Params': rule.discardQueryParams,
      'Kept Query Params': (rule.keptQueryParams && rule.keptQueryParams.length > 0) ? JSON.stringify(rule.keptQueryParams) : '',
      'Static Query Params': (rule.staticQueryParams && rule.staticQueryParams.length > 0) ? JSON.stringify(rule.staticQueryParams) : '',
      'Keep Query Params': rule.forwardQueryParams,
      'Search Replace': (rule.searchAndReplace && rule.searchAndReplace.length > 0) ? JSON.stringify(rule.searchAndReplace) : ''
    }));

    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, worksheet, 'Rules');

    // Explicitly using type 'buffer' which returns a Buffer in Node.js
    const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as unknown as Buffer;
  }
  /**
   * Extract URLs from uploaded file (First column)
   */
  static extractUrls(buffer: Buffer, filename: string, limit: number = 1000): { urls: string[], truncated: boolean, total: number } {
    const ext = filename.split('.').pop()?.toLowerCase();

    // Check supported extensions
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
        throw new Error(`Unsupported file format: ${ext}`);
    }

    try {
      // Use xlsx library for all formats (handles CSV BOM, encoding, etc.)
      const workbook = read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("Empty workbook or no sheets found");
      }
      const worksheet = workbook.Sheets[firstSheetName];
      // header: 1 returns array of arrays [["url1"], ["url2"]]
      const rows: any[] = utils.sheet_to_json(worksheet, { header: 1 });

      const urls: string[] = [];
      for (const row of rows) {
        let val: any;
        if (Array.isArray(row)) {
          val = row[0];
        } else if (typeof row === 'object' && row !== null) {
          val = Object.values(row)[0];
        } else {
          val = row;
        }

        if (val && typeof val === 'string' && val.trim().length > 0) {
          urls.push(val.trim());
        }
      }

      const total = urls.length;
      const truncated = total > limit;
      return {
        urls: urls.slice(0, limit),
        truncated,
        total
      };
    } catch (error) {
       console.error("Error extracting URLs:", error);
       throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
