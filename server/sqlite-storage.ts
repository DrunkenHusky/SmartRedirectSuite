import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { FileStorage, sanitizeRuleFlags } from "./storage";
import type { IStorage } from "./storage";
import type {
  UrlRule,
  InsertUrlRule,
  UrlTracking,
  InsertUrlTracking,
  GeneralSettings,
  InsertGeneralSettings,
  ImportUrlRule,
} from "@shared/schema";
import {
  ProcessedUrlRule,
  RuleMatchingConfig,
  preprocessRule,
} from "@shared/ruleMatching";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "smartredirect.db");
const RULES_FILE = path.join(DATA_DIR, "rules.json");

export class SqliteStorage implements IStorage {
  private db: Database.Database;
  private jsonFallback: FileStorage;
  private processedRulesCache: ProcessedUrlRule[] | null = null;
  private lastCacheConfig: RuleMatchingConfig | null = null;

  private stmts: {
    getAllRules: Database.Statement;
    getRuleById: Database.Statement;
    getRuleByMatcher: Database.Statement;
    getRuleCount: Database.Statement;
    insertRule: Database.Statement;
    updateRule: Database.Statement;
    deleteRule: Database.Statement;
    deleteAllRules: Database.Statement;
  };

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.db = new Database(DB_FILE);
    this.db.pragma("journal_mode = DELETE");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("locking_mode = EXCLUSIVE");
    this.db.pragma("temp_store = MEMORY");

    this.jsonFallback = new FileStorage();

    this.createRulesTable();

    this.stmts = {
      getAllRules: this.db.prepare("SELECT * FROM rules"),

      getRuleById: this.db.prepare("SELECT * FROM rules WHERE id = ?"),

      getRuleByMatcher: this.db.prepare(
        "SELECT * FROM rules WHERE matcher = ?",
      ),

      getRuleCount: this.db.prepare(
        "SELECT COUNT(*) as count FROM rules",
      ),

      insertRule: this.db.prepare(`
        INSERT INTO rules (id, matcher, target_url, info_text, redirect_type,
            auto_redirect, discard_query_params, kept_query_params, static_query_params,
            forward_query_params, search_and_replace, created_at)
        VALUES (@id, @matcher, @targetUrl, @infoText, @redirectType,
            @autoRedirect, @discardQueryParams, @keptQueryParams, @staticQueryParams,
            @forwardQueryParams, @searchAndReplace, @createdAt)
      `),

      updateRule: this.db.prepare(`
        UPDATE rules SET
            matcher = @matcher, target_url = @targetUrl, info_text = @infoText,
            redirect_type = @redirectType, auto_redirect = @autoRedirect,
            discard_query_params = @discardQueryParams,
            kept_query_params = @keptQueryParams,
            static_query_params = @staticQueryParams,
            forward_query_params = @forwardQueryParams,
            search_and_replace = @searchAndReplace
        WHERE id = @id
      `),

      deleteRule: this.db.prepare("DELETE FROM rules WHERE id = ?"),

      deleteAllRules: this.db.prepare("DELETE FROM rules"),
    };

