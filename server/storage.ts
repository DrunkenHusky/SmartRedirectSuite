import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { createDefaultGeneralSettings, getGeneralSettingCategory, normalizeGeneralSettings } from "@shared/generalSettings";
import type {
  UrlRule,
  InsertUrlRule,
  UrlTracking,
  InsertUrlTracking,
  GeneralSettings,
  InsertGeneralSettings,
  ImportUrlRule,
} from "@shared/schema";
import { urlUtils } from "@shared/utils";
import { ProcessedUrlRule, RuleMatchingConfig, preprocessRule } from "@shared/ruleMatching";
import { RULE_MATCHING_CONFIG } from "@shared/constants";
import { sequelize, initDb, UrlRuleModel, UrlTrackingModel, GeneralSettingsModel, GeneralSettingEntryModel } from "./db";
import { Op } from "sequelize";

// Helper to ensure only relevant flags are stored
function sanitizeRuleFlags(rule: any): any {
  if (rule.redirectType === "wildcard") {
    // Wildcard rules can now use both forwardQueryParams (legacy/simple) and discardQueryParams (advanced)
    // No deletion of parameter flags for wildcard
  } else if (rule.redirectType === "partial" || rule.redirectType === "domain") {
    // Partial and domain rules only use discardQueryParams
    delete rule.forwardQueryParams;
  }
  return rule;
}

const DATA_DIR = path.join(process.cwd(), "data");

const URL_RULE_SORT_COLUMNS = new Set([
  "matcher",
  "targetUrl",
  "redirectType",
  "createdAt",
  "autoRedirect",
]);

const URL_TRACKING_SORT_COLUMNS = new Set([
  "timestamp",
  "oldUrl",
  "newUrl",
  "path",
  "referrer",
  "ruleId",
  "feedback",
  "matchQuality",
]);


function normalizeSortOrder(sortOrder: string | undefined): "ASC" | "DESC" {
  return sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";
}

function normalizeSortColumn(sortBy: string | undefined, allowedColumns: Set<string>, fallback: string): string {
  if (sortBy && allowedColumns.has(sortBy)) {
    return sortBy;
  }

  return fallback;
}

function buildCaseInsensitiveLike(columnName: string, query: string) {
  return sequelize.where(
    sequelize.fn("lower", sequelize.col(columnName)),
    { [Op.like]: `%${query.toLowerCase()}%` },
  );
}

