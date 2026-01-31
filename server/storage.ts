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

// Helper to ensure only relevant flags are stored
function sanitizeRuleFlags(rule: any): any {
  if (rule.redirectType === "wildcard") {
    // Wildcard rules only use forwardQueryParams
    delete rule.discardQueryParams;
  } else if (rule.redirectType === "partial" || rule.redirectType === "domain") {
    // Partial and domain rules only use discardQueryParams
    delete rule.forwardQueryParams;
  }
  return rule;
}

const DATA_DIR = path.join(process.cwd(), "data");
const RULES_FILE = path.join(DATA_DIR, "rules.json");
const TRACKING_FILE = path.join(DATA_DIR, "tracking.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

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
      missing: number;
    };
  }>;

  getSatisfactionTrend(days?: number): Promise<Array<{ date: string; score: number; count: number }>>;

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
    feedbackFilter?: 'all' | 'OK' | 'NOK' | 'empty',
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
  ): Promise<GeneralSettings>;

  // Maintenance
  forceCacheRebuild(): Promise<void>;
}

export class FileStorage implements IStorage {
  private async enforceMaxStatsLimit(limit: number): Promise<void> {
    if (limit <= 0) return;

    const trackingData = await this.ensureTrackingLoaded();
    if (trackingData.length > limit) {
      console.log(
        `Pruning tracking data: Limit ${limit}, Current ${trackingData.length}, Removing ${trackingData.length - limit} oldest entries.`,
      );
      // Remove oldest entries (from the beginning of the array)
      const removeCount = trackingData.length - limit;
      trackingData.splice(0, removeCount);
      await this.writeJsonFile(TRACKING_FILE, trackingData);
    }
  }

  // Unified cache that holds rules that are processed or will be processed
  // We type it as ProcessedUrlRule[] because we ensure they are processed when loaded
  private rulesCache: ProcessedUrlRule[] | null = null;
  private lastCacheConfig: RuleMatchingConfig | null = null;
  private settingsCache: GeneralSettings | null = null;
  private trackingCache: UrlTracking[] | null = null;

  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  private async readJsonFile<T>(
    filePath: string,
    defaultValue: T[],
  ): Promise<T[]> {
    try {
      const stats = await fs.stat(filePath);

      if (stats.size > 10 * 1024 * 1024) {
        const { createReadStream } = await import('fs');

        return new Promise<T[]>((resolve, reject) => {
          let buffer = '';
          const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });

          stream.on('data', (chunk: string | Buffer) => {
            buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
          });

          stream.on('end', () => {
            try {
              const parsed = JSON.parse(buffer);
              resolve(parsed);
            }
            catch (error) {
              reject(error);
            }
          });

          stream.on('error', reject);
        });
      }

      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  private async writeJsonFile<T>(filePath: string, data: T[]): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Helper to ensure rules are loaded and processed
  private async ensureRulesLoaded(config?: RuleMatchingConfig): Promise<ProcessedUrlRule[]> {
    // If we have a cache
    if (this.rulesCache) {
      // Check if we need to reprocess based on config mismatch or invalidation (lastCacheConfig === null)
      if (config) {
        const needsReprocess = !this.lastCacheConfig ||
          this.lastCacheConfig.CASE_SENSITIVITY_PATH !== config.CASE_SENSITIVITY_PATH ||
          this.lastCacheConfig.CASE_SENSITIVITY_QUERY !== config.CASE_SENSITIVITY_QUERY ||
          this.lastCacheConfig.TRAILING_SLASH_POLICY !== config.TRAILING_SLASH_POLICY;

        if (needsReprocess) {
          const BATCH_SIZE = 1000;
          const newCache = new Array(this.rulesCache.length);
          const batches = Math.ceil(this.rulesCache.length / BATCH_SIZE);

          for (let i = 0; i < batches; i++) {
            const start = i * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, this.rulesCache.length);
            const batch = this.rulesCache.slice(start, end);
            const processed = batch.map(rule => preprocessRule(rule, config));

            // Fill the new array at the correct positions
            for (let j = 0; j < processed.length; j++) {
              newCache[start + j] = processed[j];
            }

            if (i < batches - 1) {
              await new Promise(resolve => setImmediate(resolve));
            }
          }

          this.rulesCache = newCache;
          this.lastCacheConfig = config;
        }
      }
      return this.rulesCache;
    }

    // Cache miss: Load from file
    const rawRules = await this.readJsonFile<UrlRule>(RULES_FILE, []);

    // Determine config: use provided or fetch settings to build default
    let effectiveConfig = config;
    if (!effectiveConfig) {
       const settings = await this.getGeneralSettings();
       effectiveConfig = {
         ...RULE_MATCHING_CONFIG,
         CASE_SENSITIVITY_PATH: settings.caseSensitiveLinkDetection,
       };
    }

