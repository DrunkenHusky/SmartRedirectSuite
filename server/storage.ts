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
  Translation,
  InsertTranslation,
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
const TRANSLATIONS_FILE = path.join(DATA_DIR, "translations.json");

export interface IStorage {
  // Translations
  getTranslations(lang: string): Promise<Record<string, string>>;
  getAllTranslations(): Promise<Translation[]>;
  setTranslation(translation: InsertTranslation): Promise<Translation>;
  seedTranslations(): Promise<void>;

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
  private translationsCache: Translation[] | null = null;

  constructor() {
    this.ensureDataDirectory();
    this.seedTranslations();
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

  // Translation Implementation
  private async ensureTranslationsLoaded(): Promise<Translation[]> {
    if (this.translationsCache) return this.translationsCache;
    const data = await this.readJsonFile<Translation>(TRANSLATIONS_FILE, []);
    this.translationsCache = data;
    return data;
  }

  async getTranslations(lang: string): Promise<Record<string, string>> {
    const all = await this.ensureTranslationsLoaded();
    const map: Record<string, string> = {};
    all.filter(t => t.lang === lang).forEach(t => {
      map[t.key] = t.value;
    });
    return map;
  }

  async getAllTranslations(): Promise<Translation[]> {
    return this.ensureTranslationsLoaded();
  }

  async setTranslation(translation: InsertTranslation): Promise<Translation> {
    const all = await this.ensureTranslationsLoaded();
    const index = all.findIndex(t => t.key === translation.key && t.lang === translation.lang);

    if (index !== -1) {
      all[index] = translation;
    } else {
      all.push(translation);
    }

    await this.writeJsonFile(TRANSLATIONS_FILE, all);
    this.translationsCache = all;
    return translation;
  }

  async seedTranslations(): Promise<void> {
    const all = await this.ensureTranslationsLoaded();
    const existingKeys = new Set(all.map(t => `${t.lang}:${t.key}`));

    // Initial Seed
    const seed: Translation[] = [
      // Navigation & Layout
      { key: "nav.overview", lang: "de", value: "Übersicht" },
      { key: "nav.overview", lang: "en", value: "Overview" },
      { key: "nav.overview", lang: "fr", value: "Aperçu" },
      { key: "nav.overview", lang: "it", value: "Panoramica" },

      { key: "nav.rules", lang: "de", value: "Regeln" },
      { key: "nav.rules", lang: "en", value: "Rules" },
      { key: "nav.rules", lang: "fr", value: "Règles" },
      { key: "nav.rules", lang: "it", value: "Regole" },

      { key: "nav.stats", lang: "de", value: "Statistiken" },
      { key: "nav.stats", lang: "en", value: "Statistics" },
      { key: "nav.stats", lang: "fr", value: "Statistiques" },
      { key: "nav.stats", lang: "it", value: "Statistiche" },

      { key: "nav.settings", lang: "de", value: "Einstellungen" },
      { key: "nav.settings", lang: "en", value: "Settings" },
      { key: "nav.settings", lang: "fr", value: "Paramètres" },
      { key: "nav.settings", lang: "it", value: "Impostazioni" },

      { key: "nav.danger", lang: "de", value: "Gefahrenzone" },
      { key: "nav.danger", lang: "en", value: "Danger Zone" },
      { key: "nav.danger", lang: "fr", value: "Zone dangereuse" },
      { key: "nav.danger", lang: "it", value: "Zona pericolosa" },

      { key: "nav.translations", lang: "de", value: "Übersetzungen" },
      { key: "nav.translations", lang: "en", value: "Translations" },
      { key: "nav.translations", lang: "fr", value: "Traductions" },
      { key: "nav.translations", lang: "it", value: "Traduzioni" },

      // Auth
      { key: "auth.login.title", lang: "de", value: "Administrator-Anmeldung" },
      { key: "auth.login.title", lang: "en", value: "Administrator Login" },
      { key: "auth.login.description", lang: "de", value: "Bitte geben Sie das Administrator-Passwort ein." },
      { key: "auth.login.description", lang: "en", value: "Please enter the administrator password." },
      { key: "auth.password.label", lang: "de", value: "Passwort" },
      { key: "auth.password.label", lang: "en", value: "Password" },
      { key: "auth.password.placeholder", lang: "de", value: "Administrator-Passwort eingeben" },
      { key: "auth.password.placeholder", lang: "en", value: "Enter administrator password" },
      { key: "auth.login.button", lang: "de", value: "Anmelden" },
      { key: "auth.login.button", lang: "en", value: "Login" },
      { key: "auth.login.cancel", lang: "de", value: "Abbrechen" },
      { key: "auth.login.cancel", lang: "en", value: "Cancel" },

      { key: "auth.success.title", lang: "de", value: "Erfolgreich angemeldet" },
      { key: "auth.success.title", lang: "en", value: "Successfully logged in" },
      { key: "auth.success.description", lang: "de", value: "Willkommen im Administrator-Bereich." },
      { key: "auth.success.description", lang: "en", value: "Welcome to the administrator area." },
      { key: "auth.error.title", lang: "de", value: "Anmeldung fehlgeschlagen" },
      { key: "auth.error.title", lang: "en", value: "Login failed" },
      { key: "auth.error.password", lang: "de", value: "Falsches Passwort" },
      { key: "auth.error.password", lang: "en", value: "Incorrect password" },
      { key: "auth.required.title", lang: "de", value: "Authentifizierung erforderlich" },
      { key: "auth.required.title", lang: "en", value: "Authentication required" },
      { key: "auth.required.desc", lang: "de", value: "Bitte melden Sie sich erneut an." },
      { key: "auth.required.desc", lang: "en", value: "Please log in again." },

      // Admin Header
      { key: "admin.header.title", lang: "de", value: "Administrator-Bereich" },
      { key: "admin.header.title", lang: "en", value: "Administrator Area" },
      { key: "admin.loading", lang: "de", value: "Lade Administrator-Bereich..." },
      { key: "admin.loading", lang: "en", value: "Loading Administrator Area..." },
      { key: "admin.logout", lang: "de", value: "Abmelden" },
      { key: "admin.logout", lang: "en", value: "Logout" },

      // App
      { key: "app.loading", lang: "de", value: "Lade Anwendung..." },
      { key: "app.loading", lang: "en", value: "Loading Application..." },

      // Common
      { key: "common.save", lang: "de", value: "Speichern" },
      { key: "common.save", lang: "en", value: "Save" },
      { key: "common.save", lang: "fr", value: "Enregistrer" },
      { key: "common.save", lang: "it", value: "Salva" },

      { key: "common.cancel", lang: "de", value: "Abbrechen" },
      { key: "common.cancel", lang: "en", value: "Cancel" },
      { key: "common.cancel", lang: "fr", value: "Annuler" },
      { key: "common.cancel", lang: "it", value: "Annulla" },

      { key: "common.delete", lang: "de", value: "Löschen" },
      { key: "common.delete", lang: "en", value: "Delete" },
      { key: "common.delete", lang: "fr", value: "Supprimer" },
      { key: "common.delete", lang: "it", value: "Elimina" },

      { key: "common.edit", lang: "de", value: "Bearbeiten" },
      { key: "common.edit", lang: "en", value: "Edit" },
      { key: "common.edit", lang: "fr", value: "Modifier" },
      { key: "common.edit", lang: "it", value: "Modifica" },

      { key: "common.close", lang: "de", value: "Schließen" },
      { key: "common.close", lang: "en", value: "Close" },

      // Settings
      { key: "settings.language.default", lang: "de", value: "Hauptsprache" },
      { key: "settings.language.default", lang: "en", value: "Default Language" },
      { key: "settings.language.default", lang: "fr", value: "Langue par défaut" },
      { key: "settings.language.default", lang: "it", value: "Lingua predefinita" },

      { key: "settings.title", lang: "de", value: "Allgemeine Einstellungen" },
      { key: "settings.title", lang: "en", value: "General Settings" },
      { key: "settings.title", lang: "fr", value: "Paramètres généraux" },
      { key: "settings.title", lang: "it", value: "Impostazioni generali" },

      { key: "settings.description", lang: "de", value: "Hier können Sie alle Texte der Anwendung anpassen." },
      { key: "settings.description", lang: "en", value: "Here you can customize all application texts." },

      { key: "settings.save.button", lang: "de", value: "Einstellungen speichern" },
      { key: "settings.save.button", lang: "en", value: "Save Settings" },

      // Settings Sections
      { key: "settings.header_section.title", lang: "de", value: "Header-Einstellungen" },
      { key: "settings.header_section.title", lang: "en", value: "Header Settings" },
      { key: "settings.header_section.description", lang: "de", value: "Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt" },
      { key: "settings.header_section.description", lang: "en", value: "Customize the top area of the application - displayed on every page" },

      { key: "settings.popup_section.title", lang: "de", value: "PopUp-Einstellungen" },
      { key: "settings.popup_section.title", lang: "en", value: "Popup Settings" },
      { key: "settings.popup_section.description", lang: "de", value: "Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft" },
      { key: "settings.popup_section.description", lang: "en", value: "Dialog window that appears automatically when a user visits an outdated URL" },

      { key: "settings.routing_section.title", lang: "de", value: "Routing & Fallback-Verhalten" },
      { key: "settings.routing_section.title", lang: "en", value: "Routing & Fallback Behavior" },
      { key: "settings.routing_section.description", lang: "de", value: "Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung" },
      { key: "settings.routing_section.description", lang: "en", value: "Configuration of behavior when there is no exact match" },

      { key: "settings.info_section.title", lang: "de", value: "Zusätzliche Informationen" },
      { key: "settings.info_section.title", lang: "en", value: "Additional Information" },

      { key: "settings.footer_section.title", lang: "de", value: "Footer" },
      { key: "settings.footer_section.title", lang: "en", value: "Footer" },

      { key: "settings.performance_section.title", lang: "de", value: "Link-Erkennung & Leistung" },
      { key: "settings.performance_section.title", lang: "en", value: "Link Detection & Performance" },

      { key: "settings.autoredirect_section.title", lang: "de", value: "Automatische Weiterleitung" },
      { key: "settings.autoredirect_section.title", lang: "en", value: "Automatic Redirect" },

      { key: "settings.feedback_section.title", lang: "de", value: "Benutzer-Feedback-Umfrage" },
      { key: "settings.feedback_section.title", lang: "en", value: "User Feedback Survey" },

      // Content Keys (User Configurable via Settings, defaults)
      { key: "content.headerTitle", lang: "de", value: "URL Migration Tool" },
      { key: "content.headerTitle", lang: "en", value: "URL Migration Tool" },
      { key: "content.mainTitle", lang: "de", value: "Veralteter Link erkannt" },
      { key: "content.mainTitle", lang: "en", value: "Outdated Link Detected" },
      { key: "content.mainDescription", lang: "de", value: "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten." },
      { key: "content.mainDescription", lang: "en", value: "You are using an outdated link. Please update your bookmarks and use the new URL below." },
      { key: "content.urlComparisonTitle", lang: "de", value: "URL-Vergleich" },
      { key: "content.urlComparisonTitle", lang: "en", value: "URL Comparison" },
      { key: "content.oldUrlLabel", lang: "de", value: "Alte URL (veraltet)" },
      { key: "content.oldUrlLabel", lang: "en", value: "Old URL (deprecated)" },
      { key: "content.newUrlLabel", lang: "de", value: "Neue URL (verwenden Sie diese)" },
      { key: "content.newUrlLabel", lang: "en", value: "New URL (use this one)" },
      { key: "content.copyButtonText", lang: "de", value: "URL kopieren" },
      { key: "content.copyButtonText", lang: "en", value: "Copy URL" },
      { key: "content.openButtonText", lang: "de", value: "In neuem Tab öffnen" },
      { key: "content.openButtonText", lang: "en", value: "Open in new tab" },
      { key: "content.showUrlButtonText", lang: "de", value: "Zeige mir die neue URL" },
      { key: "content.showUrlButtonText", lang: "en", value: "Show me the new URL" },
      { key: "content.popupButtonText", lang: "de", value: "Zeige mir die neue URL" },
      { key: "content.popupButtonText", lang: "en", value: "Show me the new URL" },
      { key: "content.specialHintsTitle", lang: "de", value: "Spezielle Hinweise für diese URL" },
      { key: "content.specialHintsTitle", lang: "en", value: "Special Hints for this URL" },
      { key: "content.specialHintsDescription", lang: "de", value: "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL." },
      { key: "content.specialHintsDescription", lang: "en", value: "Here you will find specific information and hints for migrating this URL." },
      { key: "content.infoTitle", lang: "de", value: "Zusätzliche Informationen" },
      { key: "content.infoTitle", lang: "en", value: "Additional Information" },
      { key: "content.footerCopyright", lang: "de", value: "© 2024 URL Migration Service. Alle Rechte vorbehalten." },
      { key: "content.footerCopyright", lang: "en", value: "© 2024 URL Migration Service. All rights reserved." },

      // Dashboard
      { key: "dashboard.total_requests", lang: "de", value: "Aufrufe Gesamt" },
      { key: "dashboard.total_requests", lang: "en", value: "Total Requests" },
      { key: "dashboard.total_requests", lang: "fr", value: "Total des demandes" },
      { key: "dashboard.total_requests", lang: "it", value: "Totale richieste" },

      { key: "dashboard.today", lang: "de", value: "Heute" },
      { key: "dashboard.today", lang: "en", value: "Today" },
      { key: "dashboard.today", lang: "fr", value: "Aujourd'hui" },
      { key: "dashboard.today", lang: "it", value: "Oggi" },

      // Editor / Migration
      { key: "editor.mode_active", lang: "de", value: "Editier-Modus" },
      { key: "editor.mode_active", lang: "en", value: "Edit Mode" },
      { key: "editor.mode_active", lang: "fr", value: "Mode édition" },
      { key: "editor.mode_active", lang: "it", value: "Modalità modifica" },

      // Rules Table
      { key: "rules.matcher", lang: "de", value: "Matcher" },
      { key: "rules.matcher", lang: "en", value: "Matcher" },
      { key: "rules.matcher", lang: "fr", value: "Matcher" },
      { key: "rules.matcher", lang: "it", value: "Corrispondenza" },

      { key: "rules.target", lang: "de", value: "Ziel" },
      { key: "rules.target", lang: "en", value: "Target" },
      { key: "rules.target", lang: "fr", value: "Cible" },
      { key: "rules.target", lang: "it", value: "Destinazione" },

      { key: "rules.type", lang: "de", value: "Typ" },
      { key: "rules.type", lang: "en", value: "Type" },
      { key: "rules.type", lang: "fr", value: "Type" },
      { key: "rules.type", lang: "it", value: "Tipo" },

      { key: "rules.created", lang: "de", value: "Erstellt" },
      { key: "rules.created", lang: "en", value: "Created" },
      { key: "rules.created", lang: "fr", value: "Créé" },
      { key: "rules.created", lang: "it", value: "Creato" },

      { key: "rules.actions", lang: "de", value: "Aktionen" },
      { key: "rules.actions", lang: "en", value: "Actions" },
      { key: "rules.actions", lang: "fr", value: "Actions" },
      { key: "rules.actions", lang: "it", value: "Azioni" },

      { key: "rules.title", lang: "de", value: "URL-Transformationsregeln" },
      { key: "rules.title", lang: "en", value: "URL Transformation Rules" },
      { key: "rules.description", lang: "de", value: "Verwalten Sie URL-Transformations-Regeln für die Migration." },
      { key: "rules.description", lang: "en", value: "Manage URL transformation rules for migration." },
      { key: "rules.new_rule", lang: "de", value: "Neue Regel" },
      { key: "rules.new_rule", lang: "en", value: "New Rule" },
      { key: "rules.search_placeholder", lang: "de", value: "Regeln durchsuchen..." },
      { key: "rules.search_placeholder", lang: "en", value: "Search rules..." },

      // Stats Table
      { key: "stats.old_url", lang: "de", value: "Alte URL" },
      { key: "stats.old_url", lang: "en", value: "Old URL" },
      { key: "stats.old_url", lang: "fr", value: "Ancienne URL" },
      { key: "stats.old_url", lang: "it", value: "Vecchia URL" },

      { key: "stats.new_url", lang: "de", value: "Neue URL" },
      { key: "stats.new_url", lang: "en", value: "New URL" },
      { key: "stats.new_url", lang: "fr", value: "Nouvelle URL" },
      { key: "stats.new_url", lang: "it", value: "Nuova URL" },

      { key: "stats.timestamp", lang: "de", value: "Zeitstempel" },
      { key: "stats.timestamp", lang: "en", value: "Timestamp" },
      { key: "stats.timestamp", lang: "fr", value: "Horodatage" },
      { key: "stats.timestamp", lang: "it", value: "Data e ora" },

      { key: "stats.quality", lang: "de", value: "Qualität" },
      { key: "stats.quality", lang: "en", value: "Quality" },
      { key: "stats.quality", lang: "fr", value: "Qualité" },
      { key: "stats.quality", lang: "it", value: "Qualità" },

      // Admin - General Settings - Header
      { key: "settings.header.icon", lang: "de", value: "Icon" },
      { key: "settings.header.icon", lang: "en", value: "Icon" },
      { key: "settings.header.bg_color", lang: "de", value: "Hintergrundfarbe" },
      { key: "settings.header.bg_color", lang: "en", value: "Background Color" },
      { key: "settings.header.logo_upload", lang: "de", value: "Logo hochladen" },
      { key: "settings.header.logo_upload", lang: "en", value: "Upload Logo" },
      { key: "settings.header.logo_recommendation", lang: "de", value: "Empfehlung: PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)" },
      { key: "settings.header.logo_recommendation", lang: "en", value: "Recommendation: PNG with transparent background, 200x50 pixels (max. 5MB)" },
      { key: "settings.header.logo_function", lang: "de", value: "Funktion: Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt." },
      { key: "settings.header.logo_function", lang: "en", value: "Function: If a logo is uploaded, it replaces the selected icon next to the header title. Without a logo, the selected icon is displayed." },
      { key: "settings.header.current_logo", lang: "de", value: "Aktuelles Logo:" },
      { key: "settings.header.current_logo", lang: "en", value: "Current Logo:" },
      { key: "settings.header.logo_active", lang: "de", value: "Logo aktiv - wird anstelle des Icons angezeigt" },
      { key: "settings.header.logo_active", lang: "en", value: "Logo active - displayed instead of the icon" },

      // Admin - General Settings - Popup
      { key: "settings.popup.display", lang: "de", value: "PopUp-Anzeige" },
      { key: "settings.popup.display", lang: "en", value: "Popup Display" },
      { key: "settings.popup.mode_active", lang: "de", value: "Aktiv" },
      { key: "settings.popup.mode_active", lang: "en", value: "Active" },
      { key: "settings.popup.mode_inline", lang: "de", value: "Inline" },
      { key: "settings.popup.mode_inline", lang: "en", value: "Inline" },
      { key: "settings.popup.mode_disabled", lang: "de", value: "Deaktiviert" },
      { key: "settings.popup.mode_disabled", lang: "en", value: "Disabled" },
      { key: "settings.popup.button_text_label", lang: "de", value: "PopUp Button-Text" },
      { key: "settings.popup.button_text_label", lang: "en", value: "Popup Button Text" },
      { key: "settings.popup.button_text_desc", lang: "de", value: "Text für den Button der das PopUp-Fenster öffnet" },
      { key: "settings.popup.button_text_desc", lang: "en", value: "Text for the button that opens the popup window" },
      { key: "settings.popup.bg_color_alert", lang: "de", value: "Alert-Hintergrundfarbe" },
      { key: "settings.popup.bg_color_alert", lang: "en", value: "Alert Background Color" },
      { key: "settings.popup.bg_color_content", lang: "de", value: "Hauptinhalt-Hintergrundfarbe" },
      { key: "settings.popup.bg_color_content", lang: "en", value: "Main Content Background Color" },

      // Admin - General Settings - Routing
      { key: "settings.routing.target_domain", lang: "de", value: "Ziel-Domain (Standard neue Domain)" },
      { key: "settings.routing.target_domain", lang: "en", value: "Target Domain (Default New Domain)" },
      { key: "settings.routing.target_domain_desc", lang: "de", value: "Verwendet für Partial Matches und spezifische Regeln." },
      { key: "settings.routing.target_domain_desc", lang: "en", value: "Used for partial matches and specific rules." },
      { key: "settings.routing.fallback_strategy", lang: "de", value: "Fallback-Strategie" },
      { key: "settings.routing.fallback_strategy", lang: "en", value: "Fallback Strategy" },
      { key: "settings.routing.strategy_domain", lang: "de", value: "Einfacher Domain-Austausch" },
      { key: "settings.routing.strategy_domain", lang: "en", value: "Simple Domain Replacement" },
      { key: "settings.routing.strategy_domain_desc", lang: "de", value: "Standard-Verhalten: Ersetzt die alte Domain durch die neue 'Target Domain'. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt." },
      { key: "settings.routing.strategy_domain_desc", lang: "en", value: "Default behavior: Replaces the old domain with the new 'Target Domain'. The entire path and all parameters are preserved exactly. Ideal if the page structure remains the same." },
      { key: "settings.routing.strategy_search", lang: "de", value: "Intelligente Such-Weiterleitung" },
      { key: "settings.routing.strategy_search", lang: "en", value: "Smart Search Redirect" },
      { key: "settings.routing.strategy_search_desc", lang: "de", value: "Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite." },
      { key: "settings.routing.strategy_search_desc", lang: "en", value: "Smart fallback: Redirects to an internal search page if no rule matches. Automatically uses the last path segment of the old URL as a search term for the new page." },
      { key: "settings.routing.strategy_desc_help", lang: "de", value: "Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift." },
      { key: "settings.routing.strategy_desc_help", lang: "en", value: "Defines what happens when NO rule (Exact or Partial) matches." },
      { key: "settings.routing.search_base_url", lang: "de", value: "Such-Basis-URL" },
      { key: "settings.routing.search_base_url", lang: "en", value: "Search Base URL" },
      { key: "settings.routing.search_base_url_help", lang: "de", value: "Beispiel: https://newapp.com/?q=" },
      { key: "settings.routing.search_base_url_help", lang: "en", value: "Example: https://newapp.com/?q=" },
      { key: "settings.routing.fallback_messages", lang: "de", value: "Fallback-Info-Nachrichten" },
      { key: "settings.routing.fallback_messages", lang: "en", value: "Fallback Info Messages" },
      { key: "settings.routing.special_hints_title", lang: "de", value: "Spezielle Hinweise - Titel" },
      { key: "settings.routing.special_hints_title", lang: "en", value: "Special Hints - Title" },
      { key: "settings.routing.special_hints_icon", lang: "de", value: "Spezielle Hinweise - Icon" },
      { key: "settings.routing.special_hints_icon", lang: "en", value: "Special Hints - Icon" },
      { key: "settings.routing.standard_info_text", lang: "de", value: "Standard Info Text (Beschreibung)" },
      { key: "settings.routing.standard_info_text", lang: "en", value: "Standard Info Text (Description)" },
      { key: "settings.routing.standard_info_help", lang: "de", value: "Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat." },
      { key: "settings.routing.standard_info_help", lang: "en", value: "Displayed when a rule matches but has no specific text." },
      { key: "settings.routing.smart_search_msg", lang: "de", value: "Smart Search Nachricht" },
      { key: "settings.routing.smart_search_msg", lang: "en", value: "Smart Search Message" },
      { key: "settings.routing.smart_search_msg_help", lang: "de", value: "Angezeigt NUR wenn 'Intelligente Such-Weiterleitung' ausgelöst wird (keine Regel matched)." },
      { key: "settings.routing.smart_search_msg_help", lang: "en", value: "Displayed ONLY when 'Smart Search Redirect' is triggered (no rule matched)." },

      // Admin - General Settings - Visualization
      { key: "settings.visual.title", lang: "de", value: "Visualisierung" },
      { key: "settings.visual.title", lang: "en", value: "Visualization" },
      { key: "settings.visual.icon", lang: "de", value: "Icon" },
      { key: "settings.visual.icon", lang: "en", value: "Icon" },
      { key: "settings.visual.bg_color", lang: "de", value: "Hintergrundfarbe" },
      { key: "settings.visual.bg_color", lang: "en", value: "Background Color" },
      { key: "settings.visual.label_old_url", lang: "de", value: "Label für alte URL" },
      { key: "settings.visual.label_old_url", lang: "en", value: "Label for Old URL" },
      { key: "settings.visual.label_new_url", lang: "de", value: "Label für neue URL" },
      { key: "settings.visual.label_new_url", lang: "en", value: "Label for New URL" },
      { key: "settings.visual.gauge_title", lang: "de", value: "Link-Qualitätstacho anzeigen" },
      { key: "settings.visual.gauge_title", lang: "en", value: "Show Link Quality Gauge" },
      { key: "settings.visual.match_high", lang: "de", value: "Text für hohe Übereinstimmung (100%)" },
      { key: "settings.visual.match_high", lang: "en", value: "Text for High Match (100%)" },
      { key: "settings.visual.match_medium", lang: "de", value: "Text für mittlere Übereinstimmung (75%)" },
      { key: "settings.visual.match_medium", lang: "en", value: "Text for Medium Match (75%)" },
      { key: "settings.visual.match_low", lang: "de", value: "Text für geringe Übereinstimmung (50%)" },
      { key: "settings.visual.match_low", lang: "en", value: "Text for Low Match (50%)" },
      { key: "settings.visual.match_root", lang: "de", value: "Text für Startseiten-Treffer (100%)" },
      { key: "settings.visual.match_root", lang: "en", value: "Text for Homepage Match (100%)" },
      { key: "settings.visual.match_none", lang: "de", value: "Text für keine Übereinstimmung (0%)" },
      { key: "settings.visual.match_none", lang: "en", value: "Text for No Match (0%)" },
      { key: "settings.visual.btn_copy", lang: "de", value: "Button-Text 'URL kopieren'" },
      { key: "settings.visual.btn_copy", lang: "en", value: "Button Text 'Copy URL'" },
      { key: "settings.visual.btn_open", lang: "de", value: "Button-Text 'In neuem Tab öffnen'" },
      { key: "settings.visual.btn_open", lang: "en", value: "Button Text 'Open in New Tab'" },

      // Admin - General Settings - Info
      { key: "settings.info.title_label", lang: "de", value: "Titel der Sektion" },
      { key: "settings.info.title_label", lang: "en", value: "Section Title" },
      { key: "settings.info.title_help", lang: "de", value: "Überschrift für den Bereich mit zusätzlichen Informationen" },
      { key: "settings.info.title_help", lang: "en", value: "Heading for the additional information section" },
      { key: "settings.info.icon_label", lang: "de", value: "Icon für den Titel" },
      { key: "settings.info.icon_label", lang: "en", value: "Icon for Title" },
      { key: "settings.info.items_label", lang: "de", value: "Informations-Punkte" },
      { key: "settings.info.items_label", lang: "en", value: "Information Items" },
      { key: "settings.info.items_help", lang: "de", value: "Liste von Stichpunkten die unter dem Info-Text angezeigt werden" },
      { key: "settings.info.items_help", lang: "en", value: "List of bullet points displayed below the info text" },
      { key: "settings.info.add_button", lang: "de", value: "Hinzufügen" },
      { key: "settings.info.add_button", lang: "en", value: "Add" },
      { key: "settings.info.placeholder", lang: "de", value: "Informationspunkt" },
      { key: "settings.info.placeholder", lang: "en", value: "Information Item" },
      { key: "settings.info.no_items_msg", lang: "de", value: "Keine Info-Punkte vorhanden. Klicken Sie 'Hinzufügen' um welche zu erstellen." },
      { key: "settings.info.no_items_msg", lang: "en", value: "No info items present. Click 'Add' to create some." },

      // Admin - General Settings - Footer
      { key: "settings.footer.copyright_label", lang: "de", value: "Copyright-Text" },
      { key: "settings.footer.copyright_label", lang: "en", value: "Copyright Text" },

      // Admin - General Settings - Performance
      { key: "settings.perf.case_sensitive", lang: "de", value: "Groß-/Kleinschreibung beachten" },
      { key: "settings.perf.case_sensitive", lang: "en", value: "Case Sensitive Link Detection" },
      { key: "settings.perf.case_sensitive_desc", lang: "de", value: "Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert." },
      { key: "settings.perf.case_sensitive_desc", lang: "en", value: "If enabled, rules are matched only with exact case sensitivity. Default is disabled." },
      { key: "settings.perf.referrer_tracking", lang: "de", value: "Referrer Tracking aktivieren" },
      { key: "settings.perf.referrer_tracking", lang: "en", value: "Enable Referrer Tracking" },
      { key: "settings.perf.referrer_tracking_desc", lang: "de", value: "Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen." },
      { key: "settings.perf.referrer_tracking_desc", lang: "en", value: "Records the origin URL (referrer) of visitors for statistical analysis." },
      { key: "settings.perf.tracking_cache", lang: "de", value: "Tracking-Cache aktivieren (RAM)" },
      { key: "settings.perf.tracking_cache", lang: "en", value: "Enable Tracking Cache (RAM)" },
      { key: "settings.perf.tracking_cache_desc", lang: "de", value: "Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten." },
      { key: "settings.perf.tracking_cache_desc", lang: "en", value: "Stores statistics in memory for fast access. Massively increases system speed but requires more RAM with large data sets." },
      { key: "settings.perf.max_stats", lang: "de", value: "Max. Statistik-Einträge" },
      { key: "settings.perf.max_stats", lang: "en", value: "Max. Statistics Entries" },
      { key: "settings.perf.max_stats_desc", lang: "de", value: "Begrenzt die Anzahl der gespeicherten Statistik-Einträge in der tracking.json. Älteste Einträge werden bei Überschreitung gelöscht. (0 = Unbegrenzt)" },
      { key: "settings.perf.max_stats_desc", lang: "en", value: "Limits the number of stored statistics entries in tracking.json. Oldest entries are deleted when exceeded. (0 = Unlimited)" },
      { key: "settings.perf.recommendation", lang: "de", value: "Empfehlung:" },
      { key: "settings.perf.recommendation", lang: "en", value: "Recommendation:" },
      { key: "settings.perf.recommendation_text", lang: "de", value: "Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (< 512MB) oder Sie haben extrem viele Tracking-Daten (> 1 Mio. Einträge)." },
      { key: "settings.perf.recommendation_text", lang: "en", value: "Keep the tracking cache enabled (default) unless your server has very low memory (< 512MB) or you have extremely large tracking data (> 1M entries)." },

      // Admin - General Settings - Auto Redirect
      { key: "settings.autoredirect.enable", lang: "de", value: "Automatische Weiterleitung aktivieren" },
      { key: "settings.autoredirect.enable", lang: "en", value: "Enable Automatic Redirect" },
      { key: "settings.autoredirect.desc", lang: "de", value: "Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen." },
      { key: "settings.autoredirect.desc", lang: "en", value: "If enabled, all users are automatically redirected to the new URL without seeing the notice page." },
      { key: "settings.autoredirect.admin_access", lang: "de", value: "Admin-Zugriff:" },
      { key: "settings.autoredirect.admin_access", lang: "en", value: "Admin Access:" },
      { key: "settings.autoredirect.admin_access_text", lang: "de", value: "Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter ?admin=true erreichen." },
      { key: "settings.autoredirect.admin_access_text", lang: "en", value: "When automatic redirect is enabled, you can only access admin settings via the ?admin=true parameter." },

      // Admin - General Settings - Feedback
      { key: "settings.feedback.enable", lang: "de", value: "Feedback-Umfrage aktivieren" },
      { key: "settings.feedback.enable", lang: "en", value: "Enable Feedback Survey" },
      { key: "settings.feedback.desc", lang: "de", value: "Zeigt ein Popup an, wenn Nutzer auf 'Kopieren' oder 'Öffnen' klicken, um zu fragen, ob der Link funktioniert hat." },
      { key: "settings.feedback.desc", lang: "en", value: "Shows a popup when users click 'Copy' or 'Open' to ask if the link worked." },
      { key: "settings.feedback.title_label", lang: "de", value: "Umfrage Titel" },
      { key: "settings.feedback.title_label", lang: "en", value: "Survey Title" },
      { key: "settings.feedback.question_label", lang: "de", value: "Umfrage Frage" },
      { key: "settings.feedback.question_label", lang: "en", value: "Survey Question" },
      { key: "settings.feedback.success_label", lang: "de", value: "Erfolgsmeldung" },
      { key: "settings.feedback.success_label", lang: "en", value: "Success Message" },
      { key: "settings.feedback.yes_label", lang: "de", value: "Button Ja (OK)" },
      { key: "settings.feedback.yes_label", lang: "en", value: "Button Yes (OK)" },
      { key: "settings.feedback.yes_help", lang: "de", value: "Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)" },
      { key: "settings.feedback.yes_help", lang: "en", value: "Text on the button for positive feedback (Default: Yes, OK)" },
      { key: "settings.feedback.no_label", lang: "de", value: "Button Nein (NOK)" },
      { key: "settings.feedback.no_label", lang: "en", value: "Button No (NOK)" },
      { key: "settings.feedback.no_help", lang: "de", value: "Text auf dem Button für negative Rückmeldung (Standard: Nein)" },
      { key: "settings.feedback.no_help", lang: "en", value: "Text on the button for negative feedback (Default: No)" },

      // Admin - General Settings - Save
      { key: "settings.save.helper", lang: "de", value: "Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden." },
      { key: "settings.save.helper", lang: "en", value: "Save your changes to apply them to the website." },
      { key: "settings.save.loading", lang: "de", value: "Speichere..." },
      { key: "settings.save.loading", lang: "en", value: "Saving..." },

      // Migration Page
      { key: "migration.analyzing", lang: "de", value: "URL wird analysiert..." },
      { key: "migration.analyzing", lang: "en", value: "Analyzing URL..." },
      { key: "migration.copy_success", lang: "de", value: "URL erfolgreich in die Zwischenablage kopiert!" },
      { key: "migration.copy_success", lang: "en", value: "URL successfully copied to clipboard!" },
      { key: "migration.copy_fail", lang: "de", value: "Bitte kopieren Sie die URL manuell." },
      { key: "migration.copy_fail", lang: "en", value: "Please copy the URL manually." },
      { key: "migration.copied", lang: "de", value: "Kopiert!" },
      { key: "migration.copied", lang: "en", value: "Copied!" },
      { key: "migration.copy_tooltip", lang: "de", value: "Klicken zum Kopieren" },
      { key: "migration.copy_tooltip", lang: "en", value: "Click to copy" },
      { key: "migration.switch_popup", lang: "de", value: "Zu Popup wechseln" },
      { key: "migration.switch_popup", lang: "en", value: "Switch to Popup" },
      { key: "migration.switch_inline", lang: "de", value: "Zu Inline wechseln" },
      { key: "migration.switch_inline", lang: "en", value: "Switch to Inline" },
      { key: "migration.add_info", lang: "de", value: "Info-Punkt hinzufügen" },
      { key: "migration.add_info", lang: "en", value: "Add Info Item" },
      { key: "settings.field.title", lang: "de", value: "Titel" },
      { key: "settings.field.title", lang: "en", value: "Title" },
      { key: "settings.field.description", lang: "de", value: "Beschreibung" },
      { key: "settings.field.description", lang: "en", value: "Description" },
      { key: "settings.language.description", lang: "de", value: "Standardsprache für die Anwendung." },
      { key: "settings.language.description", lang: "en", value: "Default language for the application." },

      // User Configurable - Defaults
      { key: "feedback.title", lang: "de", value: "Umfrage Titel" },
      { key: "feedback.title", lang: "en", value: "Survey Title" },
      { key: "feedback.question", lang: "de", value: "Umfrage Frage" },
      { key: "feedback.question", lang: "en", value: "Survey Question" },
      { key: "feedback.success", lang: "de", value: "Erfolgsmeldung" },
      { key: "feedback.success", lang: "en", value: "Success Message" },
      { key: "feedback.yes", lang: "de", value: "Button Ja (OK)" },
      { key: "feedback.yes", lang: "en", value: "Button Yes (OK)" },
      { key: "feedback.no", lang: "de", value: "Button Nein (NOK)" },
      { key: "feedback.no", lang: "en", value: "Button No (NOK)" },

      // Rule Dialog & Form
      { key: "rules.dialog.create.title", lang: "de", value: "Neue Regel erstellen" },
      { key: "rules.dialog.create.title", lang: "en", value: "Create New Rule" },
      { key: "rules.dialog.edit.title", lang: "de", value: "Regel bearbeiten" },
      { key: "rules.dialog.edit.title", lang: "en", value: "Edit Rule" },
      { key: "rules.form.matcher", lang: "de", value: "URL-Pfad Matcher" },
      { key: "rules.form.matcher", lang: "en", value: "URL Path Matcher" },
      { key: "rules.form.target", lang: "de", value: "Ziel-URL (optional)" },
      { key: "rules.form.target", lang: "en", value: "Target URL (optional)" },
      { key: "rules.form.redirect_type", lang: "de", value: "Redirect-Typ" },
      { key: "rules.form.redirect_type", lang: "en", value: "Redirect Type" },
      { key: "rules.form.info", lang: "de", value: "Info-Text (Markdown)" },
      { key: "rules.form.info", lang: "en", value: "Info Text (Markdown)" },

      { key: "rules.dialog.success.create", lang: "de", value: "Regel erstellt" },
      { key: "rules.dialog.success.create", lang: "en", value: "Rule created" },
      { key: "rules.dialog.success.create_desc", lang: "de", value: "Die URL-Regel wurde erfolgreich erstellt." },
      { key: "rules.dialog.success.create_desc", lang: "en", value: "The URL rule was successfully created." },
      { key: "rules.dialog.success.update", lang: "de", value: "Regel aktualisiert" },
      { key: "rules.dialog.success.update", lang: "en", value: "Rule updated" },
      { key: "rules.dialog.success.update_desc", lang: "de", value: "Die URL-Regel wurde erfolgreich aktualisiert." },
      { key: "rules.dialog.success.update_desc", lang: "en", value: "The URL rule was successfully updated." },
      { key: "rules.dialog.success.delete", lang: "de", value: "Regel gelöscht" },
      { key: "rules.dialog.success.delete", lang: "en", value: "Rule deleted" },
      { key: "rules.dialog.success.delete_desc", lang: "de", value: "1 Regel wurde erfolgreich gelöscht." },
      { key: "rules.dialog.success.delete_desc", lang: "en", value: "1 rule was successfully deleted." },

      { key: "rules.dialog.error.title", lang: "de", value: "Fehler" },
      { key: "rules.dialog.error.title", lang: "en", value: "Error" },
      { key: "rules.dialog.error.create", lang: "de", value: "Die Regel konnte nicht erstellt werden." },
      { key: "rules.dialog.error.create", lang: "en", value: "The rule could not be created." },
      { key: "rules.dialog.error.update", lang: "de", value: "Die Regel konnte nicht aktualisiert werden." },
      { key: "rules.dialog.error.update", lang: "en", value: "The rule could not be updated." },
      { key: "rules.dialog.validation_error", lang: "de", value: "Validierungsfehler" },
      { key: "rules.dialog.validation_error", lang: "en", value: "Validation Error" },
      { key: "rules.dialog.unknown_error", lang: "de", value: "Unbekannter Fehler" },
      { key: "rules.dialog.unknown_error", lang: "en", value: "Unknown Error" },

      { key: "rules.bulk_delete_partial", lang: "de", value: "Teilweise gelöscht" },
      { key: "rules.bulk_delete_partial", lang: "en", value: "Partially deleted" },
      { key: "rules.bulk_delete_success", lang: "de", value: "Regeln gelöscht" },
      { key: "rules.bulk_delete_success", lang: "en", value: "Rules deleted" },
      { key: "rules.deleted_success", lang: "de", value: "erfolgreich gelöscht" },
      { key: "rules.deleted_success", lang: "en", value: "successfully deleted" },
      { key: "rules.deleted_fail", lang: "de", value: "konnten nicht gelöscht werden" },
      { key: "rules.deleted_fail", lang: "en", value: "could not be deleted" },
      { key: "rules.rule_deleted", lang: "de", value: "Regel wurde" },
      { key: "rules.rule_deleted", lang: "en", value: "rule was" },
      { key: "rules.rules_deleted", lang: "de", value: "Regeln wurden" },
      { key: "rules.rules_deleted", lang: "en", value: "rules were" },
      { key: "rules.bulk_delete_error", lang: "de", value: "Fehler beim Löschen" },
      { key: "rules.bulk_delete_error", lang: "en", value: "Error deleting" },
      { key: "rules.bulk_delete_error_desc", lang: "de", value: "Die Regeln konnten nicht gelöscht werden." },
      { key: "rules.bulk_delete_error_desc", lang: "en", value: "The rules could not be deleted." },

      { key: "rules.type.partial", lang: "de", value: "Teilweise" },
      { key: "rules.type.partial", lang: "en", value: "Partial" },
      { key: "rules.type.wildcard", lang: "de", value: "Vollständig" },
      { key: "rules.type.wildcard", lang: "en", value: "Wildcard" },
      { key: "rules.type.domain", lang: "de", value: "Domain-Ersatz" },
      { key: "rules.type.domain", lang: "en", value: "Domain Replacement" },

      { key: "rules.type.partial.desc", lang: "de", value: "Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten." },
      { key: "rules.type.partial.desc", lang: "en", value: "Only path segments matching the pattern are replaced. Uses Base URL from general settings. Additional path segments, parameters, and anchors are preserved." },
      { key: "rules.type.wildcard.desc", lang: "de", value: "Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker." },
      { key: "rules.type.wildcard.desc", lang: "en", value: "Old links are completely redirected to the new Target URL. No parts of the old URL are preserved – neither path segments nor parameters or anchors." },
      { key: "rules.type.domain.desc", lang: "de", value: "Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten." },
      { key: "rules.type.domain.desc", lang: "en", value: "Replaces only the domain (host) of the URL. The entire path and all parameters are preserved exactly." },

      { key: "rules.params.discard", lang: "de", value: "Alle Link-Parameter entfernen" },
      { key: "rules.params.discard", lang: "en", value: "Discard all query parameters" },
      { key: "rules.params.discard_desc", lang: "de", value: "Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten)." },
      { key: "rules.params.discard_desc", lang: "en", value: "If enabled, all query parameters (e.g. ?id=123) are removed from the URL. Default is disabled (parameters are kept)." },

      { key: "rules.params.keep", lang: "de", value: "Link-Parameter beibehalten" },
      { key: "rules.params.keep", lang: "en", value: "Keep query parameters" },
      { key: "rules.params.keep_desc", lang: "de", value: "Wenn aktiviert, werden die ursprünglichen Query-Parameter an die Ziel-URL angehängt. Standard ist deaktiviert (Parameter werden verworfen)." },
      { key: "rules.params.keep_desc", lang: "en", value: "If enabled, original query parameters are appended to the target URL. Default is disabled (parameters are discarded)." },

      { key: "rules.auto_redirect", lang: "de", value: "Automatische Weiterleitung für diese Regel" },
      { key: "rules.auto_redirect", lang: "en", value: "Automatic redirect for this rule" },
      { key: "rules.auto_redirect_desc", lang: "de", value: "Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet." },
      { key: "rules.auto_redirect_desc", lang: "en", value: "If enabled, users matching this rule are automatically redirected." },

      { key: "rules.bulk_delete", lang: "de", value: "löschen" },
      { key: "rules.bulk_delete", lang: "en", value: "delete" },
      { key: "rules.create_new", lang: "de", value: "Neue Regel" },
      { key: "rules.create_new", lang: "en", value: "New Rule" },
      { key: "rules.no_rules_found", lang: "de", value: "Keine Regeln gefunden." },
      { key: "rules.no_rules_found", lang: "en", value: "No rules found." },

      // Stats Filters
      { key: "stats.filter.time.24h", lang: "de", value: "Letzte 24h" },
      { key: "stats.filter.time.24h", lang: "en", value: "Last 24h" },
      { key: "stats.filter.time.7d", lang: "de", value: "Letzte 7 Tage" },
      { key: "stats.filter.time.7d", lang: "en", value: "Last 7 Days" },
      { key: "stats.filter.time.all", lang: "de", value: "Alle Zeit" },
      { key: "stats.filter.time.all", lang: "en", value: "All Time" },

      { key: "stats.filter.rule.all", lang: "de", value: "Alle Einträge" },
      { key: "stats.filter.rule.all", lang: "en", value: "All Entries" },
      { key: "stats.filter.rule.with", lang: "de", value: "Nur mit Regeln" },
      { key: "stats.filter.rule.with", lang: "en", value: "With Rules Only" },
      { key: "stats.filter.rule.no", lang: "de", value: "Nur ohne Regeln" },
      { key: "stats.filter.rule.no", lang: "en", value: "Without Rules Only" },

      { key: "stats.filter.quality", lang: "de", value: "Qualität" },
      { key: "stats.filter.quality", lang: "en", value: "Quality" },
      { key: "stats.filter.feedback", lang: "de", value: "Feedback" },
      { key: "stats.filter.feedback", lang: "en", value: "Feedback" },

      { key: "stats.all_entries", lang: "de", value: "Alle Tracking-Einträge" },
      { key: "stats.all_entries", lang: "en", value: "All Tracking Entries" },
      { key: "stats.top_urls", lang: "de", value: "Top URLs" },
      { key: "stats.top_urls", lang: "en", value: "Top URLs" },
      { key: "stats.top_referrers", lang: "de", value: "Top Referrer" },
      { key: "stats.top_referrers", lang: "en", value: "Top Referrers" },

      // Stats Table Headers
      { key: "stats.table.rank", lang: "de", value: "#" },
      { key: "stats.table.rank", lang: "en", value: "#" },
      { key: "stats.table.path", lang: "de", value: "URL-Pfad" },
      { key: "stats.table.path", lang: "en", value: "URL Path" },
      { key: "stats.table.count", lang: "de", value: "Aufrufe" },
      { key: "stats.table.count", lang: "en", value: "Views" },
      { key: "stats.table.share", lang: "de", value: "Anteil" },
      { key: "stats.table.share", lang: "en", value: "Share" },
      { key: "stats.table.domain", lang: "de", value: "Domain" },
      { key: "stats.table.domain", lang: "en", value: "Domain" },

      { key: "export.success", lang: "de", value: "Export erfolgreich" },
      { key: "export.success", lang: "en", value: "Export successful" },
      { key: "export.success_desc", lang: "de", value: "wurden heruntergeladen." },
      { key: "export.success_desc", lang: "en", value: "have been downloaded." },
      { key: "export.failed", lang: "de", value: "Export fehlgeschlagen" },
      { key: "export.failed", lang: "en", value: "Export failed" },
      { key: "export.failed_desc", lang: "de", value: "Die Daten konnten nicht exportiert werden." },
      { key: "export.failed_desc", lang: "en", value: "The data could not be exported." },

      { key: "import.preview.failed", lang: "de", value: "Vorschau fehlgeschlagen" },
      { key: "import.preview.failed", lang: "en", value: "Preview failed" },
      { key: "import.preview.failed_desc", lang: "de", value: "Die Datei konnte nicht gelesen werden." },
      { key: "import.preview.failed_desc", lang: "en", value: "The file could not be read." },
      { key: "import.validation_errors", lang: "de", value: "Import mit Validierungsfehlern" },
      { key: "import.validation_errors", lang: "en", value: "Import with validation errors" },
      { key: "import.validation_error_count", lang: "de", value: "Validierungsfehler" },
      { key: "import.validation_error_count", lang: "en", value: "Validation errors" },
      { key: "import.success", lang: "de", value: "Import erfolgreich" },
      { key: "import.success", lang: "en", value: "Import successful" },
      { key: "import.imported_desc", lang: "de", value: "neue Regeln importiert" },
      { key: "import.imported_desc", lang: "en", value: "new rules imported" },
      { key: "import.updated_desc", lang: "de", value: "Regeln aktualisiert." },
      { key: "import.updated_desc", lang: "en", value: "rules updated." },
      { key: "import.file_too_large", lang: "de", value: "Datei zu groß" },
      { key: "import.file_too_large", lang: "en", value: "File too large" },
      { key: "import.file_too_large_desc", lang: "de", value: "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei)." },
      { key: "import.file_too_large_desc", lang: "en", value: "The import file is too large. Please split the file into smaller files (e.g. max 50,000 rules per file)." },
      { key: "import.failed", lang: "de", value: "Import fehlgeschlagen" },
      { key: "import.failed", lang: "en", value: "Import failed" },
      { key: "import.failed_desc", lang: "de", value: "Die Regeln konnten nicht importiert werden. Überprüfen Sie das Dateiformat." },
      { key: "import.failed_desc", lang: "en", value: "The rules could not be imported. Please check the file format." },

      // Danger Zone
      { key: "danger.cache.title", lang: "de", value: "Cache Wartung" },
      { key: "danger.cache.title", lang: "en", value: "Cache Maintenance" },
      { key: "danger.cache.button", lang: "de", value: "Cache neu aufbauen" },
      { key: "danger.cache.button", lang: "en", value: "Rebuild Cache" },
      { key: "danger.cache.desc", lang: "de", value: "Nur bei Problemen mit der Regelerkennung notwendig." },
      { key: "danger.cache.desc", lang: "en", value: "Only necessary if there are problems with rule detection." },

      { key: "danger.cache.success", lang: "de", value: "Cache neu aufgebaut" },
      { key: "danger.cache.success", lang: "en", value: "Cache rebuilt" },
      { key: "danger.cache.success_desc", lang: "de", value: "Der Regel-Cache wurde erfolgreich neu erstellt." },
      { key: "danger.cache.success_desc", lang: "en", value: "The rule cache was successfully rebuilt." },
      { key: "danger.cache.error", lang: "de", value: "Fehler beim Cache-Neuaufbau" },
      { key: "danger.cache.error", lang: "en", value: "Error rebuilding cache" },
      { key: "danger.cache.error_desc", lang: "de", value: "Der Cache konnte nicht neu erstellt werden." },
      { key: "danger.cache.error_desc", lang: "en", value: "The cache could not be rebuilt." },

      { key: "danger.security.title", lang: "de", value: "Sicherheit" },
      { key: "danger.security.title", lang: "en", value: "Security" },
      { key: "danger.blocked_ips.button", lang: "de", value: "Blockierte IPs anzeigen und verwalten" },
      { key: "danger.blocked_ips.button", lang: "en", value: "Manage Blocked IPs" },
      { key: "danger.blocked_ips.desc", lang: "de", value: "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren." },
      { key: "danger.blocked_ips.desc", lang: "en", value: "View blocked IPs, block new IPs, or unblock individual ones." },

      { key: "danger.blocked_ips.success.block", lang: "de", value: "IP blockiert" },
      { key: "danger.blocked_ips.success.block", lang: "en", value: "IP blocked" },
      { key: "danger.blocked_ips.success.block_desc", lang: "de", value: "Die IP-Adresse wurde erfolgreich blockiert." },
      { key: "danger.blocked_ips.success.block_desc", lang: "en", value: "The IP address was successfully blocked." },
      { key: "danger.blocked_ips.success.unblock", lang: "de", value: "IP entsperrt" },
      { key: "danger.blocked_ips.success.unblock", lang: "en", value: "IP unblocked" },
      { key: "danger.blocked_ips.success.unblock_desc", lang: "de", value: "Die IP-Adresse wurde erfolgreich entsperrt." },
      { key: "danger.blocked_ips.success.unblock_desc", lang: "en", value: "The IP address was successfully unblocked." },
      { key: "danger.blocked_ips.error.title", lang: "de", value: "Fehler" },
      { key: "danger.blocked_ips.error.title", lang: "en", value: "Error" },
      { key: "danger.blocked_ips.error.block", lang: "de", value: "IP konnte nicht blockiert werden." },
      { key: "danger.blocked_ips.error.block", lang: "en", value: "IP could not be blocked." },
      { key: "danger.blocked_ips.error.unblock", lang: "de", value: "IP konnte nicht entsperrt werden." },
      { key: "danger.blocked_ips.error.unblock", lang: "en", value: "IP could not be unblocked." },

      { key: "danger.destructive.title", lang: "de", value: "Destruktive Aktionen" },
      { key: "danger.destructive.title", lang: "en", value: "Destructive Actions" },

      { key: "danger.delete_rules.button", lang: "de", value: "Alle Regeln löschen" },
      { key: "danger.delete_rules.button", lang: "en", value: "Delete All Rules" },
      { key: "danger.delete_rules.desc", lang: "de", value: "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich." },
      { key: "danger.delete_rules.desc", lang: "en", value: "Irrevocably deletes all existing redirect rules." },

      { key: "danger.delete_rules.success", lang: "de", value: "Alle Regeln gelöscht" },
      { key: "danger.delete_rules.success", lang: "en", value: "All rules deleted" },
      { key: "danger.delete_rules.success_desc", lang: "de", value: "Alle URL-Regeln wurden erfolgreich gelöscht." },
      { key: "danger.delete_rules.success_desc", lang: "en", value: "All URL rules were successfully deleted." },
      { key: "danger.delete_rules.error", lang: "de", value: "Fehler" },
      { key: "danger.delete_rules.error", lang: "en", value: "Error" },
      { key: "danger.delete_rules.error_desc", lang: "de", value: "Fehler beim Löschen aller Regeln." },
      { key: "danger.delete_rules.error_desc", lang: "en", value: "Error deleting all rules." },

      { key: "danger.delete_stats.button", lang: "de", value: "Alle Statistiken löschen" },
      { key: "danger.delete_stats.button", lang: "en", value: "Delete All Statistics" },
      { key: "danger.delete_stats.desc", lang: "de", value: "Löscht alle erfassten Tracking-Daten unwiderruflich." },
      { key: "danger.delete_stats.desc", lang: "en", value: "Irrevocably deletes all collected tracking data." },

      { key: "danger.delete_stats.success", lang: "de", value: "Alle Statistiken gelöscht" },
      { key: "danger.delete_stats.success", lang: "en", value: "All statistics deleted" },
      { key: "danger.delete_stats.success_desc", lang: "de", value: "Alle Tracking-Daten wurden erfolgreich gelöscht." },
      { key: "danger.delete_stats.success_desc", lang: "en", value: "All tracking data was successfully deleted." },

      { key: "danger.delete_ips.button", lang: "de", value: "Blockierte IPs löschen" },
      { key: "danger.delete_ips.button", lang: "en", value: "Clear Blocked IPs" },
      { key: "danger.delete_ips.desc", lang: "de", value: "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff." },
      { key: "danger.delete_ips.desc", lang: "en", value: "Clears all blocked IP addresses. Blocked users regain access immediately." },

      { key: "danger.delete_ips.success", lang: "de", value: "Blockierte IPs gelöscht" },
      { key: "danger.delete_ips.success", lang: "en", value: "Blocked IPs cleared" },
      { key: "danger.delete_ips.success_desc", lang: "de", value: "Alle blockierten IP-Adressen wurden erfolgreich gelöscht." },
      { key: "danger.delete_ips.success_desc", lang: "en", value: "All blocked IP addresses were successfully cleared." },

      // Migration Page
      { key: "migration.copy_fail_title", lang: "de", value: "Kopieren fehlgeschlagen" },
      { key: "migration.copy_fail_title", lang: "en", value: "Copy failed" },
      { key: "migration.copy_fail_desc", lang: "de", value: "Bitte kopieren Sie die URL manuell." },
      { key: "migration.copy_fail_desc", lang: "en", value: "Please copy the URL manually." },
      { key: "migration.new_info_item", lang: "de", value: "Neuer Info-Punkt" },
      { key: "migration.new_info_item", lang: "en", value: "New Info Item" },
      { key: "migration.logo_alt", lang: "de", value: "Logo" },
      { key: "migration.logo_alt", lang: "en", value: "Logo" },

      // Toast - Auth
      { key: "auth.required.title", lang: "de", value: "Authentifizierung erforderlich" },
      { key: "auth.required.title", lang: "en", value: "Authentication required" },
      { key: "auth.required.desc", lang: "de", value: "Bitte melden Sie sich erneut an." },
      { key: "auth.required.desc", lang: "en", value: "Please log in again." },

      // Toast - Rules
      { key: "toast.rule.delete_error", lang: "de", value: "Die Regel konnte nicht gelöscht werden." },
      { key: "toast.rule.delete_error", lang: "en", value: "The rule could not be deleted." },
      { key: "toast.rule.force_create_success", lang: "de", value: "Die URL-Regel wurde trotz Warnung erfolgreich erstellt." },
      { key: "toast.rule.force_create_success", lang: "en", value: "The URL rule was successfully created despite warning." },
      { key: "toast.rule.force_create_error", lang: "de", value: "Die Regel konnte auch mit Force-Option nicht erstellt werden." },
      { key: "toast.rule.force_create_error", lang: "en", value: "The rule could not be created even with force option." },
      { key: "toast.rule.force_update_success", lang: "de", value: "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert." },
      { key: "toast.rule.force_update_success", lang: "en", value: "The URL rule was successfully updated despite warning." },
      { key: "toast.rule.force_update_error", lang: "de", value: "Die Regel konnte auch mit Force-Option nicht aktualisiert werden." },
      { key: "toast.rule.force_update_error", lang: "en", value: "The rule could not be updated even with force option." },

      // Toast - Stats
      { key: "toast.stats.delete_all_error", lang: "de", value: "Fehler beim Löschen aller Statistiken." },
      { key: "toast.stats.delete_all_error", lang: "en", value: "Error deleting all statistics." },

      // Toast - IPs
      { key: "toast.ips.delete_error", lang: "de", value: "Fehler beim Löschen der blockierten IPs." },
      { key: "toast.ips.delete_error", lang: "en", value: "Error deleting blocked IPs." },

      // Toast - Settings
      { key: "toast.settings.save_error", lang: "de", value: "Die Einstellungen konnten nicht gespeichert werden." },
      { key: "toast.settings.save_error", lang: "en", value: "Settings could not be saved." },

      // Toast - Import
      { key: "toast.import.settings_success", lang: "de", value: "Die Einstellungen wurden erfolgreich importiert." },
      { key: "toast.import.settings_success", lang: "en", value: "Settings successfully imported." },
      { key: "toast.import.settings_error", lang: "de", value: "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat." },
      { key: "toast.import.settings_error", lang: "en", value: "Settings could not be imported. Please check the file format." },

      // Import
      { key: "import.failed", lang: "de", value: "Import fehlgeschlagen" },
      { key: "import.failed", lang: "en", value: "Import failed" },

      // Dialogs - Auto Redirect
      { key: "dialog.auto_redirect.title", lang: "de", value: "Wichtiger Hinweis" },
      { key: "dialog.auto_redirect.title", lang: "en", value: "Important Notice" },
      { key: "dialog.auto_redirect.content", lang: "de", value: "Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet." },
      { key: "dialog.auto_redirect.content", lang: "en", value: "You are about to enable automatic immediate redirection for all visitors and all URLs. Visitors will be automatically redirected to the new URL immediately without seeing the page." },
      { key: "dialog.auto_redirect.warning_title", lang: "de", value: "Wichtiger Hinweis:" },
      { key: "dialog.auto_redirect.warning_title", lang: "en", value: "Important Notice:" },
      { key: "dialog.auto_redirect.warning_text", lang: "de", value: "Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter" },
      { key: "dialog.auto_redirect.warning_text", lang: "en", value: "When automatic redirection is enabled, users can only access the admin settings via the URL parameter" },
      { key: "dialog.auto_redirect.confirm", lang: "de", value: "Ich habe verstanden" },
      { key: "dialog.auto_redirect.confirm", lang: "en", value: "I understand" },
      { key: "dialog.auto_redirect.cancel", lang: "de", value: "Abbrechen" },
      { key: "dialog.auto_redirect.cancel", lang: "en", value: "Cancel" },

      // Dialogs - Delete Stats
      { key: "dialog.delete_stats.title", lang: "de", value: "Alle Statistiken löschen?" },
      { key: "dialog.delete_stats.title", lang: "en", value: "Delete all statistics?" },
      { key: "dialog.delete_stats.content", lang: "de", value: "Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden." },
      { key: "dialog.delete_stats.content", lang: "en", value: "This will irrevocably delete all collected tracking data. This action cannot be undone." },
      { key: "dialog.delete_stats.warning", lang: "de", value: "Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen." },
      { key: "dialog.delete_stats.warning", lang: "en", value: "We strongly recommend creating a backup before deleting." },
      { key: "dialog.delete_stats.confirm_label", lang: "de", value: "Bestätigung erforderlich" },
      { key: "dialog.delete_stats.confirm_label", lang: "en", value: "Confirmation required" },
      { key: "dialog.delete_stats.confirm_placeholder", lang: "de", value: 'Tippen Sie "DELETE" zur Bestätigung' },
      { key: "dialog.delete_stats.confirm_placeholder", lang: "en", value: 'Type "DELETE" to confirm' },
      { key: "dialog.delete_stats.button", lang: "de", value: "Alles löschen" },
      { key: "dialog.delete_stats.button", lang: "en", value: "Delete all" },

      // Dialogs - Delete IPs
      { key: "dialog.delete_ips.title", lang: "de", value: "Blockierte IPs löschen?" },
      { key: "dialog.delete_ips.title", lang: "en", value: "Clear blocked IPs?" },
      { key: "dialog.delete_ips.content", lang: "de", value: "Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden." },
      { key: "dialog.delete_ips.content", lang: "en", value: "This clears all currently blocked IP addresses. Users can log in again immediately." },
      { key: "dialog.delete_ips.warning", lang: "de", value: "Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf." },
      { key: "dialog.delete_ips.warning", lang: "en", value: "This action lifts brute force protection for all currently locked users." },

      // Dialogs - Manage IPs
      { key: "dialog.manage_ips.title", lang: "de", value: "Blockierte IPs verwalten" },
      { key: "dialog.manage_ips.title", lang: "en", value: "Manage Blocked IPs" },
      { key: "dialog.manage_ips.desc", lang: "de", value: "Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten." },
      { key: "dialog.manage_ips.desc", lang: "en", value: "Here you can view and manage currently blocked IP addresses." },
      { key: "dialog.manage_ips.placeholder", lang: "de", value: "IP-Adresse (z.B. 192.168.1.1)" },
      { key: "dialog.manage_ips.placeholder", lang: "en", value: "IP Address (e.g. 192.168.1.1)" },
      { key: "dialog.manage_ips.block_button", lang: "de", value: "Blockieren" },
      { key: "dialog.manage_ips.block_button", lang: "en", value: "Block" },
      { key: "dialog.manage_ips.table.ip", lang: "de", value: "IP-Adresse" },
      { key: "dialog.manage_ips.table.ip", lang: "en", value: "IP Address" },
      { key: "dialog.manage_ips.table.attempts", lang: "de", value: "Fehlversuche" },
      { key: "dialog.manage_ips.table.attempts", lang: "en", value: "Attempts" },
      { key: "dialog.manage_ips.table.blocked_until", lang: "de", value: "Blockiert bis" },
      { key: "dialog.manage_ips.table.blocked_until", lang: "en", value: "Blocked until" },
      { key: "dialog.manage_ips.no_data", lang: "de", value: "Keine blockierten IP-Adressen." },
      { key: "dialog.manage_ips.no_data", lang: "en", value: "No blocked IP addresses." },

      // Dialogs - Validation
      { key: "dialog.validation.title", lang: "de", value: "Validierungswarnung" },
      { key: "dialog.validation.title", lang: "en", value: "Validation Warning" },
      { key: "dialog.validation.content", lang: "de", value: "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?" },
      { key: "dialog.validation.content", lang: "en", value: "Do you want to save the rule despite the following warning(s)?" },
      { key: "dialog.validation.save_anyway", lang: "de", value: "Trotzdem speichern" },
      { key: "dialog.validation.save_anyway", lang: "en", value: "Save anyway" },

      // Dialogs - Bulk Delete
      { key: "dialog.bulk_delete.title", lang: "de", value: "Regeln löschen" },
      { key: "dialog.bulk_delete.title", lang: "en", value: "Delete Rules" },
      { key: "dialog.bulk_delete.content", lang: "de", value: "Sind Sie sicher, dass Sie die ausgewählten {count} Regeln löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden." },
      { key: "dialog.bulk_delete.content", lang: "en", value: "Are you sure you want to delete the selected {count} rules? This action cannot be undone." },
      { key: "dialog.bulk_delete.note", lang: "de", value: "Hinweis: Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht." },
      { key: "dialog.bulk_delete.note", lang: "en", value: "Note: Only rules selected on the current page will be deleted." },

      // Dialogs - Stats Limit
      { key: "dialog.stats_limit.title", lang: "de", value: "Statistik-Limitierung ändern?" },
      { key: "dialog.stats_limit.title", lang: "en", value: "Change Statistics Limit?" },
      { key: "dialog.stats_limit.content_part1", lang: "de", value: "Sie ändern das Limit für Statistik-Einträge von {old} auf {new}." },
      { key: "dialog.stats_limit.content_part1", lang: "en", value: "You are changing the limit for statistics entries from {old} to {new}." },
      { key: "dialog.stats_limit.content_part2", lang: "de", value: "Warnung: Wenn aktuell mehr als {new} Einträge vorhanden sind (aktuell: {total}), werden die ältesten Einträge beim Speichern unwiderruflich gelöscht." },
      { key: "dialog.stats_limit.content_part2", lang: "en", value: "Warning: If there are currently more than {new} entries (currently: {total}), the oldest entries will be irrevocably deleted upon saving." },
      { key: "dialog.stats_limit.confirm", lang: "de", value: "Verstanden & Speichern" },
      { key: "dialog.stats_limit.confirm", lang: "en", value: "Understand & Save" },
      { key: "dialog.stats_limit.unlimited", lang: "de", value: "Unbegrenzt" },
      { key: "dialog.stats_limit.unlimited", lang: "en", value: "Unlimited" },

      // Dialogs - Delete All Rules
      { key: "dialog.delete_all_rules.title", lang: "de", value: "Alle Regeln löschen?" },
      { key: "dialog.delete_all_rules.title", lang: "en", value: "Delete All Rules?" },
      { key: "dialog.delete_all_rules.content", lang: "de", value: "Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden." },
      { key: "dialog.delete_all_rules.content", lang: "en", value: "This will irrevocably delete all existing rules. This action cannot be undone." },
      { key: "dialog.backup.download_json", lang: "de", value: "Backup herunterladen (JSON)" },
      { key: "dialog.backup.download_json", lang: "en", value: "Download Backup (JSON)" },
      { key: "dialog.backup.download_csv", lang: "de", value: "Backup herunterladen (CSV)" },
      { key: "dialog.backup.download_csv", lang: "en", value: "Download Backup (CSV)" },

      // Import/Export Tabs
      { key: "export.standard.title", lang: "de", value: "Standard Import / Export (Excel, CSV)" },
      { key: "export.standard.title", lang: "en", value: "Standard Import / Export (Excel, CSV)" },
      { key: "export.standard.desc", lang: "de", value: "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV. Mit Vorschau-Funktion vor dem Import." },
      { key: "export.standard.desc", lang: "en", value: "User-friendly import and export for Redirect Rules. Supports Excel (.xlsx) and CSV. With preview function before import." },
      { key: "export.import.title", lang: "de", value: "Regeln Importieren" },
      { key: "export.import.title", lang: "en", value: "Import Rules" },
      { key: "export.import.desc", lang: "de", value: "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:" },
      { key: "export.import.desc", lang: "en", value: "Upload an Excel or CSV file. Expected columns:" },
      { key: "export.sample.excel", lang: "de", value: "Musterdatei (Excel)" },
      { key: "export.sample.excel", lang: "en", value: "Sample File (Excel)" },
      { key: "export.sample.csv", lang: "de", value: "Musterdatei (CSV)" },
      { key: "export.sample.csv", lang: "en", value: "Sample File (CSV)" },
      { key: "export.upload.label", lang: "de", value: "Klicken zum Auswählen" },
      { key: "export.upload.label", lang: "en", value: "Click to Select" },
      { key: "export.upload.drag", lang: "de", value: "oder Datei hierher ziehen" },
      { key: "export.upload.drag", lang: "en", value: "or drag file here" },
      { key: "export.upload.formats", lang: "de", value: "Excel (.xlsx) oder CSV" },
      { key: "export.upload.formats", lang: "en", value: "Excel (.xlsx) or CSV" },
      { key: "export.encode.title", lang: "de", value: "URLs automatisch kodieren" },
      { key: "export.encode.title", lang: "en", value: "Automatically encode URLs" },
      { key: "export.encode.desc", lang: "de", value: "Sonderzeichen in URLs automatisch konvertieren (encodeURI)" },
      { key: "export.encode.desc", lang: "en", value: "Automatically convert special characters in URLs (encodeURI)" },
      { key: "export.export_rules.title", lang: "de", value: "Regeln Exportieren" },
      { key: "export.export_rules.title", lang: "en", value: "Export Rules" },
      { key: "export.export_rules.desc", lang: "de", value: "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup. Die Dateien können später wieder importiert werden." },
      { key: "export.export_rules.desc", lang: "en", value: "Export all rules for editing in Excel or as a backup. The files can be imported again later." },
      { key: "export.download.excel", lang: "de", value: "Herunterladen (Excel)" },
      { key: "export.download.excel", lang: "en", value: "Download (Excel)" },
      { key: "export.download.csv", lang: "de", value: "Herunterladen (CSV)" },
      { key: "export.download.csv", lang: "en", value: "Download (CSV)" },
      { key: "export.download.json", lang: "de", value: "Herunterladen (JSON)" },
      { key: "export.download.json", lang: "en", value: "Download (JSON)" },
      { key: "export.advanced.title", lang: "de", value: "Erweiterter Regel-Import/Export" },
      { key: "export.advanced.title", lang: "en", value: "Advanced Rule Import/Export" },
      { key: "export.advanced.desc", lang: "de", value: "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau." },
      { key: "export.advanced.desc", lang: "en", value: "For advanced users and system backups. Imports raw data without preview." },
      { key: "export.advanced.json_title", lang: "de", value: "Regel-Rohdaten (JSON)" },
      { key: "export.advanced.json_title", lang: "en", value: "Raw Rule Data (JSON)" },
      { key: "export.advanced.import_button", lang: "de", value: "Importieren (JSON)" },
      { key: "export.advanced.import_button", lang: "en", value: "Import (JSON)" },
      { key: "export.advanced.warning", lang: "de", value: "Warnung: Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort." },
      { key: "export.advanced.warning", lang: "en", value: "Warning: No preview. Overwrites existing rules with ID conflict immediately." },
      { key: "export.system.title", lang: "de", value: "System & Statistiken" },
      { key: "export.system.title", lang: "en", value: "System & Statistics" },
      { key: "export.system.desc", lang: "de", value: "Verwaltung von Systemeinstellungen und Statistiken." },
      { key: "export.system.desc", lang: "en", value: "Management of system settings and statistics." },
      { key: "export.settings.title", lang: "de", value: "System-Einstellungen" },
      { key: "export.settings.title", lang: "en", value: "System Settings" },
      { key: "export.settings.desc", lang: "de", value: "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen." },
      { key: "export.settings.desc", lang: "en", value: "Export the complete configuration (titles, texts, colors) as a backup or to transfer it to another instance." },
      { key: "export.stats.title", lang: "de", value: "Statistiken" },
      { key: "export.stats.title", lang: "en", value: "Statistics" },
      { key: "export.stats.desc", lang: "de", value: "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse." },
      { key: "export.stats.desc", lang: "en", value: "Export the tracking logs of all redirects for external analysis." },

      // Toasts
      { key: "toast.error.title", lang: "de", value: "Fehler" },
      { key: "toast.error.title", lang: "en", value: "Error" },
      { key: "toast.success.title", lang: "de", value: "Erfolg" },
      { key: "toast.success.title", lang: "en", value: "Success" },
      { key: "toast.settings.saved", lang: "de", value: "Einstellungen gespeichert" },
      { key: "toast.settings.saved", lang: "en", value: "Settings saved" },
      { key: "toast.settings.saved_desc", lang: "de", value: "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert." },
      { key: "toast.settings.saved_desc", lang: "en", value: "General settings have been successfully updated." },
      { key: "toast.validation_error", lang: "de", value: "Validierungsfehler" },
      { key: "toast.validation_error", lang: "en", value: "Validation Error" },
      { key: "toast.logout.success", lang: "de", value: "Sie wurden erfolgreich abgemeldet." },
      { key: "toast.logout.success", lang: "en", value: "You have been successfully logged out." },
      { key: "toast.logout.error", lang: "de", value: "Abmeldung fehlgeschlagen" },
      { key: "toast.logout.error", lang: "en", value: "Logout failed" },

      // Field Names
      { key: "settings.field.headerTitle", lang: "de", value: "Titel" },
      { key: "settings.field.headerTitle", lang: "en", value: "Title" },
      { key: "settings.field.mainTitle", lang: "de", value: "Titel" },
      { key: "settings.field.mainTitle", lang: "en", value: "Title" },
      { key: "settings.field.mainDescription", lang: "de", value: "Beschreibung" },
      { key: "settings.field.mainDescription", lang: "en", value: "Description" },
      { key: "settings.field.footerCopyright", lang: "de", value: "Copyright-Text" },
      { key: "settings.field.footerCopyright", lang: "en", value: "Copyright Text" },
      { key: "settings.field.urlComparisonTitle", lang: "de", value: "Titel" },
      { key: "settings.field.urlComparisonTitle", lang: "en", value: "Title" },
      { key: "settings.field.oldUrlLabel", lang: "de", value: "Alte URL Label" },
      { key: "settings.field.oldUrlLabel", lang: "en", value: "Old URL Label" },
      { key: "settings.field.newUrlLabel", lang: "de", value: "Neue URL Label" },
      { key: "settings.field.newUrlLabel", lang: "en", value: "New URL Label" },
      { key: "settings.field.defaultNewDomain", lang: "de", value: "Standard-Domain" },
      { key: "settings.field.defaultNewDomain", lang: "en", value: "Default Domain" },
      { key: "settings.field.copyButtonText", lang: "de", value: "Kopieren Button-Text" },
      { key: "settings.field.copyButtonText", lang: "en", value: "Copy Button Text" },
      { key: "settings.field.openButtonText", lang: "de", value: "Öffnen Button-Text" },
      { key: "settings.field.openButtonText", lang: "en", value: "Open Button Text" },
      { key: "settings.field.showUrlButtonText", lang: "de", value: "URL anzeigen Button-Text" },
      { key: "settings.field.showUrlButtonText", lang: "en", value: "Show URL Button Text" },
      { key: "settings.field.popupButtonText", lang: "de", value: "PopUp Button-Text" },
      { key: "settings.field.popupButtonText", lang: "en", value: "Popup Button Text" },
      { key: "settings.field.specialHintsTitle", lang: "de", value: "Titel" },
      { key: "settings.field.specialHintsTitle", lang: "en", value: "Title" },
      { key: "settings.field.specialHintsDescription", lang: "de", value: "Standard-Beschreibung" },
      { key: "settings.field.specialHintsDescription", lang: "en", value: "Standard Description" },

      // Additional UI Elements
      { key: "common.loading_settings", lang: "de", value: "Lade Einstellungen..." },
      { key: "common.loading_settings", lang: "en", value: "Loading settings..." },
      { key: "common.please_login", lang: "de", value: "Bitte melden Sie sich an..." },
      { key: "common.please_login", lang: "en", value: "Please log in..." },
      { key: "common.search", lang: "de", value: "Suche..." },
      { key: "common.search", lang: "en", value: "Search..." },
      { key: "common.found_results", lang: "de", value: "gefunden" },
      { key: "common.found_results", lang: "en", value: "found" },
      { key: "common.total_results", lang: "de", value: "insgesamt" },
      { key: "common.total_results", lang: "en", value: "total" },
      { key: "common.page", lang: "de", value: "Seite" },
      { key: "common.page", lang: "en", value: "Page" },
      { key: "common.of", lang: "de", value: "von" },
      { key: "common.of", lang: "en", value: "of" },
      { key: "common.first", lang: "de", value: "Erste" },
      { key: "common.first", lang: "en", value: "First" },
      { key: "common.previous", lang: "de", value: "Vorherige" },
      { key: "common.previous", lang: "en", value: "Previous" },
      { key: "common.next", lang: "de", value: "Nächste" },
      { key: "common.next", lang: "en", value: "Next" },
      { key: "common.last", lang: "de", value: "Letzte" },
      { key: "common.last", lang: "en", value: "Last" },
    ];

    const newTranslations = seed.filter(t => !existingKeys.has(`${t.lang}:${t.key}`));

    if (newTranslations.length > 0) {
        const updated = [...all, ...newTranslations];
        await this.writeJsonFile(TRANSLATIONS_FILE, updated);
        this.translationsCache = updated;
    }
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

    for (const track of trackingData) {
      if (track.path === "/") continue;

      total++;

      // Optimization: Use string comparison for ISO dates to avoid Date parsing overhead
      if (track.timestamp >= todayIso) today++;
      if (track.timestamp >= weekIso) week++;
    }

    return { total, today, week };
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
        defaultLanguage: "de",
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
