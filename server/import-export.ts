import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { utils, write } from "@e965/xlsx";
import type { UrlRule, UrlTracking, ImportUrlRule } from "@shared/schema";
import { importUrlRuleSchema } from "@shared/schema";

export class ImportExportService {
  /**
   * Generates CSV string for statistics
   */
  static generateTrackingCsv(data: any[]): string {
    const csvData = data.map(entry => ({
      Timestamp: entry.timestamp,
      'Old URL': this.sanitizeForCSV(entry.oldUrl),
      'New URL': this.sanitizeForCSV(entry.newUrl),
      Path: this.sanitizeForCSV(entry.path),
      Referrer: this.sanitizeForCSV(entry.referrer || ''),
      'Match Quality': entry.matchQuality || 0,
      Feedback: entry.feedback || '',
      'Fallback Type': entry.fallbackType || '',
      'User Proposed URL': this.sanitizeForCSV(entry.userProposedUrl || ''),
      'Applied Global Transformations': entry.appliedGlobalTransformations
        ? entry.appliedGlobalTransformations.map((t: any) => `${t.type}: ${t.description}`).join('; ')
        : ''
    }));

    return stringify(csvData, { header: true });
  }

  /**
   * Generates CSV string for blocked IPs
   */
  static generateBlockedIpsCsv(data: any[]): string {
    const csvData = data.map(entry => ({
      IP: this.sanitizeForCSV(entry.ip),
      'Failed Attempts': entry.attempts,
      'Blocked Until': entry.blockedUntil ? new Date(entry.blockedUntil).toISOString() : ''
    }));

    return stringify(csvData, { header: true });
  }

  /**
   * Generates Excel buffer for blocked IPs
   */
  static generateBlockedIpsExcel(data: any[]): Buffer {
    const excelData = data.map(entry => ({
      IP: this.sanitizeForCSV(entry.ip),
      'Failed Attempts': entry.attempts,
      'Blocked Until': entry.blockedUntil ? new Date(entry.blockedUntil).toISOString() : ''
    }));

    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(excelData);
    utils.book_append_sheet(workbook, worksheet, 'Blocked IPs');

    const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as unknown as Buffer;
  }