    const BATCH_SIZE = 1000;
    const processed: ProcessedUrlRule[] = [];

    for (let i = 0; i < rawRules.length; i += BATCH_SIZE) {
      const batch = rawRules.slice(i, i + BATCH_SIZE);
      const processedBatch = batch.map(rule => preprocessRule(rule, effectiveConfig!));
      processed.push(...processedBatch);

      if (i + BATCH_SIZE < rawRules.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // Process rules
    this.rulesCache = processed;
    this.lastCacheConfig = effectiveConfig;

    return this.rulesCache;
  }

  // Helper to ensure tracking data is loaded
  private async ensureTrackingLoaded(): Promise<UrlTracking[]> {
    const settings = await this.getGeneralSettings();
    const useCache = settings.enableTrackingCache ?? true;

    if (useCache && this.trackingCache) {
      return this.trackingCache;
    }

    const data = await this.readJsonFile<UrlTracking>(TRACKING_FILE, []);

    if (useCache) {
      this.trackingCache = data;
    } else {
      // Clear cache if disabled
      this.trackingCache = null;
    }

    return data;
  }

  // Strip computed properties for saving to disk
  private cleanRulesForSave(rules: ProcessedUrlRule[]): UrlRule[] {
    // Also strip internal properties like normalizedPath, queryMap, etc.
    // We use a destructuring approach to remove known internal properties
    return rules.map(rule => {
      // Create a shallow copy to avoid mutation issues if any
      const {
        normalizedPath,
        normalizedQuery,
        queryMap,
        normalizedTarget,
        isRegex,
        regex,
        isDomainMatcher,
        ...cleanRule
      } = rule as any;
      return cleanRule as UrlRule;
    });
  }

  // Public method to get clean rules for export
  async getCleanUrlRules(): Promise<UrlRule[]> {
    const rules = await this.ensureRulesLoaded();
    return this.cleanRulesForSave(rules);
  }

  // URL-Regeln implementierung
  async getUrlRules(): Promise<UrlRule[]> {
    // Return the unified cache (it satisfies UrlRule[])
    return this.ensureRulesLoaded();
  }

  async getProcessedUrlRules(config: RuleMatchingConfig): Promise<ProcessedUrlRule[]> {
    return this.ensureRulesLoaded(config);
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
    const allRules = await this.getUrlRules();
    const totalAllRules = allRules.length;

    // Filter rules based on search
    let filteredRules: UrlRule[];
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredRules = allRules.filter(
        (rule) =>
          rule.matcher.toLowerCase().includes(searchLower) ||
          (rule.targetUrl &&
            rule.targetUrl.toLowerCase().includes(searchLower)) ||
          (rule.infoText && rule.infoText.toLowerCase().includes(searchLower)),
      );
    } else {
      // Create a copy to avoid mutating the cache when sorting
      filteredRules = [...allRules];
    }

    // Sort rules
    filteredRules.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "matcher":
          comparison = a.matcher.localeCompare(b.matcher);
          break;
        case "targetUrl":
          const aTarget = a.targetUrl || "";
          const bTarget = b.targetUrl || "";
          comparison = aTarget.localeCompare(bTarget);
          break;
        case "createdAt":
        default:
          // Optimized: Use string comparison for ISO dates instead of parsing Date objects
          const aDate = a.createdAt || "";
          const bDate = b.createdAt || "";
          if (aDate < bDate) comparison = -1;
          else if (aDate > bDate) comparison = 1;
          else comparison = 0;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    // Calculate pagination
    const total = filteredRules.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRules = filteredRules.slice(startIndex, endIndex);

    return {
      rules: paginatedRules,
      total,
      totalPages,
      currentPage: page,
      totalAllRules,
    };
  }

  async getUrlRule(id: string): Promise<UrlRule | undefined> {
    const rules = await this.getUrlRules();
    return rules.find((rule) => rule.id === id);
  }