    this.migrateRulesFromJson();
  }

  private createRulesTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rules (
          id TEXT PRIMARY KEY,
          matcher TEXT NOT NULL,
          target_url TEXT,
          info_text TEXT DEFAULT '',
          redirect_type TEXT NOT NULL DEFAULT 'partial'
              CHECK(redirect_type IN ('wildcard', 'partial', 'domain')),
          auto_redirect INTEGER NOT NULL DEFAULT 0,
          discard_query_params INTEGER NOT NULL DEFAULT 0,
          kept_query_params TEXT DEFAULT '[]',
          static_query_params TEXT DEFAULT '[]',
          forward_query_params INTEGER NOT NULL DEFAULT 0,
          search_and_replace TEXT DEFAULT '[]',
          created_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_matcher ON rules(matcher);
      CREATE INDEX IF NOT EXISTS idx_rules_created_at ON rules(created_at);
    `);
  }

  private migrateRulesFromJson(): void {
    const ruleCount = (
      this.stmts.getRuleCount.get() as { count: number }
    ).count;

    if (ruleCount > 0 || !fs.existsSync(RULES_FILE)) {
      return;
    }

    try {
      const rawRules = JSON.parse(
        fs.readFileSync(RULES_FILE, "utf-8"),
      ) as UrlRule[];

      if (rawRules.length === 0) {
        return;
      }

      const insertAll = this.db.transaction((rules: UrlRule[]) => {
        for (const rule of rules) {
          this.stmts.insertRule.run({
            id: rule.id,
            matcher: rule.matcher,
            targetUrl: rule.targetUrl || null,
            infoText: rule.infoText || "",
            redirectType: rule.redirectType || "partial",
            autoRedirect: rule.autoRedirect ? 1 : 0,
            discardQueryParams: rule.discardQueryParams ? 1 : 0,
            keptQueryParams: JSON.stringify(rule.keptQueryParams || []),
            staticQueryParams: JSON.stringify(rule.staticQueryParams || []),
            forwardQueryParams: rule.forwardQueryParams ? 1 : 0,
            searchAndReplace: JSON.stringify(rule.searchAndReplace || []),
            createdAt: rule.createdAt || new Date().toISOString(),
          });
        }
      });

      insertAll(rawRules);
      console.log(
        `Migrated ${rawRules.length} rules from rules.json to SQLite`,
      );

      fs.renameSync(RULES_FILE, RULES_FILE + ".bak");
    } catch (error) {
      console.error("Failed to migrate rules.json:", error);
    }
  }

  private rowToUrlRule(row: any): UrlRule {
    return {
      id: row.id,
      matcher: row.matcher,
      targetUrl: row.target_url || undefined,
      infoText: row.info_text || "",
      redirectType: row.redirect_type,
      autoRedirect: row.auto_redirect === 1,
      discardQueryParams: row.discard_query_params === 1,
      keptQueryParams: JSON.parse(row.kept_query_params || "[]"),
      staticQueryParams: JSON.parse(row.static_query_params || "[]"),
      forwardQueryParams: row.forward_query_params === 1,
      searchAndReplace: JSON.parse(row.search_and_replace || "[]"),
      createdAt: row.created_at,
    };
  }

  private urlRuleToParams(rule: UrlRule): Record<string, any> {
    return {
      id: rule.id,
      matcher: rule.matcher,
      targetUrl: rule.targetUrl || null,
      infoText: rule.infoText || "",
      redirectType: rule.redirectType,
      autoRedirect: rule.autoRedirect ? 1 : 0,
      discardQueryParams: rule.discardQueryParams ? 1 : 0,
      keptQueryParams: JSON.stringify(rule.keptQueryParams || []),
      staticQueryParams: JSON.stringify(rule.staticQueryParams || []),
      forwardQueryParams: rule.forwardQueryParams ? 1 : 0,
      searchAndReplace: JSON.stringify(rule.searchAndReplace || []),
      createdAt: rule.createdAt,
    };
  }

  async getUrlRules(): Promise<UrlRule[]> {
    const rows = this.stmts.getAllRules.all();

    return rows.map((row: any) => this.rowToUrlRule(row));
  }

  async getCleanUrlRules(): Promise<UrlRule[]> {
    return this.getUrlRules();
  }

  async getProcessedUrlRules(
    config: RuleMatchingConfig,
  ): Promise<ProcessedUrlRule[]> {
    if (this.processedRulesCache && this.lastCacheConfig) {
      const configMatch =
        this.lastCacheConfig.CASE_SENSITIVITY_PATH ===
          config.CASE_SENSITIVITY_PATH &&
        this.lastCacheConfig.CASE_SENSITIVITY_QUERY ===
          config.CASE_SENSITIVITY_QUERY &&
        this.lastCacheConfig.TRAILING_SLASH_POLICY ===
          config.TRAILING_SLASH_POLICY;

      if (configMatch) {
        return this.processedRulesCache;
      }
    }

    const rules = await this.getUrlRules();
    const processed = rules.map((rule) => preprocessRule(rule, config));

    this.processedRulesCache = processed;
    this.lastCacheConfig = config;

    return processed;
  }

  async getUrlRule(id: string): Promise<UrlRule | undefined> {
    const row = this.stmts.getRuleById.get(id) as any;

    return row ? this.rowToUrlRule(row) : undefined;
  }

  async createUrlRule(
    insertRule: InsertUrlRule,
    force: boolean = false,
  ): Promise<UrlRule> {
    if (!force) {
      const existing = this.stmts.getRuleByMatcher.get(
        insertRule.matcher,
      ) as any;

      if (existing) {
        throw new Error(
          `URL-Matcher bereits vorhanden: "${insertRule.matcher}" ` +
            `(existierende Regel-ID: ${existing.id})`,
        );
      }
    }

    const rule: UrlRule = {
      ...insertRule,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    sanitizeRuleFlags(rule);

    this.stmts.insertRule.run(this.urlRuleToParams(rule));

    this.processedRulesCache = null;

    return rule;
  }

  async updateUrlRule(
    id: string,
    updateData: Partial<InsertUrlRule>,
    force: boolean = false,
  ): Promise<UrlRule | undefined> {
    const existingRow = this.stmts.getRuleById.get(id) as any;

    if (!existingRow) {
      return undefined;
    }

    if (!force && updateData.matcher) {
      const duplicate = this.stmts.getRuleByMatcher.get(
        updateData.matcher,
      ) as any;

      if (duplicate && duplicate.id !== id) {
        throw new Error(
          `URL-Matcher bereits vorhanden: "${updateData.matcher}" ` +
            `(existierende Regel-ID: ${duplicate.id})`,
        );
      }
    }

    const existing = this.rowToUrlRule(existingRow);
    const updated: UrlRule = { ...existing, ...updateData };

    sanitizeRuleFlags(updated);

    this.stmts.updateRule.run(this.urlRuleToParams(updated));

    this.processedRulesCache = null;

    return updated;
  }

  async deleteUrlRule(id: string): Promise<boolean> {
    const result = this.stmts.deleteRule.run(id);

    if (result.changes === 0) {
      return false;
    }

    this.processedRulesCache = null;

    return true;
  }

  async bulkDeleteUrlRules(
    ids: string[],
  ): Promise<{ deleted: number; notFound: number }> {
    const placeholders = ids.map(() => "?").join(",");

    const result = this.db
      .prepare(`DELETE FROM rules WHERE id IN (${placeholders})`)
      .run(...ids);

    console.log(
      `ATOMIC BULK DELETE: Requested ${ids.length}, Deleted ${result.changes}, Not found ${ids.length - result.changes}`,
    );

    this.processedRulesCache = null;

    return {
      deleted: result.changes,
      notFound: ids.length - result.changes,
    };
  }

  async clearAllRules(): Promise<void> {
    this.stmts.deleteAllRules.run();
    this.processedRulesCache = null;
  }

  async getUrlRulesPaginated(
    page: number = 1,
    limit: number = 50,
    search?: string,
    sortBy: string = "createdAt",
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<{
    rules: UrlRule[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllRules: number;
  }> {
    const totalAllRules = (
      this.stmts.getRuleCount.get() as { count: number }
    ).count;

    const columnMap: Record<string, string> = {
      createdAt: "created_at",
      matcher: "matcher",
      targetUrl: "target_url",
    };
    const sortColumn = columnMap[sortBy] || "created_at";
    const direction = sortOrder === "asc" ? "ASC" : "DESC";

    let total: number;
    let rows: any[];

    if (search && search.trim()) {
      const searchParam = `%${search.toLowerCase()}%`;

      total = (
        this.db
          .prepare(
            `
            SELECT COUNT(*) as count FROM rules
            WHERE LOWER(matcher) LIKE ?
               OR LOWER(target_url) LIKE ?
               OR LOWER(info_text) LIKE ?
          `,
          )
          .get(searchParam, searchParam, searchParam) as { count: number }
      ).count;

      rows = this.db
        .prepare(
          `
          SELECT * FROM rules
          WHERE LOWER(matcher) LIKE ?
             OR LOWER(target_url) LIKE ?
             OR LOWER(info_text) LIKE ?
          ORDER BY ${sortColumn} ${direction}
          LIMIT ? OFFSET ?
        `,
        )
        .all(
          searchParam,
          searchParam,
          searchParam,
          limit,
          (page - 1) * limit,
        );
    } else {
      total = totalAllRules;

      rows = this.db
        .prepare(
          `SELECT * FROM rules ORDER BY ${sortColumn} ${direction} LIMIT ? OFFSET ?`,
        )
        .all(limit, (page - 1) * limit);
    }

    return {
      rules: rows.map((row) => this.rowToUrlRule(row)),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalAllRules,
    };
  }

  async importUrlRules(
    importRules: any[],
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    let imported = 0;
    let updated = 0;

    const importAll = this.db.transaction(() => {
      for (const rawRule of importRules) {
        if (!rawRule.matcher || !rawRule.targetUrl) {
          continue;
        }

        const importRule = {
          id: rawRule.id,
          matcher: rawRule.matcher,
          targetUrl: rawRule.targetUrl,
          redirectType:
            rawRule.redirectType ||
            (rawRule.type === "redirect" ? "partial" : rawRule.type) ||
            "partial",
          infoText: rawRule.infoText || "",
          autoRedirect: rawRule.autoRedirect ?? false,
          discardQueryParams: rawRule.discardQueryParams ?? false,
          keptQueryParams: rawRule.keptQueryParams || [],
          forwardQueryParams: rawRule.forwardQueryParams ?? false,
          searchAndReplace: rawRule.searchAndReplace || [],
          staticQueryParams: rawRule.staticQueryParams || [],
        };

        let existingRow: any = null;

        if (importRule.id) {
          existingRow = this.stmts.getRuleById.get(importRule.id);
        }

        if (!existingRow) {
          existingRow = this.stmts.getRuleByMatcher.get(importRule.matcher);
        }

        if (existingRow) {
          const existing = this.rowToUrlRule(existingRow);

          const updatedRule: UrlRule = {
            id: existing.id,
            matcher: importRule.matcher,
            targetUrl: importRule.targetUrl,
            redirectType: importRule.redirectType as any,
            infoText: importRule.infoText,
            autoRedirect: importRule.autoRedirect,
            discardQueryParams: importRule.discardQueryParams,
            keptQueryParams: importRule.keptQueryParams,
            forwardQueryParams: importRule.forwardQueryParams,
            searchAndReplace: importRule.searchAndReplace,
            staticQueryParams: importRule.staticQueryParams,
            createdAt: existing.createdAt,
          };

          sanitizeRuleFlags(updatedRule);

          this.stmts.updateRule.run(this.urlRuleToParams(updatedRule));

          updated++;
        } else {
          const newRule: UrlRule = {
            id: importRule.id || randomUUID(),
            matcher: importRule.matcher,
            targetUrl: importRule.targetUrl,
            redirectType: importRule.redirectType as any,
            infoText: importRule.infoText,
            autoRedirect: importRule.autoRedirect,
            discardQueryParams: importRule.discardQueryParams,
            keptQueryParams: importRule.keptQueryParams,
            forwardQueryParams: importRule.forwardQueryParams,
            searchAndReplace: importRule.searchAndReplace,
            staticQueryParams: importRule.staticQueryParams,
            createdAt: new Date().toISOString(),
          };

          sanitizeRuleFlags(newRule);

          this.stmts.insertRule.run(this.urlRuleToParams(newRule));

          imported++;
        }
      }
    });

    importAll();

    this.processedRulesCache = null;

    return { imported, updated, errors: [] };
  }

  async forceCacheRebuild(): Promise<void> {
    console.log("Forcing cache rebuild...");

    this.processedRulesCache = null;
    this.lastCacheConfig = null;

    await this.jsonFallback.forceCacheRebuild();

    console.log("Cache rebuild complete.");
  }

  async clearAllTracking(): Promise<void> {
    return this.jsonFallback.clearAllTracking();
  }

  async trackUrlAccess(
    tracking: InsertUrlTracking,
  ): Promise<UrlTracking> {
    return this.jsonFallback.trackUrlAccess(tracking);
  }

  async updateUrlTracking(
    id: string,
    updates: Partial<UrlTracking>,
  ): Promise<boolean> {
    return this.jsonFallback.updateUrlTracking(id, updates);
  }

  async getTrackingData(
    timeRange?: "24h" | "7d" | "all",
  ): Promise<UrlTracking[]> {
    return this.jsonFallback.getTrackingData(timeRange);
  }

  async getTopUrls(
    limit?: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ path: string; count: number }>> {
    return this.jsonFallback.getTopUrls(limit, timeRange);
  }

  async getTopReferrers(
    limit?: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ domain: string; count: number }>> {
    return this.jsonFallback.getTopReferrers(limit, timeRange);
  }

  async getTrackingStats(): Promise<{
    total: number;
    today: number;
    week: number;
    quality: {
      match100: number;
      match75: number;
      match50: number;
      match0: number;
    };
    feedback: {
      ok: number;
      nok: number;
      autoRedirect: number;
      missing: number;
    };
  }> {
    return this.jsonFallback.getTrackingStats();
  }

  async getSatisfactionTrend(
    days?: number,
    aggregation?: "day" | "week" | "month",
  ): Promise<
    Array<{
      date: string;
      score: number;
      count: number;
      okCount: number;
      autoCount: number;
      nokCount: number;
      avgMatchQuality: number;
      mixedScore: number;
    }>
  > {
    return this.jsonFallback.getSatisfactionTrend(days, aggregation);
  }

  async getAllTrackingEntries(): Promise<UrlTracking[]> {
    return this.jsonFallback.getAllTrackingEntries();
  }

  async searchTrackingEntries(
    query: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
  ): Promise<UrlTracking[]> {
    return this.jsonFallback.searchTrackingEntries(
      query,
      sortBy,
      sortOrder,
    );
  }

  async getTrackingEntriesPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    ruleFilter?: "all" | "with_rule" | "no_rule",
    minQuality?: number,
    maxQuality?: number,
    feedbackFilter?: "all" | "OK" | "NOK" | "empty",
  ): Promise<{
    entries: (UrlTracking & { rule?: UrlRule; rules?: UrlRule[] })[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllEntries: number;
  }> {
    return this.jsonFallback.getTrackingEntriesPaginated(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      ruleFilter,
      minQuality,
      maxQuality,
      feedbackFilter,
    );
  }

  async getTopUrlsPaginated(
    page: number,
    limit: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<{
    urls: Array<{ path: string; count: number }>;
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    return this.jsonFallback.getTopUrlsPaginated(page, limit, timeRange);
  }

  async getGeneralSettings(): Promise<GeneralSettings> {
    return this.jsonFallback.getGeneralSettings();
  }

  async updateGeneralSettings(
    settings: InsertGeneralSettings,
    replaceMode?: boolean,
  ): Promise<GeneralSettings> {
    return this.jsonFallback.updateGeneralSettings(settings, replaceMode);
  }

  async shutdown(): Promise<void> {
    console.log("SqliteStorage shutting down...");

    await this.jsonFallback.shutdown();

    this.db.close();

    console.log("SqliteStorage shutdown complete.");
  }

  //test
}