  /**
   * Parse import file (CSV or JSON)
   * @returns Array of validation results
   */
  static async parseImportFile(
    content: string,
    fileType: 'json' | 'csv',
    existingRulesById: Set<string>,
    existingRulesByMatcher: Set<string>
  ): Promise<any[]> {
    let rules: any[] = [];

    if (fileType === 'json') {
      try {
        const parsed = JSON.parse(content);
        rules = Array.isArray(parsed) ? parsed : (parsed.rules || []);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }
    } else {
      try {
        rules = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });
      } catch (e) {
        throw new Error('Invalid CSV format');
      }
    }

    // Map CSV headers to internal fields if needed
    // Normalize and Validate
    return rules.map((rawRule: any, index: number) => {
      const errors: string[] = [];
      const rule: any = {};

      // Map fields (handling CSV headers vs JSON keys)
      rule.id = rawRule.id || rawRule.ID; // Optional
      rule.matcher = rawRule.matcher || rawRule.Matcher || rawRule['Quell-Pfad'] || rawRule['Source Path'];
      rule.targetUrl = rawRule.targetUrl || rawRule.target || rawRule['Target URL'] || rawRule['Ziel-URL'];

      // Map Type
      const rawType = rawRule.redirectType || rawRule.type || rawRule.Type || rawRule.Typ;
      if (rawType) {
        const normalizedType = String(rawType).toLowerCase().trim();
        if (['wildcard', 'vollständig', 'complete'].includes(normalizedType)) {
          rule.redirectType = 'wildcard';
        } else if (['domain'].includes(normalizedType)) {
          rule.redirectType = 'domain';
        } else {
          rule.redirectType = 'partial';
        }
      } else {
        rule.redirectType = 'partial'; // Default
      }

      rule.infoText = rawRule.infoText || rawRule.Info || rawRule.description;

      // Boolean fields
      if (rawRule.autoRedirect !== undefined || rawRule['Auto Redirect'] !== undefined) {
        const val = String(rawRule.autoRedirect || rawRule['Auto Redirect']).toLowerCase();
        rule.autoRedirect = ['true', '1', 'yes', 'ja', 'on'].includes(val);
      } else {
        rule.autoRedirect = false;
      }

      // Handle query params settings (map from CSV or JSON)
      const dqp = rawRule.discardQueryParams ?? rawRule['Discard Query Params'];
      if (dqp !== undefined) {
        const val = String(dqp).toLowerCase();
        rule.discardQueryParams = ['true', '1', 'yes', 'ja', 'on'].includes(val);
      } else {
        rule.discardQueryParams = false;
      }

      // Normalize keptQueryParams (parse JSON string if needed)
      let kqp = rawRule.keptQueryParams ?? rawRule['Kept Query Params'];
      if (kqp !== undefined && kqp !== null && kqp !== '') {
        try {
          if (typeof kqp === 'string') {
            kqp = JSON.parse(kqp);
          }
          if (Array.isArray(kqp)) {
             rule.keptQueryParams = kqp.filter((item: any) =>
                item && typeof item === 'object' && typeof item.keyPattern === 'string'
             ).map((item: any) => ({
                ...item,
                skipEncoding: !!item.skipEncoding
             }));
          } else {
             rule.keptQueryParams = [];
             errors.push('Kept Query Params must be a valid JSON array');
          }
        } catch (e) {
          errors.push('Invalid JSON format for Kept Query Params');
          rule.keptQueryParams = [];
        }
      } else {
        rule.keptQueryParams = [];
      }

      // Normalize staticQueryParams
      let sqp = rawRule.staticQueryParams ?? rawRule['Static Query Params'];
      if (sqp !== undefined && sqp !== null && sqp !== '') {
        try {
          if (typeof sqp === 'string') {
            sqp = JSON.parse(sqp);
          }
          if (Array.isArray(sqp)) {
             rule.staticQueryParams = sqp.filter((item: any) =>
                item && typeof item === 'object' && typeof item.key === 'string' && typeof item.value === 'string'
             ).map((item: any) => ({
                ...item,
                skipEncoding: !!item.skipEncoding
             }));
          } else {
             rule.staticQueryParams = [];
             errors.push('Static Query Params must be a valid JSON array');
          }
        } catch (e) {
          errors.push('Invalid JSON format for Static Query Params');
          rule.staticQueryParams = [];
        }
      } else {
        rule.staticQueryParams = [];
      }

      // Normalize forwardQueryParams
      const fqp = rawRule.forwardQueryParams ?? rawRule['Keep Query Params'];
      if (fqp !== undefined) {
        const val = String(fqp).toLowerCase();
        rule.forwardQueryParams = ['true', '1', 'yes', 'ja', 'on'].includes(val);
      } else {
        rule.forwardQueryParams = false;
      }

      // Normalize searchAndReplace
      let sar = rawRule.searchAndReplace ?? rawRule['Search Replace'];
      if (sar !== undefined && sar !== null && sar !== '') {
        try {
          if (typeof sar === 'string') {
            sar = JSON.parse(sar);
          }
          if (Array.isArray(sar)) {
             rule.searchAndReplace = sar.filter((item: any) =>
                item && typeof item === 'object' && typeof item.search === 'string'
             );
          } else {
             rule.searchAndReplace = [];
             errors.push('Search Replace must be a valid JSON array');
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
      if (rule.redirectType === 'wildcard') {
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
      if (!rule.matcher) errors.push('Matcher (Quelle) is required');
      if (!rule.targetUrl) errors.push('Target URL (Ziel) is required');
      if (!rule.redirectType) errors.push('Type (Typ) is required');

      let isValid = errors.length === 0;
      if (isValid) {
        const result = importUrlRuleSchema.safeParse(rule);
        if (!result.success) {
           result.error.issues.forEach(err => {
             if (err.path.includes('id') && !rule.id) return;
             if (err.path.includes('id') && rule.id && err.code === 'invalid_string') {
               errors.push('Invalid ID format');
               return;
             }
             errors.push(`${err.path.join('.')}: ${err.message}`);
           });
           if (errors.length > 0) isValid = false;
        } else {
          Object.assign(rule, result.data);
        }
      }

      let status: 'new' | 'update' | 'invalid' = 'new';

      if (!isValid) {
        status = 'invalid';
      } else {
        if (rule.id && existingRulesById.has(rule.id)) {
          status = 'update';
        } else if (existingRulesByMatcher.has(rule.matcher)) {
          status = 'update';
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
   */
  private static sanitizeForCSV(value: any): any {
    if (typeof value === 'string') {
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

    const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as unknown as Buffer;
  }
}
