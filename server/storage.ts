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
  getTrackingData(timeRange?: "24h" | "7d" | "all"): Promise<UrlTracking[]>;
  getTopUrls(
    limit?: number,
    timeRange?: "24h" | "7d" | "all",
  ): Promise<Array<{ path: string; count: number }>>;
  getTrackingStats(): Promise<{ total: number; today: number; week: number }>;

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
    excludeNoRule?: boolean,
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
  // Unified cache that holds rules that are processed or will be processed
  // We type it as ProcessedUrlRule[] because we ensure they are processed when loaded
  private rulesCache: ProcessedUrlRule[] | null = null;
  private lastCacheConfig: RuleMatchingConfig | null = null;
  private settingsCache: GeneralSettings | null = null;

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
          // Reprocess existing cache in-place or map
          this.rulesCache = this.rulesCache.map(rule => preprocessRule(rule, config));
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

    // Process rules
    this.rulesCache = rawRules.map(rule => preprocessRule(rule, effectiveConfig!));
    this.lastCacheConfig = effectiveConfig;

    return this.rulesCache;
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

    const trackingData = await this.readJsonFile<UrlTracking>(
      TRACKING_FILE,
      [],
    );
    const tracking: UrlTracking = {
      ...insertTracking,
      id: randomUUID(),
      ruleIds: insertTracking.ruleIds || [],
    };
    trackingData.push(tracking);
    await this.writeJsonFile(TRACKING_FILE, trackingData);
    return tracking;
  }

  async getTrackingData(
    timeRange?: "24h" | "7d" | "all",
  ): Promise<UrlTracking[]> {
    const trackingData = await this.readJsonFile<UrlTracking>(
      TRACKING_FILE,
      [],
    );

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

    return trackingData.filter((track) => new Date(track.timestamp) >= cutoff);
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

  // Enhanced statistics methods
  async getAllTrackingEntries(): Promise<UrlTracking[]> {
    return this.readJsonFile<UrlTracking>(TRACKING_FILE, []);
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
          entry.userAgent?.toLowerCase().includes(searchTerm),
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
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filteredData;
  }

  async getTrackingStats(): Promise<{
    total: number;
    today: number;
    week: number;
  }> {
    const all = await this.getTrackingData("all");
    const today = await this.getTrackingData("24h");
    const week = await this.getTrackingData("7d");

    // Filter out root path "/" from statistics
    return {
      total: all.filter((track) => track.path !== "/").length,
      today: today.filter((track) => track.path !== "/").length,
      week: week.filter((track) => track.path !== "/").length,
    };
  }

  // Paginated statistics methods
  async getTrackingEntriesPaginated(
    page: number = 1,
    limit: number = 50,
    search?: string,
    sortBy: string = "timestamp",
    sortOrder: "asc" | "desc" = "desc",
    excludeNoRule: boolean = false,
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

    // Filter out entries without rules if requested
    if (excludeNoRule) {
      filteredEntries = filteredEntries.filter((entry) => {
        const hasRuleId = !!entry.ruleId;
        const hasRuleIds = Array.isArray(entry.ruleIds) && entry.ruleIds.length > 0;
        return hasRuleId || hasRuleIds;
      });
    }

    if (!search || !search.trim()) {
      // Only sort if not already sorted by searchTrackingEntries
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
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    // Calculate pagination
    const total = filteredEntries.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

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
      this.settingsCache = settings;
      return settings;
    } catch {
      // Return default settings if file doesn't exist
      const defaultSettings: GeneralSettings = {
        id: randomUUID(),
        headerTitle: "URL Migration Tool",
        headerIcon: "ArrowRightLeft",
        headerBackgroundColor: "white",
        popupMode: "active",
        mainTitle: "Veralteter Link erkannt",
        mainDescription:
          "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten.",
        mainBackgroundColor: "white",
        alertIcon: "AlertTriangle",
        alertBackgroundColor: "yellow",
        urlComparisonTitle: "URL-Vergleich",
        urlComparisonIcon: "ArrowRightLeft",
        urlComparisonBackgroundColor: "white",
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
        updatedAt: new Date().toISOString(),
        autoRedirect: false,
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

    // Check if relevant settings changed
    // Invalidate config so cache is reprocessed on next access
    if (oldSettings.caseSensitiveLinkDetection !== settings.caseSensitiveLinkDetection) {
      this.lastCacheConfig = null; // Forces re-evaluation in ensureRulesLoaded
    }

    return settings;
  }

  async forceCacheRebuild(): Promise<void> {
    console.log("Forcing cache rebuild...");
    this.rulesCache = null;
    this.lastCacheConfig = null;
    await this.ensureRulesLoaded();
    console.log("Cache rebuild complete.");
  }
}

export const storage = new FileStorage();
