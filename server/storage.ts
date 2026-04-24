import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
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
import { sequelize, initDb, UrlRuleModel, UrlTrackingModel, GeneralSettingsModel } from "./db";
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
  importUrlRules(
    rules: ImportUrlRule[],
  ): Promise<{ imported: number; updated: number; errors: string[] }>;

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
    feedbackFilter?: 'all' | 'OK' | 'NOK' | 'API' | 'empty',
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

  private async initDatabase() {
    try {
      await initDb();
      this.dbInitialized = true;
      console.log('Database initialized successfully');
    } catch (err) {
      console.error('Failed to initialize database', err);
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

    let whereClause = {};
    if (search) {
      const searchLower = search.toLowerCase();
      whereClause = {
        [Op.or]: [
          { targetUrl: { [Op.like]: `%${searchLower}%` } },
          { matcher: { [Op.like]: `%${searchLower}%` } }
        ]
      };
    }

    const { count, rows } = await UrlRuleModel.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
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

  async getTrackingData(
    timeRange: "24h" | "7d" | "all" = "all",
  ): Promise<UrlTracking[]> {
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

    const rows = await UrlTrackingModel.findAll({ where: whereClause, order: [['timestamp', 'DESC']] });
    return rows.map(r => r.toJSON() as UrlTracking);
  }

  async getTopUrls(
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

    const rows = await UrlTrackingModel.findAll({
      attributes: ['path', [sequelize.fn('COUNT', sequelize.col('path')), 'count']],
      where: whereClause,
      group: ['path'],
      order: [[sequelize.col('count'), 'DESC']],
      limit
    });

    return rows.map(r => ({
      path: r.getDataValue('path'),
      count: parseInt(r.getDataValue('count'), 10)
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
    const queryLower = query.toLowerCase();

    const rows = await UrlTrackingModel.findAll({
      where: {
        [Op.or]: [
          { oldUrl: { [Op.like]: `%${queryLower}%` } },
          { newUrl: { [Op.like]: `%${queryLower}%` } },
          { path: { [Op.like]: `%${queryLower}%` } },
          { referrer: { [Op.like]: `%${queryLower}%` } }
        ]
      },
      order: [[sortBy, sortOrder.toUpperCase()]]
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
    const rows = await UrlTrackingModel.findAll();
    const tracking = rows.map(r => r.toJSON() as UrlTracking);

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

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
    feedbackFilter: 'all' | 'OK' | 'NOK' | 'API' | 'empty' = 'all'
  ) {
    await this.ensureDbReady();

    let whereClause: any = {};

    if (search) {
      const q = search.toLowerCase();
      whereClause[Op.or] = [
        sequelize.where(sequelize.fn('lower', sequelize.col('oldUrl')), 'LIKE', `%${q}%`),
        sequelize.where(sequelize.fn('lower', sequelize.col('newUrl')), 'LIKE', `%${q}%`),
        sequelize.where(sequelize.fn('lower', sequelize.col('path')), 'LIKE', `%${q}%`),
        sequelize.where(sequelize.fn('lower', sequelize.col('referrer')), 'LIKE', `%${q}%`)
      ];
    }

    if (ruleFilter === 'with_rule') {
      whereClause.ruleId = { [Op.not]: null };
    } else if (ruleFilter === 'no_rule') {
      whereClause.ruleId = null;
    }

    if (minQuality !== undefined || maxQuality !== undefined) {
      whereClause.matchQuality = {};
      if (minQuality !== undefined) whereClause.matchQuality[Op.gte] = minQuality;
      if (maxQuality !== undefined) whereClause.matchQuality[Op.lte] = maxQuality;
    }

    if (feedbackFilter !== 'all') {
      if (feedbackFilter === 'empty') {
         whereClause.feedback = null;
      } else {
         whereClause.feedback = feedbackFilter;
      }
    }

    const offset = (page - 1) * limit;

    const { count: total, rows } = await UrlTrackingModel.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
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
      const enriched = { ...t };
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
      const existingById = importRule.id ? await UrlRuleModel.findByPk(importRule.id) : null;
      const existingByMatcher = await UrlRuleModel.findOne({ where: { matcher: importRule.matcher } });

      const isEncoded = /%[0-9A-F]{2}/i.test(importRule.matcher);
      if (isEncoded) {
        importRule.matcher = decodeURI(importRule.matcher);
      }

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

  async getGeneralSettings(): Promise<GeneralSettings> {
    await this.ensureDbReady();
    if (this.settingsCache) return this.settingsCache;

    const defaultSettings: GeneralSettings = {
        id: randomUUID(),
        headerTitle: "URL Migration Tool",
        headerIcon: "ArrowRightLeft",
        headerBackgroundColor: "#ffffff",
        popupMode: "active",
        mainTitle: "Veralteter Link erkannt",
        mainDescription:
          "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten.",
        mainBackgroundColor: "#ffffff",
        alertIcon: "AlertTriangle",
        alertBackgroundColor: "yellow",
        urlComparisonTitle: "URL-Vergleich",
        urlComparisonIcon: "ArrowRightLeft",
        urlComparisonBackgroundColor: "#ffffff",
        oldUrlLabel: "Alte URL (veraltet)",
        newUrlLabel: "Neue URL (verwenden Sie diese)",
        defaultNewDomain: "https://thisisthenewurl.com/",
        enableCopyButton: true,
        enableOpenButton: true,
        newUrlClickBehavior: "copy",
        copyButtonText: "URL kopieren",
        openButtonText: "In neuem Tab öffnen",
        showUrlButtonText: "Zeige mir die neue URL",
        popupButtonText: "Zeige mir die neue URL",
        specialHintsTitle: "Spezielle Hinweise für diese URL",
        specialHintsDescription:
          "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL.",
        specialHintsIcon: "Info",
        infoTitle: "Zusätzliche Informationen",
        infoTitleIcon: "Info",
        infoItems: ["", "", ""],
        infoIcons: ["Bookmark", "Share2", "Clock"],
        footerCopyright:
          "© 2024 URL Migration Service. Alle Rechte vorbehalten.",
        caseSensitiveLinkDetection: false,
        enableReferrerTracking: true,
        updatedAt: new Date().toISOString(),
        autoRedirect: false,

        // User Feedback Defaults
        enableFeedbackSurvey: false,
        feedbackSurveyTitle: "War die neue URL korrekt?",
        feedbackSurveyQuestion: "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
        feedbackSuccessMessage: "Vielen Dank für deine Rückmeldung.",
        feedbackButtonYes: "Ja, OK",
        feedbackButtonNo: "Nein",

        // Feedback Comment Defaults
        enableFeedbackComment: false,
        feedbackCommentTitle: "Kennen Sie die korrekte URL?",
        feedbackCommentDescription: "Bitte geben Sie die korrekte URL hier ein, damit wir sie korrigieren können.",
        feedbackCommentPlaceholder: "https://...",
        feedbackCommentButton: "Absenden",
      };

    try {
      const row = await GeneralSettingsModel.findOne();
      if (!row) {
        await GeneralSettingsModel.create({
          id: defaultSettings.id,
          data: defaultSettings
        } as any);
        this.settingsCache = defaultSettings;
        return defaultSettings;
      }

      let settings = row.getDataValue('data');
      if (typeof settings === 'string') {
        try {
          settings = JSON.parse(settings);
        } catch(e) {}
      }
      if (!settings.popupMode) {
        settings.popupMode = "active";
      }
      if (typeof settings.enableCopyButton !== "boolean") {
        settings.enableCopyButton = true;
      }
      if (typeof settings.enableOpenButton !== "boolean") {
        settings.enableOpenButton = true;
      }
      if (!settings.newUrlClickBehavior) {
        settings.newUrlClickBehavior = "copy";
      }
      if (typeof settings.caseSensitiveLinkDetection !== "boolean") {
        settings.caseSensitiveLinkDetection = false;
      }
      if (!settings.smartSearchRules && settings.smartSearchRegex) {
        settings.smartSearchRules = [
          { pattern: settings.smartSearchRegex, order: 0 }
        ];
      }
      if (!settings.smartSearchRules) {
        settings.smartSearchRules = [];
      }

      this.settingsCache = { ...defaultSettings, ...settings, id: row.getDataValue('id') };
      return this.settingsCache as GeneralSettings;
    } catch (e) {
      console.error('Error fetching settings, returning defaults', e);
      return defaultSettings;
    }
  }

  async updateGeneralSettings(
    insertSettings: InsertGeneralSettings,
    replaceMode: boolean = false,
  ): Promise<GeneralSettings> {
    await this.ensureDbReady();
    const existingSettings = await this.getGeneralSettings();
    const oldSettings = { ...existingSettings };

    let settings: GeneralSettings;

    if (replaceMode) {
      settings = {
        ...insertSettings,
        id: existingSettings.id,
        updatedAt: new Date().toISOString(),
      } as GeneralSettings;
    } else {
      settings = {
        ...existingSettings,
        ...insertSettings,
        id: existingSettings.id,
        updatedAt: new Date().toISOString(),
      };

      Object.keys(settings).forEach((key) => {
        if (
          insertSettings.hasOwnProperty(key) &&
          (insertSettings as any)[key] === null
        ) {
          delete (settings as any)[key];
        }
      });
    }

    const row = await GeneralSettingsModel.findOne();
    if (row) {
      await row.update({ data: settings } as any);
    } else {
      await GeneralSettingsModel.create({
        id: settings.id,
        data: settings
      } as any);
    }

    this.settingsCache = settings;

    if (settings.maxStatsEntries && settings.maxStatsEntries > 0) {
      await this.enforceMaxStatsLimit(settings.maxStatsEntries);
    }

    if (
      oldSettings.caseSensitiveLinkDetection !==
      settings.caseSensitiveLinkDetection
    ) {
      this.lastCacheConfig = null;
    }

    return settings;
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