  async createUrlRule(
    insertRule: InsertUrlRule,
    force: boolean = false,
  ): Promise<UrlRule> {
    // Ensure loaded so we can check duplicates
    const rules = await this.ensureRulesLoaded();

    // Skip validation if force flag is set
    if (!force) {
      // Validate for duplicates and overlaps
      const validationErrors: string[] = [];

      // Check for exact duplicates
      const existingRuleWithSameMatcher = rules.find(
        (r) => r.matcher === insertRule.matcher,
      );
      if (existingRuleWithSameMatcher) {
        validationErrors.push(
          `URL-Matcher bereits vorhanden: "${insertRule.matcher}" (existierende Regel-ID: ${existingRuleWithSameMatcher.id})`,
        );
      }

      // Check for overlapping patterns
      // Overlapping matchers are allowed and resolved by specificity (length/specificity of match)
      // So we don't block them here.

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join("; "));
      }
    }

    const rawRule: UrlRule = {
      ...insertRule,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    // Sanitize flags based on redirect type
    sanitizeRuleFlags(rawRule);

    // Process the new rule using current config (or default if not loaded, but ensureRulesLoaded called above ensures we have one)
    const config = this.lastCacheConfig || { ...RULE_MATCHING_CONFIG, CASE_SENSITIVITY_PATH: false };
    const processedRule = preprocessRule(rawRule, config);

    // Create copy for modification
    const newRules = [...rules, processedRule];

    // Save cleanly to file
    await this.writeJsonFile(RULES_FILE, this.cleanRulesForSave(newRules));

    // Update cache after successful write
    this.rulesCache = newRules;
    // lastCacheConfig remains valid

    return processedRule;
  }

  async updateUrlRule(
    id: string,
    updateData: Partial<InsertUrlRule>,
    force: boolean = false,
  ): Promise<UrlRule | undefined> {
    const rules = await this.ensureRulesLoaded();
    const index = rules.findIndex((rule) => rule.id === id);
    if (index === -1) return undefined;

    // Skip validation if force flag is set or if matcher is not being updated
    if (!force && updateData.matcher) {
      const validationErrors: string[] = [];

      // Check for exact duplicates (excluding the current rule being updated)
      const existingRuleWithSameMatcher = rules.find(
        (r) => r.matcher === updateData.matcher && r.id !== id,
      );
      if (existingRuleWithSameMatcher) {
        validationErrors.push(
          `URL-Matcher bereits vorhanden: "${updateData.matcher}" (existierende Regel-ID: ${existingRuleWithSameMatcher.id})`,
        );
      }

      // Check for overlapping patterns (excluding the current rule being updated)
      // Overlapping matchers are allowed and resolved by specificity
      // So we don't block them here.

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join("; "));
      }
    }

    // Create shallow copy of rules
    const newRules = [...rules];

    // Create updated rule
    const updatedRaw = { ...newRules[index], ...updateData };

    // Sanitize flags based on redirect type
    sanitizeRuleFlags(updatedRaw);

    // Re-process the updated rule
    const config = this.lastCacheConfig || { ...RULE_MATCHING_CONFIG, CASE_SENSITIVITY_PATH: false };
    newRules[index] = preprocessRule(updatedRaw as UrlRule, config);

    // Save cleanly
    await this.writeJsonFile(RULES_FILE, this.cleanRulesForSave(newRules));

    // Update cache after successful write
    this.rulesCache = newRules;

    return newRules[index];
  }

  async deleteUrlRule(id: string): Promise<boolean> {
    const rules = await this.ensureRulesLoaded();
    const index = rules.findIndex((rule) => rule.id === id);
    if (index === -1) return false;

    // Create shallow copy of rules
    const newRules = [...rules];
    newRules.splice(index, 1);

    await this.writeJsonFile(RULES_FILE, this.cleanRulesForSave(newRules));

    // Update cache after successful write
    this.rulesCache = newRules;

    return true;
  }

  // Atomic bulk delete to prevent race conditions
  async bulkDeleteUrlRules(
    ids: string[],
  ): Promise<{ deleted: number; notFound: number }> {
    const rules = await this.ensureRulesLoaded();
    const idsToDelete = new Set(ids);

    const originalCount = rules.length;
    const filteredRules = rules.filter((rule) => !idsToDelete.has(rule.id));
    const deletedCount = originalCount - filteredRules.length;
    const notFoundCount = ids.length - deletedCount;

    console.log(
      `ATOMIC BULK DELETE: Original ${originalCount}, Requested ${ids.length}, Deleted ${deletedCount}, Not found ${notFoundCount}`,
    );

    // Single atomic write operation
    await this.writeJsonFile(RULES_FILE, this.cleanRulesForSave(filteredRules));

    // Update cache after successful write
    this.rulesCache = filteredRules;

    return { deleted: deletedCount, notFound: notFoundCount };
  }

  async clearAllRules(): Promise<void> {
    await this.writeJsonFile(RULES_FILE, []);
    // Update cache after successful write
    this.rulesCache = [];
    // Cache config stays valid for empty array
  }

  // URL-Tracking implementierung
  async clearAllTracking(): Promise<void> {
    await this.writeJsonFile(TRACKING_FILE, []);
    this.trackingCache = [];
  }

  async trackUrlAccess(
    insertTracking: InsertUrlTracking,
  ): Promise<UrlTracking> {
    // Skip tracking for root path "/"
    if (insertTracking.path === "/") {
      return {
        ...insertTracking,
        id: randomUUID(),
        ruleIds: insertTracking.ruleIds || [],
      };
    }

    const trackingData = await this.ensureTrackingLoaded();
    const tracking: UrlTracking = {
      ...insertTracking,
      id: randomUUID(),
      ruleIds: insertTracking.ruleIds || [],
    };

    // In strict non-cache mode, ensureTrackingLoaded returns a new array from disk
    // In cache mode, it returns the cache reference

    // Check for max stats entries limit
    const settings = await this.getGeneralSettings();
    const maxEntries = settings.maxStatsEntries || 0;

    trackingData.push(tracking);

    // Apply limit if configured (and greater than 0)
    if (maxEntries > 0 && trackingData.length > maxEntries) {
      // Remove oldest entries to fit the limit
      // Since new entries are pushed to the end, we remove from the beginning
      const removeCount = trackingData.length - maxEntries;
      trackingData.splice(0, removeCount);
    }

    // If cache is disabled, we need to ensure we don't keep the reference if we obtained it from ensureTrackingLoaded
    // But ensureTrackingLoaded handles clearing this.trackingCache if disabled.
    // However, if we just pushed to 'trackingData', and it WAS the cache, we are good.
    // If it WAS NOT the cache (fresh load), we are also good for the write.

    await this.writeJsonFile(TRACKING_FILE, trackingData);
    return tracking;
  }

  async updateUrlTracking(
    id: string,
    updates: Partial<UrlTracking>,
  ): Promise<boolean> {
    const trackingData = await this.ensureTrackingLoaded();
    const index = trackingData.findIndex((t) => t.id === id);

    if (index === -1) {
      return false;
    }

    const entry = trackingData[index];
    const updatedEntry = { ...entry, ...updates };

    // Update the entry in place
    trackingData[index] = updatedEntry;

    // Persist changes
    await this.writeJsonFile(TRACKING_FILE, trackingData);
    return true;
  }

  async getTrackingData(
    timeRange?: "24h" | "7d" | "all",
  ): Promise<UrlTracking[]> {
    const trackingData = await this.ensureTrackingLoaded();

    if (!timeRange || timeRange === "all") {
      return trackingData;
    }

    const now = new Date();
    const cutoff = new Date();

    if (timeRange === "24h") {
      cutoff.setHours(now.getHours() - 24);
    } else if (timeRange === "7d") {
      cutoff.setDate(now.getDate() - 7);
    }

    const cutoffIso = cutoff.toISOString();
    return trackingData.filter((track) => track.timestamp >= cutoffIso);
  }

  async getTopUrls(
    limit = 10,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ path: string; count: number }>> {
    const trackingData = await this.getTrackingData(timeRange);
    const pathCounts = new Map<string, number>();

    // Filter out root path "/" and admin access "/?admin=true" from statistics
    trackingData.forEach((track) => {
      if (track.path !== "/" && track.path !== "/?admin=true") {
        const current = pathCounts.get(track.path) || 0;
        pathCounts.set(track.path, current + 1);
      }
    });

    return Array.from(pathCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getTopReferrers(
    limit = 10,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ domain: string; count: number }>> {
    const trackingData = await this.getTrackingData(timeRange);
    const domainCounts = new Map<string, number>();

    trackingData.forEach((track) => {
      if (track.referrer) {
        // Use robust extraction
        const hostname = urlUtils.extractHostname(track.referrer);
        if (hostname) {
          const current = domainCounts.get(hostname) || 0;
          domainCounts.set(hostname, current + 1);
        }
      }
    });

    return Array.from(domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // Enhanced statistics methods
  async getAllTrackingEntries(): Promise<UrlTracking[]> {
    const tracking = await this.ensureTrackingLoaded();
    return [...tracking];
  }

  async searchTrackingEntries(
    query: string,
    sortBy: string = "timestamp",
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<UrlTracking[]> {
    const trackingData = await this.getAllTrackingEntries();

    // Filter out root path "/" and then apply search query
    let filteredData = trackingData.filter((entry) => entry.path !== "/");

    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filteredData = filteredData.filter(
        (entry) =>
          entry.oldUrl.toLowerCase().includes(searchTerm) ||
          ((entry as any).newUrl &&
            (entry as any).newUrl.toLowerCase().includes(searchTerm)) ||
          entry.path.toLowerCase().includes(searchTerm) ||
          entry.userAgent?.toLowerCase().includes(searchTerm) ||
          entry.referrer?.toLowerCase().includes(searchTerm),
      );
    }

    // Sort data
    filteredData.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "timestamp":
        default:
           // Optimized: Use string comparison for ISO dates
           const tA = a.timestamp || "";
           const tB = b.timestamp || "";
           if (tA < tB) comparison = -1;
           else if (tA > tB) comparison = 1;
           break;
        case "oldUrl":
           comparison = a.oldUrl.toLowerCase().localeCompare(b.oldUrl.toLowerCase());
           break;
        case "newUrl":
           comparison = ((a as any).newUrl || "").toLowerCase().localeCompare(((b as any).newUrl || "").toLowerCase());
           break;
        case "path":
           comparison = a.path.toLowerCase().localeCompare(b.path.toLowerCase());
           break;
        case "userAgent":
           comparison = (a.userAgent || "").toLowerCase().localeCompare((b.userAgent || "").toLowerCase());
           break;
        case "referrer":
           comparison = (a.referrer || "").toLowerCase().localeCompare((b.referrer || "").toLowerCase());
           break;
        case "matchQuality":
           comparison = (a.matchQuality || 0) - (b.matchQuality || 0);
           break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filteredData;
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
      missing: number;
    };
  }> {
    const trackingData = await this.ensureTrackingLoaded();
    const now = new Date();

    const todayCutoff = new Date();
    todayCutoff.setHours(now.getHours() - 24);
    const todayIso = todayCutoff.toISOString();

    const weekCutoff = new Date();
    weekCutoff.setDate(now.getDate() - 7);
    const weekIso = weekCutoff.toISOString();

    let total = 0;
    let today = 0;
    let week = 0;

    const quality = {
      match100: 0,
      match75: 0,
      match50: 0,
      match0: 0,
    };

    const feedback = {
      ok: 0,
      nok: 0,
      missing: 0,
    };

    for (const track of trackingData) {
      if (track.path === "/") continue;

      total++;

      // Optimization: Use string comparison for ISO dates to avoid Date parsing overhead
      if (track.timestamp >= todayIso) today++;
      if (track.timestamp >= weekIso) week++;

      // Quality stats
      const q = typeof track.matchQuality === 'number' ? track.matchQuality : 0;
      if (q >= 100) quality.match100++;
      else if (q >= 75) quality.match75++;
      else if (q >= 50) quality.match50++;
      else quality.match0++;

      // Feedback stats
      if (track.feedback === 'OK') feedback.ok++;
      else if (track.feedback === 'NOK') feedback.nok++;
      else feedback.missing++;
    }

    return { total, today, week, quality, feedback };
  }

  async getSatisfactionTrend(days: number = 30): Promise<Array<{ date: string; score: number; count: number }>> {
    const trackingData = await this.ensureTrackingLoaded();
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);
    // Reset time part to ensure full day coverage
    cutoffDate.setHours(0, 0, 0, 0);
    const cutoffIso = cutoffDate.toISOString();

    // Filter data by time range
    const filteredData = trackingData.filter(t => t.timestamp >= cutoffIso && t.path !== "/");

    // Group by date (YYYY-MM-DD)
    const dailyStats = new Map<string, { totalScore: number; count: number }>();

    for (const track of filteredData) {
      // Extract date part YYYY-MM-DD
      const date = track.timestamp.substring(0, 10);

      let entryScore = typeof track.matchQuality === 'number' ? track.matchQuality : 0;

      // Feedback overrides quality if present
      if (track.feedback === 'OK') {
        entryScore = 100;
      } else if (track.feedback === 'NOK') {
        entryScore = 0;
      }
      // If no feedback, use matchQuality as the score

      const current = dailyStats.get(date) || { totalScore: 0, count: 0 };
      dailyStats.set(date, {
        totalScore: current.totalScore + entryScore,
        count: current.count + 1
      });
    }

    // Convert map to sorted array and fill missing days
    const result: Array<{ date: string; score: number; count: number }> = [];

    // Create array of all dates in range
    for (let i = 0; i <= days; i++) {
        const d = new Date(cutoffDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().substring(0, 10);

        // Stop if future
        if (d > now && dateStr !== now.toISOString().substring(0, 10)) break;

        const stats = dailyStats.get(dateStr);
        if (stats) {
            result.push({
                date: dateStr,
                score: Math.round(stats.totalScore / stats.count),
                count: stats.count
            });
        } else {
            result.push({
                date: dateStr,
                score: 0,
                count: 0
            });
        }
    }

    return result;
  }

  // Paginated statistics methods
  async getTrackingEntriesPaginated(
    page: number = 1,
    limit: number = 50,
    search?: string,
    sortBy: string = "timestamp",
    sortOrder: "asc" | "desc" = "desc",
    ruleFilter: 'all' | 'with_rule' | 'no_rule' = 'all',
    minQuality?: number,
    maxQuality?: number,
    feedbackFilter: 'all' | 'OK' | 'NOK' | 'empty' = 'all',
  ): Promise<{
    entries: (UrlTracking & { rule?: UrlRule; rules?: UrlRule[] })[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllEntries: number;
  }> {
    const allEntries = await this.getAllTrackingEntries();
    const totalAllEntries = allEntries.length;

    // Filter entries based on search
    let filteredEntries =
      search && search.trim()
        ? await this.searchTrackingEntries(search, sortBy, sortOrder)
        : allEntries.filter((entry) => entry.path !== "/"); // Filter root path

    // Filter based on match quality
    if (minQuality !== undefined) {
      filteredEntries = filteredEntries.filter(
        (entry) => {
          const q = typeof entry.matchQuality === 'number' ? entry.matchQuality : Number(entry.matchQuality || 0);
          return q >= minQuality;
        }
      );
    }
    if (maxQuality !== undefined) {
      filteredEntries = filteredEntries.filter(
        (entry) => {
          const q = typeof entry.matchQuality === 'number' ? entry.matchQuality : Number(entry.matchQuality || 0);
          return q <= maxQuality;
        }
      );
    }

    // Filter based on rule presence
    if (ruleFilter === 'with_rule') {
      filteredEntries = filteredEntries.filter((entry) => {
        const hasRuleId = !!entry.ruleId;
        const hasRuleIds = Array.isArray(entry.ruleIds) && entry.ruleIds.length > 0;
        return hasRuleId || hasRuleIds;
      });
    } else if (ruleFilter === 'no_rule') {
      filteredEntries = filteredEntries.filter((entry) => {
        const hasRuleId = !!entry.ruleId;
        const hasRuleIds = Array.isArray(entry.ruleIds) && entry.ruleIds.length > 0;
        return !hasRuleId && !hasRuleIds;
      });
    }

    // Filter based on feedback
    if (feedbackFilter !== 'all') {
      filteredEntries = filteredEntries.filter((entry) => {
        if (feedbackFilter === 'empty') {
          return !entry.feedback;
        }
        return entry.feedback === feedbackFilter;
      });
    }

    // Optimization: If sorting by timestamp (default), avoid the expensive sort operation
    // because the data is already in chronological order (ascending)
    let paginatedEntries: typeof filteredEntries;
    const total = filteredEntries.length;
    const totalPages = Math.ceil(total / limit);

    if ((!search || !search.trim()) && (sortBy === "timestamp" || !sortBy)) {
      // Data is already sorted ASC by timestamp
      if (sortOrder === "desc") {
        // We want the end of the array (newest items)
        // For page 1: last 'limit' items
        // For page 2: items before that
        const startFromEnd = total - ((page - 1) * limit);
        const endFromEnd = total - (page * limit);

        // Ensure indices are within bounds
        const sliceEnd = Math.max(0, startFromEnd);
        const sliceStart = Math.max(0, endFromEnd);

        // Slice and reverse to get DESC order
        paginatedEntries = filteredEntries.slice(sliceStart, sliceEnd).reverse();
      } else {
        // ASC order - standard pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        paginatedEntries = filteredEntries.slice(startIndex, endIndex);
      }
    } else if (!search || !search.trim()) {
      // Only sort if not already sorted by searchTrackingEntries and not handled by optimization above
      filteredEntries.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "timestamp":
          default:
            // Optimized: Use string comparison for ISO dates
            const tA = a.timestamp || "";
            const tB = b.timestamp || "";
            if (tA < tB) comparison = -1;
            else if (tA > tB) comparison = 1;
            break;
          case "oldUrl":
            comparison = a.oldUrl.toLowerCase().localeCompare(b.oldUrl.toLowerCase());
            break;
          case "newUrl":
            comparison = ((a as any).newUrl || "").toLowerCase().localeCompare(((b as any).newUrl || "").toLowerCase());
            break;
          case "path":
            comparison = a.path.toLowerCase().localeCompare(b.path.toLowerCase());
            break;
          case "referrer":
            comparison = (a.referrer || "").toLowerCase().localeCompare((b.referrer || "").toLowerCase());
            break;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });

      // Calculate pagination for sorted data
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      paginatedEntries = filteredEntries.slice(startIndex, endIndex);
    } else {
      // Was already sorted by searchTrackingEntries
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      paginatedEntries = filteredEntries.slice(startIndex, endIndex);
    }

    // Enrich with rule information
    const rules = await this.getUrlRules();
    const rulesMap = new Map(rules.map((r) => [r.id, r]));

    const enrichedEntries = paginatedEntries.map((entry) => {
      const enriched: UrlTracking & { rule?: UrlRule; rules?: UrlRule[] } = { ...entry };

      // Legacy single rule support
      if (entry.ruleId && rulesMap.has(entry.ruleId)) {
        enriched.rule = rulesMap.get(entry.ruleId);
      }

      // Multiple rules support
      if (entry.ruleIds && entry.ruleIds.length > 0) {
        enriched.rules = entry.ruleIds
          .map(id => rulesMap.get(id))
          .filter((r): r is UrlRule => r !== undefined);
      } else if (entry.ruleId && rulesMap.has(entry.ruleId)) {
        // Fallback: populate rules array from single ruleId for consistent UI handling
        enriched.rules = [rulesMap.get(entry.ruleId)!];
      } else {
        enriched.rules = [];
      }

      return enriched;
    });

    return {
      entries: enrichedEntries,
      total,
      totalPages,
      currentPage: page,
      totalAllEntries,
    };
  }

  async getTopUrlsPaginated(
    page: number = 1,
    limit: number = 50,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<{
    urls: Array<{ path: string; count: number }>;
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    const allUrls = await this.getTopUrls(10000, timeRange); // Get a large number first

    // Calculate pagination
    const total = allUrls.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUrls = allUrls.slice(startIndex, endIndex);

    return {
      urls: paginatedUrls,
      total,
      totalPages,
      currentPage: page,
    };
  }

  // Import functionality implementierung
  async importUrlRules(
    importRules: any[],
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    // Ensure loaded
    const existingRules = await this.ensureRulesLoaded();

    // Create shallow copy to avoid mutating the cache directly
    const newRules = [...existingRules];

    // Create indices for fast lookup
    const rulesById = new Map<string, number>();
    const rulesByMatcher = new Map<string, number>();

    // Initialize indices
    newRules.forEach((rule, index) => {
      rulesById.set(rule.id, index);
      rulesByMatcher.set(rule.matcher, index);
    });

    let imported = 0;
    let updated = 0;

    // Config for processing imported rules
    const config = this.lastCacheConfig || { ...RULE_MATCHING_CONFIG, CASE_SENSITIVITY_PATH: false };

    // Skip all validation - import rules as provided

    for (const rawRule of importRules) {
      // Skip invalid rules
      if (!rawRule.matcher || !rawRule.targetUrl) {
        continue;
      }

      // Handle field mapping for different import formats
      const importRule = {
        id: rawRule.id,
        matcher: rawRule.matcher,
        targetUrl: rawRule.targetUrl,
        redirectType:
          rawRule.redirectType ||
          (rawRule.type === "redirect" ? "partial" : rawRule.type) ||
          "partial", // Handle both field names
        infoText: rawRule.infoText || "",
        autoRedirect: rawRule.autoRedirect ?? false,
        discardQueryParams: rawRule.discardQueryParams ?? false,
        forwardQueryParams: rawRule.forwardQueryParams ?? false,
      };

      if (importRule.id && rulesById.has(importRule.id)) {
        // Update existing rule by ID
        const index = rulesById.get(importRule.id)!;
        const existingRule = newRules[index];

        // Remove old matcher from index if it changed
        if (existingRule.matcher !== importRule.matcher) {
          rulesByMatcher.delete(existingRule.matcher);
        }

        const updatedRule: UrlRule = {
          id: importRule.id,
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          createdAt: existingRule.createdAt,
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
        };

        // Sanitize flags
        sanitizeRuleFlags(updatedRule);

        newRules[index] = preprocessRule(updatedRule, config);
        // Update matcher index
        rulesByMatcher.set(importRule.matcher, index);
        updated++;
      } else if (importRule.id) {
         // ID provided but not found - create new
         const newRule: UrlRule = {
          id: importRule.id,
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
          createdAt: new Date().toISOString(),
        };
        // Sanitize flags
        sanitizeRuleFlags(newRule);

        const newIndex = newRules.push(preprocessRule(newRule, config)) - 1;
        rulesById.set(newRule.id, newIndex);
        rulesByMatcher.set(newRule.matcher, newIndex);
        imported++;
      } else if (rulesByMatcher.has(importRule.matcher)) {
         // No ID, but matcher exists - update
         const index = rulesByMatcher.get(importRule.matcher)!;
         const existingRule = newRules[index];

         const updatedRule: UrlRule = {
           id: existingRule.id,
           matcher: importRule.matcher,
           targetUrl: importRule.targetUrl,
           redirectType: importRule.redirectType,
           infoText: importRule.infoText || "",
           createdAt: existingRule.createdAt,
           autoRedirect: importRule.autoRedirect,
           discardQueryParams: importRule.discardQueryParams,
           forwardQueryParams: importRule.forwardQueryParams,
         };

         // Sanitize flags
         sanitizeRuleFlags(updatedRule);

         newRules[index] = preprocessRule(updatedRule, config);
         // Matcher index is already correct
         updated++;
      } else {
        // Create new rule with generated ID
        const newRule: UrlRule = {
          id: randomUUID(),
          matcher: importRule.matcher,
          targetUrl: importRule.targetUrl,
          redirectType: importRule.redirectType,
          infoText: importRule.infoText || "",
          autoRedirect: importRule.autoRedirect,
          discardQueryParams: importRule.discardQueryParams,
          forwardQueryParams: importRule.forwardQueryParams,
          createdAt: new Date().toISOString(),
        };
        // Sanitize flags
        sanitizeRuleFlags(newRule);

        const newIndex = newRules.push(preprocessRule(newRule, config)) - 1;
        rulesById.set(newRule.id, newIndex);
        rulesByMatcher.set(newRule.matcher, newIndex);
        imported++;
      }
    }

    // Save all rules back to file
    await this.writeJsonFile(RULES_FILE, this.cleanRulesForSave(newRules));

    // Update cache after successful write
    this.rulesCache = newRules;

    return { imported, updated, errors: [] };
  }

  // Helper method to check if two URL matchers are overlapping
  // General Settings implementierung
  async getGeneralSettings(): Promise<GeneralSettings> {
    if (this.settingsCache) return this.settingsCache;

    try {
      const data = await fs.readFile(SETTINGS_FILE, "utf-8");
      const settings = JSON.parse(data);
      if (!settings.popupMode) {
        settings.popupMode = "active";
      }
      if (typeof settings.caseSensitiveLinkDetection !== "boolean") {
        settings.caseSensitiveLinkDetection = false;
      }
      // Migration: Convert old smartSearchRegex to new smartSearchRules
      if (!settings.smartSearchRules && settings.smartSearchRegex) {
        settings.smartSearchRules = [
          { pattern: settings.smartSearchRegex, order: 0 }
        ];
      }
      // Ensure smartSearchRules is initialized
      if (!settings.smartSearchRules) {
        settings.smartSearchRules = [];
      }
      this.settingsCache = settings;
      return settings;
    } catch {
      // Return default settings if file doesn't exist
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
      };

      // Save default settings directly to avoid infinite loop
      await fs.writeFile(
        SETTINGS_FILE,
        JSON.stringify(defaultSettings, null, 2),
      );
      this.settingsCache = defaultSettings;
      return defaultSettings;
    }
  }

  async updateGeneralSettings(
    insertSettings: InsertGeneralSettings,
    replaceMode: boolean = false,
  ): Promise<GeneralSettings> {
    // Get existing settings to preserve ID and any fields not being updated
    const existingSettings = await this.getGeneralSettings();
    const oldSettings = { ...existingSettings };

    let settings: GeneralSettings;

    if (replaceMode) {
      // In replace mode, use only the provided settings plus required fields
      settings = {
        ...insertSettings,
        id: existingSettings.id, // Always keep the existing ID
        updatedAt: new Date().toISOString(),
      } as GeneralSettings;
    } else {
      // In merge mode (default), merge with existing settings
      settings = {
        ...existingSettings,
        ...insertSettings,
        id: existingSettings.id, // Keep the existing ID
        updatedAt: new Date().toISOString(),
      };

      // Remove any undefined or null properties when explicitly set to null
      Object.keys(settings).forEach((key) => {
        if (
          insertSettings.hasOwnProperty(key) &&
          (insertSettings as any)[key] === null
        ) {
          delete (settings as any)[key];
        }
      });
    }

    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    this.settingsCache = settings;

    // Check if maxStatsEntries changed and needs enforcement
    if (settings.maxStatsEntries && settings.maxStatsEntries > 0) {
      await this.enforceMaxStatsLimit(settings.maxStatsEntries);
    }

    // Check if relevant settings changed
    // Invalidate config so cache is reprocessed on next access
    if (
      oldSettings.caseSensitiveLinkDetection !==
      settings.caseSensitiveLinkDetection
    ) {
      this.lastCacheConfig = null; // Forces re-evaluation in ensureRulesLoaded
    }

    return settings;
  }

  async forceCacheRebuild(): Promise<void> {
    console.log("Forcing cache rebuild...");
    this.rulesCache = null;
    this.lastCacheConfig = null;
    this.trackingCache = null;
    await this.ensureRulesLoaded();
    console.log("Cache rebuild complete.");
  }
}

export const storage = new FileStorage();
