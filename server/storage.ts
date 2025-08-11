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
  ImportUrlRule
} from "@shared/schema";

const DATA_DIR = path.join(process.cwd(), 'data');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');
const TRACKING_FILE = path.join(DATA_DIR, 'tracking.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export interface IStorage {
  // URL-Regeln
  getUrlRules(): Promise<UrlRule[]>;
  getUrlRulesPaginated(page: number, limit: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    rules: UrlRule[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllRules: number;
  }>;
  getUrlRule(id: string): Promise<UrlRule | undefined>;
  createUrlRule(rule: InsertUrlRule): Promise<UrlRule>;
  updateUrlRule(id: string, rule: Partial<InsertUrlRule>): Promise<UrlRule | undefined>;
  deleteUrlRule(id: string): Promise<boolean>;
  bulkDeleteUrlRules(ids: string[]): Promise<{deleted: number, notFound: number}>;
  clearAllRules(): Promise<void>;
  
  // URL-Tracking
  trackUrlAccess(tracking: InsertUrlTracking): Promise<UrlTracking>;
  getTrackingData(timeRange?: '24h' | '7d' | 'all'): Promise<UrlTracking[]>;
  getTopUrls(limit?: number, timeRange?: '24h' | '7d' | 'all'): Promise<Array<{path: string, count: number}>>;
  getTrackingStats(): Promise<{total: number, today: number, week: number}>;

  // Import functionality
  importUrlRules(rules: ImportUrlRule[]): Promise<{imported: number, updated: number, errors: string[]}>;
  
  // Enhanced statistics
  getAllTrackingEntries(): Promise<UrlTracking[]>;
  searchTrackingEntries(query: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<UrlTracking[]>;
  
  // Paginated statistics
  getTrackingEntriesPaginated(page: number, limit: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    entries: UrlTracking[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllEntries: number;
  }>;
  getTopUrlsPaginated(page: number, limit: number, timeRange?: '24h' | '7d' | 'all'): Promise<{
    urls: Array<{path: string, count: number}>;
    total: number;
    totalPages: number;
    currentPage: number;
  }>;
  
  // General Settings
  getGeneralSettings(): Promise<GeneralSettings>;
  updateGeneralSettings(settings: InsertGeneralSettings): Promise<GeneralSettings>;
}

export class FileStorage implements IStorage {
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

  private async readJsonFile<T>(filePath: string, defaultValue: T[]): Promise<T[]> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  private async writeJsonFile<T>(filePath: string, data: T[]): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // URL-Regeln implementierung
  async getUrlRules(): Promise<UrlRule[]> {
    return this.readJsonFile<UrlRule>(RULES_FILE, []);
  }

  async getUrlRulesPaginated(
    page: number = 1, 
    limit: number = 50, 
    search?: string, 
    sortBy: string = 'createdAt', 
    sortOrder: 'asc' | 'desc' = 'desc'
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
    let filteredRules = allRules;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredRules = allRules.filter(rule => 
        rule.matcher.toLowerCase().includes(searchLower) ||
        (rule.targetUrl && rule.targetUrl.toLowerCase().includes(searchLower)) ||
        (rule.infoText && rule.infoText.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort rules
    filteredRules.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'matcher':
          comparison = a.matcher.localeCompare(b.matcher);
          break;
        case 'targetUrl':
          const aTarget = a.targetUrl || '';
          const bTarget = b.targetUrl || '';
          comparison = aTarget.localeCompare(bTarget);
          break;
        case 'createdAt':
        default:
          const aDate = new Date(a.createdAt || '').getTime();
          const bDate = new Date(b.createdAt || '').getTime();
          comparison = aDate - bDate;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
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
      totalAllRules
    };
  }

  async getUrlRule(id: string): Promise<UrlRule | undefined> {
    const rules = await this.getUrlRules();
    return rules.find(rule => rule.id === id);
  }

  async createUrlRule(insertRule: InsertUrlRule, force: boolean = false): Promise<UrlRule> {
    const rules = await this.getUrlRules();
    
    // Skip validation if force flag is set
    if (!force) {
      // Validate for duplicates and overlaps
      const validationErrors: string[] = [];
      
      // Check for exact duplicates
      const existingRuleWithSameMatcher = rules.find(r => r.matcher === insertRule.matcher);
      if (existingRuleWithSameMatcher) {
        validationErrors.push(`URL-Matcher bereits vorhanden: "${insertRule.matcher}" (existierende Regel-ID: ${existingRuleWithSameMatcher.id})`);
      }
      
      // Check for overlapping patterns
      for (const existingRule of rules) {
        if (this.areMatchersOverlapping(insertRule.matcher, existingRule.matcher)) {
          validationErrors.push(`Überlappender URL-Matcher: "${insertRule.matcher}" überschneidet sich mit "${existingRule.matcher}" (Regel-ID: ${existingRule.id})`);
        }
      }
      
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }
    }
    
    const rule: UrlRule = {
      ...insertRule,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    rules.push(rule);
    await this.writeJsonFile(RULES_FILE, rules);
    return rule;
  }

  async updateUrlRule(id: string, updateData: Partial<InsertUrlRule>, force: boolean = false): Promise<UrlRule | undefined> {
    const rules = await this.getUrlRules();
    const index = rules.findIndex(rule => rule.id === id);
    if (index === -1) return undefined;
    
    // Skip validation if force flag is set or if matcher is not being updated
    if (!force && updateData.matcher) {
      const validationErrors: string[] = [];
      
      // Check for exact duplicates (excluding the current rule being updated)
      const existingRuleWithSameMatcher = rules.find(r => 
        r.matcher === updateData.matcher && r.id !== id
      );
      if (existingRuleWithSameMatcher) {
        validationErrors.push(`URL-Matcher bereits vorhanden: "${updateData.matcher}" (existierende Regel-ID: ${existingRuleWithSameMatcher.id})`);
      }
      
      // Check for overlapping patterns (excluding the current rule being updated)
      for (const existingRule of rules) {
        if (existingRule.id === id) continue; // Skip current rule
        if (this.areMatchersOverlapping(updateData.matcher, existingRule.matcher)) {
          validationErrors.push(`Überlappender URL-Matcher: "${updateData.matcher}" überschneidet sich mit "${existingRule.matcher}" (Regel-ID: ${existingRule.id})`);
        }
      }
      
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }
    }
    
    rules[index] = { ...rules[index], ...updateData } as UrlRule;
    await this.writeJsonFile(RULES_FILE, rules);
    return rules[index];
  }

  async deleteUrlRule(id: string): Promise<boolean> {
    const rules = await this.getUrlRules();
    const index = rules.findIndex(rule => rule.id === id);
    if (index === -1) return false;
    
    rules.splice(index, 1);
    await this.writeJsonFile(RULES_FILE, rules);
    return true;
  }

  // Atomic bulk delete to prevent race conditions
  async bulkDeleteUrlRules(ids: string[]): Promise<{deleted: number, notFound: number}> {
    const rules = await this.getUrlRules();
    const idsToDelete = new Set(ids);
    
    const originalCount = rules.length;
    const filteredRules = rules.filter(rule => !idsToDelete.has(rule.id));
    const deletedCount = originalCount - filteredRules.length;
    const notFoundCount = ids.length - deletedCount;
    
    console.log(`ATOMIC BULK DELETE: Original ${originalCount}, Requested ${ids.length}, Deleted ${deletedCount}, Not found ${notFoundCount}`);
    
    // Single atomic write operation
    await this.writeJsonFile(RULES_FILE, filteredRules);
    
    return { deleted: deletedCount, notFound: notFoundCount };
  }

  async clearAllRules(): Promise<void> {
    await this.writeJsonFile(RULES_FILE, []);
  }

  // URL-Tracking implementierung
  async trackUrlAccess(insertTracking: InsertUrlTracking): Promise<UrlTracking> {
    // Skip tracking for root path "/"
    if (insertTracking.path === '/') {
      return {
        ...insertTracking,
        id: randomUUID(),
      };
    }
    
    const trackingData = await this.readJsonFile<UrlTracking>(TRACKING_FILE, []);
    const tracking: UrlTracking = {
      ...insertTracking,
      id: randomUUID(),
    };
    trackingData.push(tracking);
    await this.writeJsonFile(TRACKING_FILE, trackingData);
    return tracking;
  }

  async getTrackingData(timeRange?: '24h' | '7d' | 'all'): Promise<UrlTracking[]> {
    const trackingData = await this.readJsonFile<UrlTracking>(TRACKING_FILE, []);
    
    if (!timeRange || timeRange === 'all') {
      return trackingData;
    }

    const now = new Date();
    const cutoff = new Date();
    
    if (timeRange === '24h') {
      cutoff.setHours(now.getHours() - 24);
    } else if (timeRange === '7d') {
      cutoff.setDate(now.getDate() - 7);
    }

    return trackingData.filter(track => new Date(track.timestamp) >= cutoff);
  }

  async getTopUrls(limit = 10, timeRange?: '24h' | '7d' | 'all'): Promise<Array<{path: string, count: number}>> {
    const trackingData = await this.getTrackingData(timeRange);
    const pathCounts = new Map<string, number>();
    
    // Filter out root path "/" and admin access "/?admin=true" from statistics
    trackingData.forEach(track => {
      if (track.path !== '/' && track.path !== '/?admin=true') {
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

  async searchTrackingEntries(query: string, sortBy: string = 'timestamp', sortOrder: 'asc' | 'desc' = 'desc'): Promise<UrlTracking[]> {
    const trackingData = await this.getAllTrackingEntries();
    
    // Filter out root path "/" and then apply search query
    let filteredData = trackingData.filter(entry => entry.path !== '/');
    
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filteredData = filteredData.filter(entry =>
        entry.oldUrl.toLowerCase().includes(searchTerm) ||
        ((entry as any).newUrl && (entry as any).newUrl.toLowerCase().includes(searchTerm)) ||
        entry.path.toLowerCase().includes(searchTerm) ||
        entry.userAgent?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort data
    filteredData.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp);
          bValue = new Date(b.timestamp);
          break;
        case 'oldUrl':
          aValue = a.oldUrl.toLowerCase();
          bValue = b.oldUrl.toLowerCase();
          break;
        case 'newUrl':
          aValue = ((a as any).newUrl || '').toLowerCase();
          bValue = ((b as any).newUrl || '').toLowerCase();
          break;
        case 'path':
          aValue = a.path.toLowerCase();
          bValue = b.path.toLowerCase();
          break;
        case 'userAgent':
          aValue = (a.userAgent || '').toLowerCase();
          bValue = (b.userAgent || '').toLowerCase();
          break;
        default:
          aValue = a.timestamp;
          bValue = b.timestamp;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filteredData;
  }

  async getTrackingStats(): Promise<{total: number, today: number, week: number}> {
    const all = await this.getTrackingData('all');
    const today = await this.getTrackingData('24h');
    const week = await this.getTrackingData('7d');
    
    // Filter out root path "/" from statistics
    return {
      total: all.filter(track => track.path !== '/').length,
      today: today.filter(track => track.path !== '/').length,
      week: week.filter(track => track.path !== '/').length,
    };
  }

  // Paginated statistics methods
  async getTrackingEntriesPaginated(
    page: number = 1, 
    limit: number = 50, 
    search?: string, 
    sortBy: string = 'timestamp', 
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{
    entries: UrlTracking[];
    total: number;
    totalPages: number;
    currentPage: number;
    totalAllEntries: number;
  }> {
    const allEntries = await this.getAllTrackingEntries();
    const totalAllEntries = allEntries.length;
    
    // Filter entries based on search
    let filteredEntries = search && search.trim() 
      ? await this.searchTrackingEntries(search, sortBy, sortOrder)
      : allEntries.filter(entry => entry.path !== '/'); // Filter root path
    
    if (!search || !search.trim()) {
      // Only sort if not already sorted by searchTrackingEntries
      filteredEntries.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'timestamp':
            aValue = new Date(a.timestamp);
            bValue = new Date(b.timestamp);
            break;
          case 'oldUrl':
            aValue = a.oldUrl.toLowerCase();
            bValue = b.oldUrl.toLowerCase();
            break;
          case 'newUrl':
            aValue = ((a as any).newUrl || '').toLowerCase();
            bValue = ((b as any).newUrl || '').toLowerCase();
            break;
          case 'path':
            aValue = a.path.toLowerCase();
            bValue = b.path.toLowerCase();
            break;
          default:
            aValue = a.timestamp;
            bValue = b.timestamp;
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }
    
    // Calculate pagination
    const total = filteredEntries.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntries = filteredEntries.slice(startIndex, endIndex);
    
    return {
      entries: paginatedEntries,
      total,
      totalPages,
      currentPage: page,
      totalAllEntries
    };
  }

  async getTopUrlsPaginated(
    page: number = 1, 
    limit: number = 50, 
    timeRange?: '24h' | '7d' | 'all'
  ): Promise<{
    urls: Array<{path: string, count: number}>;
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
      currentPage: page
    };
  }

  // Import functionality implementierung
  async importUrlRules(importRules: any[]): Promise<{imported: number, updated: number, errors: string[]}> {
    const existingRules = await this.getUrlRules();
    let imported = 0;
    let updated = 0;

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
        redirectType: rawRule.redirectType || (rawRule.type === "redirect" ? "partial" : rawRule.type) || "partial", // Handle both field names
        infoText: rawRule.infoText || "",
        autoRedirect: rawRule.autoRedirect ?? false,
      };

      if (importRule.id) {
        // If ID is provided, check if rule exists and update it
        const existingRuleIndex = existingRules.findIndex(r => r.id === importRule.id);
        if (existingRuleIndex !== -1) {
          const existingRule = existingRules[existingRuleIndex]!;
          const updatedRule: UrlRule = {
            id: importRule.id,
            matcher: importRule.matcher,
            targetUrl: importRule.targetUrl,
            redirectType: importRule.redirectType,
            infoText: importRule.infoText || "",
            createdAt: existingRule.createdAt,
            autoRedirect: importRule.autoRedirect,
          };
          existingRules[existingRuleIndex] = updatedRule;
          updated++;
        } else {
          const newRule: UrlRule = {
            id: importRule.id,
            matcher: importRule.matcher,
            targetUrl: importRule.targetUrl,
            redirectType: importRule.redirectType,
            infoText: importRule.infoText || "",
            autoRedirect: importRule.autoRedirect,
            createdAt: new Date().toISOString(),
          };
          existingRules.push(newRule);
          imported++;
        }
      } else {
        // No ID provided, check for duplicate matcher first
        const duplicateIndex = existingRules.findIndex(r => r.matcher === importRule.matcher);
        if (duplicateIndex !== -1) {
          const existingRule = existingRules[duplicateIndex]!;
          const updatedRule: UrlRule = {
            id: existingRule.id,
            matcher: importRule.matcher,
            targetUrl: importRule.targetUrl,
            redirectType: importRule.redirectType,
            infoText: importRule.infoText || "",
            createdAt: existingRule.createdAt,
            autoRedirect: importRule.autoRedirect,
          };
          existingRules[duplicateIndex] = updatedRule;
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
            createdAt: new Date().toISOString(),
          };
          existingRules.push(newRule);
          imported++;
        }
      }
    }

    // Save all rules back to file
    await this.writeJsonFile(RULES_FILE, existingRules);

    return { imported, updated, errors: [] };
  }
  
  // Helper method to check if two URL matchers are overlapping
  private areMatchersOverlapping(matcher1: string, matcher2: string): boolean {
    // Remove leading/trailing slashes for comparison
    const clean1 = matcher1.replace(/^\/+|\/+$/g, '');
    const clean2 = matcher2.replace(/^\/+|\/+$/g, '');
    
    // Exact match
    if (clean1 === clean2) return true;
    
    // For URL paths, we need to be precise about what constitutes an overlap
    // "/news/" and "/news-beitrag/" are NOT overlapping - they're different paths
    // Only consider overlap if one path is a TRUE prefix of another with proper path separation
    
    const segments1 = clean1.split('/').filter(s => s.length > 0);
    const segments2 = clean2.split('/').filter(s => s.length > 0);
    
    // Check if one is a true path prefix of the other
    const isPrefix = (shorter: string[], longer: string[]) => {
      if (shorter.length >= longer.length) return false;
      return shorter.every((segment, i) => segment === longer[i]);
    };
    
    // Examples of TRUE overlaps:
    // "/news/" and "/news/archive/" (prefix relationship)
    // "/api/" and "/api/v1/" (prefix relationship)
    // 
    // Examples of NO overlap:
    // "/news/" and "/news-beitrag/" (different segments: "news" vs "news-beitrag")
    // "/api/" and "/apikey/" (different segments: "api" vs "apikey")
    if (segments1.length < segments2.length && isPrefix(segments1, segments2)) {
      return true;
    }
    if (segments2.length < segments1.length && isPrefix(segments2, segments1)) {
      return true;
    }
    
    // Check for wildcard overlaps (if using patterns like /news*)
    if (matcher1.includes('*') || matcher2.includes('*')) {
      const pattern1 = matcher1.replace(/\*/g, '.*');
      const pattern2 = matcher2.replace(/\*/g, '.*');
      
      try {
        const regex1 = new RegExp(`^${pattern1}$`);
        const regex2 = new RegExp(`^${pattern2}$`);
        
        // Test if patterns would match each other's base strings
        const base1 = matcher1.replace(/\*/g, '');
        const base2 = matcher2.replace(/\*/g, '');
        
        if (regex1.test(base2) || regex2.test(base1)) {
          return true;
        }
      } catch (e) {
        // Invalid regex, skip this check
      }
    }
    
    return false;
  }

  // General Settings implementierung
  async getGeneralSettings(): Promise<GeneralSettings> {
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Return default settings if file doesn't exist
      const defaultSettings: GeneralSettings = {
        id: randomUUID(),
        headerTitle: "URL Migration Tool",
        headerIcon: "ArrowRightLeft",
        headerBackgroundColor: "white",
        popupEnabled: true,
        mainTitle: "Veralteter Link erkannt",
        mainDescription: "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten.",
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
        specialHintsDescription: "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL.",
        specialHintsIcon: "Info",
        infoTitle: "Zusätzliche Informationen",
        infoTitleIcon: "Info",
        infoItems: ["", "", ""],
        infoIcons: ["Bookmark", "Share2", "Clock"],
        footerCopyright: "© 2024 URL Migration Service. Alle Rechte vorbehalten.",
        updatedAt: new Date().toISOString(),
        autoRedirect: false,
      };
      
      // Save default settings directly to avoid infinite loop
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
  }

  async updateGeneralSettings(insertSettings: InsertGeneralSettings, replaceMode: boolean = false): Promise<GeneralSettings> {
    // Get existing settings to preserve ID and any fields not being updated
    const existingSettings = await this.getGeneralSettings();
    
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
      Object.keys(settings).forEach(key => {
        if (insertSettings.hasOwnProperty(key) && (insertSettings as any)[key] === null) {
          delete (settings as any)[key];
        }
      });
    }
    
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return settings;
  }
}

export const storage = new FileStorage();