export interface IStorage {
  // URL-Regeln
  getUrlRules(): Promise<UrlRule[]>;
  getProcessedUrlRules(config: RuleMatchingConfig): Promise<ProcessedUrlRule[]>;
  getUrlRulesPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
  ): Promise<{
    rules: UrlRule[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllRules: number;
  }>;
  getUrlRule(id: string): Promise<UrlRule | undefined>;
  createUrlRule(rule: InsertUrlRule): Promise<UrlRule>;
  updateUrlRule(
    id: string,
    rule: Partial<InsertUrlRule>,
    force?: boolean,
  ): Promise<UrlRule | undefined>;
  deleteUrlRule(id: string): Promise<boolean>;
  bulkDeleteUrlRules(
    ids: string[],
  ): Promise<{ deleted: number; notFound: number }>;
  clearAllRules(): Promise<void>;

  // URL-Tracking
  clearAllTracking(): Promise<void>;
  trackUrlAccess(tracking: InsertUrlTracking): Promise<UrlTracking>;
  updateUrlTracking(id: string, updates: Partial<UrlTracking>): Promise<boolean>;
  getTrackingData(timeRange?: "24h" | "7d" | "all"): Promise<UrlTracking[]>;
  getTopUrls(
    limit?: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ path: string; count: number }>>;
  getTopReferrers(
    limit?: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ domain: string; count: number }>>;
  getTrackingStats(): Promise<{
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
  }>;

  getSatisfactionTrend(days?: number, aggregation?: 'day' | 'week' | 'month'): Promise<Array<{
    date: string;
    score: number;
    count: number;
    okCount: number;
    autoCount: number;
    nokCount: number;
    avgMatchQuality: number;
    mixedScore: number;
  }>>;

  // Import functionality
  importUrlRules(rules: ImportUrlRule[]): Promise<{ imported: number; updated: number; errors: string[] }>;

  // Enhanced statistics
  getAllTrackingEntries(): Promise<UrlTracking[]>;
  searchTrackingEntries(
    query: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
  ): Promise<UrlTracking[]>;

  // Paginated statistics
  getTrackingEntriesPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    ruleFilter?: 'all' | 'with_rule' | 'no_rule',
    minQuality?: number,
    maxQuality?: number,
    feedbackFilter?: 'all' | 'OK' | 'NOK' | 'auto-redirect' | 'API' | 'empty',
  ): Promise<{
    entries: (UrlTracking & { rule?: UrlRule; rules?: UrlRule[] })[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllEntries: number;
  }>;
  getTopUrlsPaginated(
    page: number,
    limit: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<{
    urls: Array<{ path: string; count: number }>;
    total: number;
    totalPages: number;
    currentPage: number;
  }>;

  // General Settings
  getGeneralSettings(): Promise<GeneralSettings>;
  updateGeneralSettings(
    settings: InsertGeneralSettings,
    replaceMode?: boolean,
  ): Promise<GeneralSettings>;

  // Maintenance
  forceCacheRebuild(): Promise<void>;
}

export class FileStorage implements IStorage {
  private async enforceMaxStatsLimit(limit: number): Promise<void> {
    if (limit <= 0) return;

    const count = await UrlTrackingModel.count();
    if (count > limit) {
      console.log(
        `Pruning tracking data: Limit ${limit}, Current ${count}, Removing ${count - limit} oldest entries.`,
      );
      const removeCount = count - limit;

      // Get IDs of oldest entries to remove
      const oldestEntries = await UrlTrackingModel.findAll({
        order: [['timestamp', 'ASC']],
        limit: removeCount,
        attributes: ['id']
      });

      const idsToRemove = oldestEntries.map(e => e.getDataValue('id'));

      await UrlTrackingModel.destroy({
        where: {
          id: {
            [Op.in]: idsToRemove
          }
        }
      });
    }
  }

  private rulesCache: ProcessedUrlRule[] | null = null;
  private lastCacheConfig: RuleMatchingConfig | null = null;
  private settingsCache: GeneralSettings | null = null;
  private dbInitialized = false;

  constructor() {
    this.ensureDataDirectory();
    this.initDatabase();
  }

  private async ensureDataDirectory() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }


  private initPromise: Promise<void> | null = null;

  private async initDatabase() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await initDb();
        await this.migrateJsonToDb();
        this.dbInitialized = true;
        console.log('Database initialized successfully');
      } catch (err) {
        console.error('Failed to initialize database', err);
      }
    })();

    return this.initPromise;
  }

  private async migrateJsonToDb() {
    const rulesFile = path.join(DATA_DIR, "rules.json");
    const settingsFile = path.join(DATA_DIR, "settings.json");
    const trackingFile = path.join(DATA_DIR, "tracking.json");

    try {
      await fs.access(rulesFile);
      console.log('Migrating rules.json to DB...');
      const data = await fs.readFile(rulesFile, 'utf8');
      const rules = JSON.parse(data);
      if (Array.isArray(rules)) {
        for (const rule of rules) {
           const existing = await UrlRuleModel.findByPk(rule.id);
           if (!existing) {
              await UrlRuleModel.create(rule as any);
           }
        }
      }
      await fs.rename(rulesFile, rulesFile + '.bak');
    } catch (e) {
      // Ignore if file doesn't exist
    }

    try {
      await fs.access(settingsFile);
      console.log('Migrating settings.json to normalized settings entries...');
      const data = await fs.readFile(settingsFile, 'utf8');
      const settings = JSON.parse(data);
      if (settings && typeof settings === 'object') {
        const defaultSettings = createDefaultGeneralSettings();
        const normalizedSettings = normalizeGeneralSettings(
          settings,
          typeof settings.id === 'string' ? settings.id : defaultSettings.id,
        );
        await this.persistGeneralSettingsEntries(normalizedSettings, true);
      }
      await fs.rename(settingsFile, settingsFile + '.bak');
    } catch (e) {
      // Ignore if file doesn't exist
    }

    try {
      await fs.access(trackingFile);
      console.log('Migrating tracking.json to DB...');
      const data = await fs.readFile(trackingFile, 'utf8');
      const tracking = JSON.parse(data);
      if (Array.isArray(tracking)) {
        // Bulk create might fail if there are too many, but typically ok for tracking.
        // Doing it chunked to be safe.
        const chunkSize = 1000;
        for (let i = 0; i < tracking.length; i += chunkSize) {
          const chunk = tracking.slice(i, i + chunkSize);
          await UrlTrackingModel.bulkCreate(chunk as any[], { ignoreDuplicates: true });
        }
      }
      await fs.rename(trackingFile, trackingFile + '.bak');
    } catch (e) {
      // Ignore if file doesn't exist
    }
  }


  private async ensureDbReady() {
    if (!this.dbInitialized) {
      await this.initDatabase();
    }
  }

  private async ensureRulesLoaded(config?: RuleMatchingConfig): Promise<ProcessedUrlRule[]> {
    await this.ensureDbReady();

    const isConfigChanged = !this.lastCacheConfig || !config ||
      this.lastCacheConfig.caseSensitive !== config.caseSensitive;

    if (this.rulesCache && !isConfigChanged) {
      return this.rulesCache;
    }

    try {
      const rulesRows = await UrlRuleModel.findAll();
      const rules = rulesRows.map(r => r.toJSON() as UrlRule);

      if (config) {
        this.rulesCache = rules.map(rule => preprocessRule(rule, config));
        this.lastCacheConfig = config;
      } else {
        const settings = await this.getGeneralSettings();
        const fallbackConfig: RuleMatchingConfig = {
          ...RULE_MATCHING_CONFIG,
          caseSensitive: settings.caseSensitiveLinkDetection
        };
        this.rulesCache = rules.map(rule => preprocessRule(rule, fallbackConfig));
        this.lastCacheConfig = fallbackConfig;
      }
      return this.rulesCache;
    } catch (error) {
      console.error("Error loading rules:", error);
      return [];
    }
  }

  async getCleanUrlRules(): Promise<UrlRule[]> {
    await this.ensureDbReady();
    const rows = await UrlRuleModel.findAll();
    return rows.map(r => {
      const rule = r.toJSON() as UrlRule;
      return sanitizeRuleFlags(rule);
    });
  }

  async getUrlRules(): Promise<UrlRule[]> {
    return this.getCleanUrlRules();
  }

  async getProcessedUrlRules(config: RuleMatchingConfig): Promise<ProcessedUrlRule[]> {
    return this.ensureRulesLoaded(config);
  }

  async getUrlRulesPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy: string = "createdAt",
    sortOrder: "asc" | "desc" = "desc",
  ) {
    await this.ensureDbReady();
    const offset = (page - 1) * limit;

    const whereClause = search
      ? {
          [Op.or]: [
            buildCaseInsensitiveLike("targetUrl", search),
            buildCaseInsensitiveLike("matcher", search),
          ],
        }
      : {};
    const safeSortBy = normalizeSortColumn(sortBy, URL_RULE_SORT_COLUMNS, "createdAt");
    const safeSortOrder = normalizeSortOrder(sortOrder);

    const { count, rows } = await UrlRuleModel.findAndCountAll({
      where: whereClause,
      order: [[safeSortBy, safeSortOrder]],
      limit,
      offset
    });

    const totalAllRules = await UrlRuleModel.count();

    return {
      rules: rows.map(r => r.toJSON() as UrlRule),
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalAllRules,
    };
  }

  async getUrlRule(id: string): Promise<UrlRule | undefined> {
    await this.ensureDbReady();
    const row = await UrlRuleModel.findByPk(id);
    return row ? (row.toJSON() as UrlRule) : undefined;
  }

  async createUrlRule(ruleData: InsertUrlRule): Promise<UrlRule> {
    await this.ensureDbReady();

    // Prevent duplicate matchers
    const existingRule = await UrlRuleModel.findOne({ where: { matcher: ruleData.matcher } });
    if (existingRule) {
      throw new Error("Eine Regel für diesen Matcher existiert bereits.");
    }

    const newRule: UrlRule = {
      ...ruleData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      infoText: ruleData.infoText ?? "",
      autoRedirect: ruleData.autoRedirect ?? false,
      discardQueryParams: ruleData.discardQueryParams ?? false,
      forwardQueryParams: ruleData.forwardQueryParams ?? false,
      keptQueryParams: ruleData.keptQueryParams ?? [],
      searchAndReplace: ruleData.searchAndReplace ?? [],
      staticQueryParams: ruleData.staticQueryParams ?? [],
    };

    sanitizeRuleFlags(newRule);
    await UrlRuleModel.create(newRule as any);
    this.rulesCache = null; // Invalidate cache
    return newRule;
  }

  async updateUrlRule(
    id: string,
    updateData: Partial<InsertUrlRule>,
    force: boolean = false,
  ): Promise<UrlRule | undefined> {
    await this.ensureDbReady();
    const row = await UrlRuleModel.findByPk(id);
    if (!row) return undefined;

    // Check for duplicate matchers if matcher is changing
    if (updateData.matcher && updateData.matcher !== row.getDataValue('matcher')) {
      const duplicateRule = await UrlRuleModel.findOne({ where: { matcher: updateData.matcher } });
      if (duplicateRule && duplicateRule.getDataValue('id') !== id && !force) {
         throw new Error("Eine Regel für diesen Matcher existiert bereits.");
      }
    }

    const existingRule = row.toJSON() as UrlRule;
    const updatedRule: UrlRule = { ...existingRule, ...updateData };

    sanitizeRuleFlags(updatedRule);

    await row.update(updatedRule as any);
    this.rulesCache = null;
    return updatedRule;
  }

  async deleteUrlRule(id: string): Promise<boolean> {
    await this.ensureDbReady();
    const deletedCount = await UrlRuleModel.destroy({ where: { id } });
    if (deletedCount > 0) {
      this.rulesCache = null;
      return true;
    }
    return false;
  }

  async bulkDeleteUrlRules(
    ids: string[],
  ): Promise<{ deleted: number; notFound: number }> {
    await this.ensureDbReady();
    const deletedCount = await UrlRuleModel.destroy({ where: { id: { [Op.in]: ids } } });
    this.rulesCache = null;
    return {
      deleted: deletedCount,
      notFound: ids.length - deletedCount
    };
  }

  async clearAllRules(): Promise<void> {
    await this.ensureDbReady();
    await UrlRuleModel.destroy({ where: {} });
    this.rulesCache = null;
  }

  async clearAllTracking(): Promise<void> {
    await this.ensureDbReady();
    await UrlTrackingModel.destroy({ where: {} });
  }

  async trackUrlAccess(tracking: InsertUrlTracking): Promise<UrlTracking> {
    await this.ensureDbReady();
    const newTracking: UrlTracking = {
      ...tracking,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      searchQueryInfo: tracking.searchQueryInfo,
    };
    await UrlTrackingModel.create(newTracking as any);

    // Check limit
    const settings = await this.getGeneralSettings();
    if (settings.maxStatsEntries && settings.maxStatsEntries > 0) {
      await this.enforceMaxStatsLimit(settings.maxStatsEntries);
    }

    return newTracking;
  }

  async updateUrlTracking(
    id: string,
    updates: Partial<UrlTracking>,
  ): Promise<boolean> {
    await this.ensureDbReady();
    const [updatedCount] = await UrlTrackingModel.update(updates as any, { where: { id } });
    return updatedCount > 0;
  }

  private buildTrackingTimeRangeWhere(timeRange: "24h" | "7d" | "all" = "all") {
    if (timeRange === "all") {
      return {};
    }

    const now = new Date();
    const timeLimit = new Date(now);
    if (timeRange === "24h") {
      timeLimit.setHours(now.getHours() - 24);
    } else if (timeRange === "7d") {
      timeLimit.setDate(now.getDate() - 7);
    }

    return {
      timestamp: { [Op.gte]: timeLimit.toISOString() },
    };
  }

  async getTrackingData(
    timeRange: "24h" | "7d" | "all" = "all",
  ): Promise<UrlTracking[]> {
    await this.ensureDbReady();

    const rows = await UrlTrackingModel.findAll({
      where: this.buildTrackingTimeRangeWhere(timeRange),
      order: [["timestamp", "DESC"]],
    });

    return rows.map(r => r.toJSON() as UrlTracking);
  }

  async getTopUrls(
    limit: number = 10,
    timeRange: "24h" | "7d" | "all" = "all",
  ): Promise<Array<{ path: string; count: number }>> {
    await this.ensureDbReady();

    const whereClause: any = {
      ...this.buildTrackingTimeRangeWhere(timeRange),
      path: {
        [Op.notIn]: ['/', '/?admin=true', '/?logout=true']
      },
    };

    const rows = await UrlTrackingModel.findAll({
      attributes: ['path', [sequelize.fn('COUNT', sequelize.col('path')), 'count']],
      where: whereClause,
      group: ['path'],
      order: [[sequelize.col('count'), 'DESC']],
      limit
    });

    return rows.map(r => ({
      path: r.getDataValue('path'),
      count: Number.parseInt(String(r.getDataValue('count')), 10)
    }));
  }

  async getTopReferrers(
    limit: number = 10,
    timeRange: "24h" | "7d" | "all" = "all",
  ) {
    await this.ensureDbReady();

    let whereClause = {};
    if (timeRange !== "all") {
      const now = new Date();
      const timeLimit = new Date(now);
      if (timeRange === "24h") {
        timeLimit.setHours(now.getHours() - 24);
      } else if (timeRange === "7d") {
        timeLimit.setDate(now.getDate() - 7);
      }
      whereClause = {
        timestamp: { [Op.gte]: timeLimit.toISOString() }
      };
    }

    const trackingData = await UrlTrackingModel.findAll({ where: whereClause });
    const referrers = trackingData
      .map(r => r.getDataValue('referrer'))
      .filter((r) => r && r.length > 0);

    const domains: Record<string, number> = {};
    for (const ref of referrers) {
      try {
        const url = new URL(ref);
        domains[url.hostname] = (domains[url.hostname] || 0) + 1;
      } catch {
        domains[ref] = (domains[ref] || 0) + 1;
      }
    }

    return Object.entries(domains)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getAllTrackingEntries(): Promise<UrlTracking[]> {
    return this.getTrackingData("all");
  }

  async searchTrackingEntries(
    query: string,
    sortBy: string = "timestamp",
    sortOrder: "asc" | "desc" = "desc",
  ) {
    await this.ensureDbReady();
    const safeSortBy = normalizeSortColumn(sortBy, URL_TRACKING_SORT_COLUMNS, "timestamp");
    const safeSortOrder = normalizeSortOrder(sortOrder);

    const rows = await UrlTrackingModel.findAll({
      where: {
        [Op.or]: [
          buildCaseInsensitiveLike("oldUrl", query),
          buildCaseInsensitiveLike("newUrl", query),
          buildCaseInsensitiveLike("path", query),
          buildCaseInsensitiveLike("referrer", query),
        ]
      },
      order: [[safeSortBy, safeSortOrder]]
    });

    return rows.map(r => r.toJSON() as UrlTracking);
  }

  async getTrackingStats() {
    await this.ensureDbReady();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const total = await UrlTrackingModel.count();
    const todayCount = await UrlTrackingModel.count({ where: { timestamp: { [Op.gte]: today.toISOString() } } });
    const weekCount = await UrlTrackingModel.count({ where: { timestamp: { [Op.gte]: lastWeek.toISOString() } } });

    const match100 = await UrlTrackingModel.count({ where: { matchQuality: 100 } });
    const match75 = await UrlTrackingModel.count({ where: { matchQuality: { [Op.gte]: 75, [Op.lt]: 100 } } });
    const match50 = await UrlTrackingModel.count({ where: { matchQuality: { [Op.gte]: 50, [Op.lt]: 75 } } });
    const match0 = await UrlTrackingModel.count({ where: { matchQuality: { [Op.lt]: 50 } } });

    const ok = await UrlTrackingModel.count({ where: { feedback: 'OK' } });
    const nok = await UrlTrackingModel.count({ where: { feedback: 'NOK' } });
    const autoRedirect = await UrlTrackingModel.count({ where: { feedback: 'auto-redirect' } });

    // We get missing feedback by taking total and subtracting others.
    // Not perfect but robust without complex IS NULL queries across dialects
    const missing = total - ok - nok - autoRedirect;

    return {
      total,
      today: todayCount,
      week: weekCount,
      quality: { match100, match75, match50, match0 },
      feedback: { ok, nok, autoRedirect, missing },
    };
  }

  async getSatisfactionTrend(days: number = 30, aggregation: 'day' | 'week' | 'month' = 'day') {
    await this.ensureDbReady();

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await UrlTrackingModel.findAll({
      where: {
        timestamp: { [Op.gte]: startDate.toISOString() }
      }
    });
    const tracking = rows.map(r => r.toJSON() as UrlTracking);

    const periodData = new Map<string, {
      total: number;
      ok: number;
      nok: number;
      auto: number;
      qualitySum: number;
    }>();

    for (const t of tracking) {
      const entryDate = new Date(t.timestamp);
      if (entryDate >= startDate && entryDate <= now) {
        let periodKey: string;

        switch (aggregation) {
          case 'month':
            periodKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'week': {
            const firstDayOfYear = new Date(entryDate.getFullYear(), 0, 1);
            const pastDaysOfYear = (entryDate.getTime() - firstDayOfYear.getTime()) / 86400000;
            const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            periodKey = `${entryDate.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
            break;
          }
          case 'day':
          default:
            periodKey = entryDate.toISOString().split('T')[0];
            break;
        }

        const stats = periodData.get(periodKey) || { total: 0, ok: 0, nok: 0, auto: 0, qualitySum: 0 };
        stats.total++;
        stats.qualitySum += (t.matchQuality || 0);

        if (t.feedback === 'OK') stats.ok++;
        else if (t.feedback === 'NOK') stats.nok++;
        else if (t.feedback === 'auto-redirect') stats.auto++;

        periodData.set(periodKey, stats);
      }
    }

    return Array.from(periodData.entries())
      .map(([date, stats]) => {
        const avgQuality = stats.total > 0 ? stats.qualitySum / stats.total : 0;
        let score = 0;
        let mixedScore = 0;

        if (stats.ok > 0 || stats.nok > 0) {
          score = (stats.ok / (stats.ok + stats.nok)) * 100;
          mixedScore = score;
        } else {
          score = avgQuality;
          mixedScore = avgQuality;
        }

        if (stats.ok > 0 || stats.nok > 0) {
           mixedScore = (score + avgQuality) / 2;
        }

        return {
          date,
          count: stats.total,
          okCount: stats.ok,
          nokCount: stats.nok,
          autoCount: stats.auto,
          avgMatchQuality: avgQuality,
          score,
          mixedScore
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTrackingEntriesPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy: string = "timestamp",
    sortOrder: "asc" | "desc" = "desc",
    ruleFilter: 'all' | 'with_rule' | 'no_rule' = 'all',
    minQuality?: number,
    maxQuality?: number,
    feedbackFilter: 'all' | 'OK' | 'NOK' | 'auto-redirect' | 'API' | 'empty' = 'all'
  ) {
    await this.ensureDbReady();

    const andConditions: any[] = [];

    if (search) {
      andConditions.push({
        [Op.or]: [
          buildCaseInsensitiveLike("oldUrl", search),
          buildCaseInsensitiveLike("newUrl", search),
          buildCaseInsensitiveLike("path", search),
          buildCaseInsensitiveLike("referrer", search),
        ],
      });
    }

    if (ruleFilter === 'with_rule') {
      andConditions.push({
        [Op.or]: [
          { ruleId: { [Op.not]: null } },
          { ruleIds: { [Op.not]: null, [Op.ne]: '[]' } },
        ],
      });
    } else if (ruleFilter === 'no_rule') {
      andConditions.push({
        ruleId: null,
        [Op.or]: [
          { ruleIds: null },
          { ruleIds: '[]' },
        ],
      });
    }

    if (minQuality !== undefined || maxQuality !== undefined) {
      const matchQualityFilter: any = {};
      if (minQuality !== undefined) matchQualityFilter[Op.gte] = minQuality;
      if (maxQuality !== undefined) matchQualityFilter[Op.lte] = maxQuality;
      andConditions.push({ matchQuality: matchQualityFilter });
    }

    if (feedbackFilter !== 'all') {
      andConditions.push(feedbackFilter === 'empty' ? { feedback: null } : { feedback: feedbackFilter });
    }

    const whereClause = andConditions.length > 0 ? { [Op.and]: andConditions } : {};
    const offset = (page - 1) * limit;
    const safeSortBy = normalizeSortColumn(sortBy, URL_TRACKING_SORT_COLUMNS, "timestamp");
    const safeSortOrder = normalizeSortOrder(sortOrder);

    const { count: total, rows } = await UrlTrackingModel.findAndCountAll({
      where: whereClause,
      order: [[safeSortBy, safeSortOrder]],
      limit,
      offset
    });

    const filtered = rows.map(r => r.toJSON() as UrlTracking);

    const rulesRows = await UrlRuleModel.findAll();
    const rules = rulesRows.map(r => r.toJSON() as UrlRule);
    const ruleMap = new Map<string, UrlRule>();
    rules.forEach(r => ruleMap.set(r.id, r));

    const startIndex = 0;
    const endIndex = Math.min(startIndex + limit, total);

    const entriesWithRules = filtered.slice(startIndex, endIndex).map(t => {
      const enriched: any = { ...t };
      enriched.rule = t.ruleId ? ruleMap.get(t.ruleId) : undefined;
      enriched.rules = (t.ruleIds || []).map(id => ruleMap.get(id)).filter(Boolean);
      return enriched;
    });

    return {
      entries: entriesWithRules,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalAllEntries: await UrlTrackingModel.count(),
    };
  }

  async getTopUrlsPaginated(
    page: number,
    limit: number,
    timeRange: "24h" | "7d" | "all" = "all",
  ) {
    const urls = await this.getTopUrls(10000, timeRange);
    const total = urls.length;
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    return {
      urls: urls.slice(startIndex, endIndex),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  async importUrlRules(
    importRules: ImportUrlRule[],
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    await this.ensureDbReady();

    const settings = await this.getGeneralSettings();
    const config: RuleMatchingConfig = {
      ...RULE_MATCHING_CONFIG,
      caseSensitive: settings.caseSensitiveLinkDetection
    };

    let imported = 0;
    let updated = 0;

    // We can do this in memory then bulk create/update,
    // or just one by one. For simplicity and robustness, one by one.

    for (const importRule of importRules) {
      const isEncoded = /%[0-9A-F]{2}/i.test(importRule.matcher);
      if (isEncoded) {
        importRule.matcher = decodeURI(importRule.matcher);
      }

      const existingById = importRule.id ? await UrlRuleModel.findByPk(importRule.id) : null;
      const existingByMatcher = await UrlRuleModel.findOne({ where: { matcher: importRule.matcher } });

      if (existingById && existingById.getDataValue('matcher') !== importRule.matcher && existingByMatcher) {
        // ID exists but matcher overlaps
        const updatedRule = {
          ...existingByMatcher.toJSON(),
          id: existingByMatcher.getDataValue('id'),
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          keptQueryParams: importRule.keptQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
          searchAndReplace: importRule.searchAndReplace,
          staticQueryParams: importRule.staticQueryParams,
        };
        sanitizeRuleFlags(updatedRule);
        await existingByMatcher.update(updatedRule as any);
        updated++;
      } else if (existingById) {
        const updatedRule = {
          ...existingById.toJSON(),
          id: existingById.getDataValue('id'),
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          keptQueryParams: importRule.keptQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
          searchAndReplace: importRule.searchAndReplace,
          staticQueryParams: importRule.staticQueryParams,
        };
        sanitizeRuleFlags(updatedRule);
        await existingById.update(updatedRule as any);
        updated++;
      } else if (importRule.id) {
        const newRule = {
          id: importRule.id,
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          keptQueryParams: importRule.keptQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
          searchAndReplace: importRule.searchAndReplace,
          staticQueryParams: importRule.staticQueryParams,
          createdAt: new Date().toISOString(),
        };
        sanitizeRuleFlags(newRule);
        await UrlRuleModel.create(newRule as any);
        imported++;
      } else if (existingByMatcher) {
         const updatedRule = {
           ...existingByMatcher.toJSON(),
           id: existingByMatcher.getDataValue('id'),
           matcher: importRule.matcher,
           targetUrl: importRule.targetUrl,
           redirectType: importRule.redirectType,
           infoText: importRule.infoText || "",
           autoRedirect: importRule.autoRedirect,
           discardQueryParams: importRule.discardQueryParams,
           keptQueryParams: importRule.keptQueryParams,
           forwardQueryParams: importRule.forwardQueryParams,
           searchAndReplace: importRule.searchAndReplace,
           staticQueryParams: importRule.staticQueryParams,
         };
         sanitizeRuleFlags(updatedRule);
         await existingByMatcher.update(updatedRule as any);
         updated++;
      } else {
        const newRule = {
          id: randomUUID(),
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          keptQueryParams: importRule.keptQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
          searchAndReplace: importRule.searchAndReplace,
          staticQueryParams: importRule.staticQueryParams,
          createdAt: new Date().toISOString(),
        };
        sanitizeRuleFlags(newRule);
        await UrlRuleModel.create(newRule as any);
        imported++;
      }
    }

    this.rulesCache = null; // Invalidate cache

    return { imported, updated, errors: [] };
  }

  private async persistGeneralSettingsEntries(settings: GeneralSettings, replaceMode = false): Promise<void> {
    const entries = Object.entries(settings).map(([key, value]) => ({
      key,
      category: getGeneralSettingCategory(key),
      value,
    }));

    await sequelize.transaction(async (transaction) => {
      if (replaceMode) {
        await GeneralSettingEntryModel.destroy({
          where: {
            key: {
              [Op.notIn]: entries.map((entry) => entry.key),
            },
          },
          transaction,
        });
      }

      for (const entry of entries) {
        await GeneralSettingEntryModel.upsert(entry as any, { transaction });
      }
    });
  }

  private async readLegacyGeneralSettings(): Promise<Partial<GeneralSettings> | null> {
    const row = await GeneralSettingsModel.findOne();
    if (!row) {
      return null;
    }

    const data = row.getDataValue('data');
    if (!data || typeof data !== 'object') {
      return null;
    }

    return data as Partial<GeneralSettings>;
  }

  async getGeneralSettings(): Promise<GeneralSettings> {
    await this.ensureDbReady();
    if (this.settingsCache) return this.settingsCache;

    try {
      const entries = await GeneralSettingEntryModel.findAll();
      const settingsFromEntries = Object.fromEntries(
        entries.map((entry) => [entry.getDataValue('key'), entry.get('value')]),
      ) as Partial<GeneralSettings>;

      if (entries.length > 0) {
        const settingsId = typeof settingsFromEntries.id === 'string' ? settingsFromEntries.id : randomUUID();
        const normalizedSettings = normalizeGeneralSettings(settingsFromEntries, settingsId);
        await this.persistGeneralSettingsEntries(normalizedSettings, true);
        this.settingsCache = normalizedSettings;
        return this.settingsCache;
      }

      const legacySettings = await this.readLegacyGeneralSettings();
      const defaultSettings = createDefaultGeneralSettings();
      const settings = normalizeGeneralSettings(
        legacySettings ?? defaultSettings,
        typeof legacySettings?.id === 'string' ? legacySettings.id : defaultSettings.id,
      );

      await this.persistGeneralSettingsEntries(settings, true);
      this.settingsCache = settings;
      return settings;
    } catch (e) {
      console.error('Error fetching settings, returning defaults', e);
      return createDefaultGeneralSettings();
    }
  }

  async updateGeneralSettings(
    insertSettings: InsertGeneralSettings,
    replaceMode: boolean = false,
  ): Promise<GeneralSettings> {
    await this.ensureDbReady();
    const existingSettings = await this.getGeneralSettings();
    const oldSettings = { ...existingSettings };
    const updatedAt = new Date().toISOString();

    const nextSettings = replaceMode
      ? normalizeGeneralSettings(
          { ...insertSettings, updatedAt },
          existingSettings.id,
        )
      : normalizeGeneralSettings(
          {
            ...existingSettings,
            ...insertSettings,
            updatedAt,
          },
          existingSettings.id,
        );

    const keysToDelete = !replaceMode
      ? Object.entries(insertSettings)
          .filter(([, value]) => value === null)
          .map(([key]) => key)
      : [];

    for (const key of keysToDelete) {
      delete (nextSettings as any)[key];
    }

    await sequelize.transaction(async (transaction) => {
      for (const key of keysToDelete) {
        await GeneralSettingEntryModel.destroy({ where: { key }, transaction });
      }
    });
    await this.persistGeneralSettingsEntries(nextSettings, replaceMode);

    this.settingsCache = nextSettings;

    if (nextSettings.maxStatsEntries && nextSettings.maxStatsEntries > 0) {
      await this.enforceMaxStatsLimit(nextSettings.maxStatsEntries);
    }

    if (
      oldSettings.caseSensitiveLinkDetection !==
      nextSettings.caseSensitiveLinkDetection
    ) {
      this.lastCacheConfig = null;
    }

    return nextSettings;
  }

  async forceCacheRebuild(): Promise<void> {
    console.log("Forcing cache rebuild...");
    this.rulesCache = null;
    this.lastCacheConfig = null;
    this.settingsCache = null;
    await this.ensureRulesLoaded();
    console.log("Cache rebuild complete.");
  }
}

export const storage = new FileStorage();
