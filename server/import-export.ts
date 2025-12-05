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
  static normalizeRules(rawRules: any[], options: { encodeImportedUrls?: boolean } = { encodeImportedUrls: true }): ParsedRuleResult[] {
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

      return {
        rule,
        isValid,
        errors,
        status: isValid ? (rule.id ? 'update' : 'new') : 'invalid'
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
      'Auto Redirect': rule.autoRedirect ? 'true' : 'false'
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
      'Auto Redirect': rule.autoRedirect
    }));

    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, worksheet, 'Rules');

    // Explicitly using type 'buffer' which returns a Buffer in Node.js
    const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as unknown as Buffer;
  }
}
