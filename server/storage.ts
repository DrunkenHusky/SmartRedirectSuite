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
    // if (all.length > 0) return; // Removed to allow upsert/merge

    // Initial Seed with comprehensive translations
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

      // Admin Header
      { key: "admin.title", lang: "de", value: "Administrator-Bereich" },
      { key: "admin.title", lang: "en", value: "Admin Area" },
      { key: "admin.title", lang: "fr", value: "Espace Admin" },
      { key: "admin.title", lang: "it", value: "Area Admin" },

      { key: "admin.logout", lang: "de", value: "Abmelden" },
      { key: "admin.logout", lang: "en", value: "Logout" },
      { key: "admin.logout", lang: "fr", value: "Déconnexion" },
      { key: "admin.logout", lang: "it", value: "Disconnetti" },

      { key: "admin.close", lang: "de", value: "Schließen" },
      { key: "admin.close", lang: "en", value: "Close" },
      { key: "admin.close", lang: "fr", value: "Fermer" },
      { key: "admin.close", lang: "it", value: "Chiudi" },

      // Auth
      { key: "auth.title", lang: "de", value: "Administrator-Anmeldung" },
      { key: "auth.title", lang: "en", value: "Admin Login" },
      { key: "auth.title", lang: "fr", value: "Connexion Admin" },
      { key: "auth.title", lang: "it", value: "Accesso Admin" },

      { key: "auth.desc", lang: "de", value: "Bitte geben Sie das Administrator-Passwort ein." },
      { key: "auth.desc", lang: "en", value: "Please enter the administrator password." },
      { key: "auth.desc", lang: "fr", value: "Veuillez entrer le mot de passe administrateur." },
      { key: "auth.desc", lang: "it", value: "Inserisci la password dell'amministratore." },

      { key: "auth.password", lang: "de", value: "Passwort" },
      { key: "auth.password", lang: "en", value: "Password" },
      { key: "auth.password", lang: "fr", value: "Mot de passe" },
      { key: "auth.password", lang: "it", value: "Password" },

      { key: "auth.login", lang: "de", value: "Anmelden" },
      { key: "auth.login", lang: "en", value: "Login" },
      { key: "auth.login", lang: "fr", value: "Se connecter" },
      { key: "auth.login", lang: "it", value: "Accedi" },

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

      { key: "common.back", lang: "de", value: "Zurück" },
      { key: "common.back", lang: "en", value: "Back" },
      { key: "common.back", lang: "fr", value: "Retour" },
      { key: "common.back", lang: "it", value: "Indietro" },

      { key: "common.add", lang: "de", value: "Hinzufügen" },
      { key: "common.add", lang: "en", value: "Add" },
      { key: "common.add", lang: "fr", value: "Ajouter" },
      { key: "common.add", lang: "it", value: "Aggiungi" },

      // Settings General
      { key: "settings.title", lang: "de", value: "Allgemeine Einstellungen" },
      { key: "settings.title", lang: "en", value: "General Settings" },
      { key: "settings.title", lang: "fr", value: "Paramètres généraux" },
      { key: "settings.title", lang: "it", value: "Impostazioni generali" },

      { key: "settings.description", lang: "de", value: "Hier können Sie alle Texte der Anwendung anpassen." },
      { key: "settings.description", lang: "en", value: "Here you can customize all application texts." },
      { key: "settings.description", lang: "fr", value: "Ici, vous pouvez personnaliser tous les textes de l'application." },
      { key: "settings.description", lang: "it", value: "Qui puoi personalizzare tutti i testi dell'applicazione." },

      { key: "settings.visual_editor", lang: "de", value: "Visueller Editor" },
      { key: "settings.visual_editor", lang: "en", value: "Visual Editor" },
      { key: "settings.visual_editor", lang: "fr", value: "Éditeur visuel" },
      { key: "settings.visual_editor", lang: "it", value: "Editor visivo" },

      { key: "settings.language.default", lang: "de", value: "Hauptsprache" },
      { key: "settings.language.default", lang: "en", value: "Default Language" },
      { key: "settings.language.default", lang: "fr", value: "Langue par défaut" },
      { key: "settings.language.default", lang: "it", value: "Lingua predefinita" },

      // Settings - Header
      { key: "settings.section.header", lang: "de", value: "Header-Einstellungen" },
      { key: "settings.section.header", lang: "en", value: "Header Settings" },
      { key: "settings.section.header", lang: "fr", value: "Paramètres d'en-tête" },
      { key: "settings.section.header", lang: "it", value: "Impostazioni intestazione" },

      { key: "settings.field.title", lang: "de", value: "Titel" },
      { key: "settings.field.title", lang: "en", value: "Title" },
      { key: "settings.field.title", lang: "fr", value: "Titre" },
      { key: "settings.field.title", lang: "it", value: "Titolo" },

      { key: "settings.field.icon", lang: "de", value: "Icon" },
      { key: "settings.field.icon", lang: "en", value: "Icon" },
      { key: "settings.field.icon", lang: "fr", value: "Icône" },
      { key: "settings.field.icon", lang: "it", value: "Icona" },

      { key: "settings.field.bgcolor", lang: "de", value: "Hintergrundfarbe" },
      { key: "settings.field.bgcolor", lang: "en", value: "Background Color" },
      { key: "settings.field.bgcolor", lang: "fr", value: "Couleur de fond" },
      { key: "settings.field.bgcolor", lang: "it", value: "Colore di sfondo" },

      { key: "settings.field.logo", lang: "de", value: "Logo hochladen" },
      { key: "settings.field.logo", lang: "en", value: "Upload Logo" },
      { key: "settings.field.logo", lang: "fr", value: "Télécharger le logo" },
      { key: "settings.field.logo", lang: "it", value: "Carica logo" },

      // Settings - PopUp
      { key: "settings.section.popup", lang: "de", value: "PopUp-Einstellungen" },
      { key: "settings.section.popup", lang: "en", value: "PopUp Settings" },
      { key: "settings.section.popup", lang: "fr", value: "Paramètres PopUp" },
      { key: "settings.section.popup", lang: "it", value: "Impostazioni PopUp" },

      { key: "settings.field.description", lang: "de", value: "Beschreibung" },
      { key: "settings.field.description", lang: "en", value: "Description" },
      { key: "settings.field.description", lang: "fr", value: "Description" },
      { key: "settings.field.description", lang: "it", value: "Descrizione" },

      { key: "settings.field.popup_button", lang: "de", value: "PopUp Button-Text" },
      { key: "settings.field.popup_button", lang: "en", value: "PopUp Button Text" },
      { key: "settings.field.popup_button", lang: "fr", value: "Texte du bouton PopUp" },
      { key: "settings.field.popup_button", lang: "it", value: "Testo pulsante PopUp" },

      // Settings - Routing
      { key: "settings.section.routing", lang: "de", value: "Routing & Fallback-Verhalten" },
      { key: "settings.section.routing", lang: "en", value: "Routing & Fallback Behavior" },
      { key: "settings.section.routing", lang: "fr", value: "Routage et comportement de repli" },
      { key: "settings.section.routing", lang: "it", value: "Routing e comportamento di fallback" },

      { key: "settings.field.target_domain", lang: "de", value: "Ziel-Domain" },
      { key: "settings.field.target_domain", lang: "en", value: "Target Domain" },
      { key: "settings.field.target_domain", lang: "fr", value: "Domaine cible" },
      { key: "settings.field.target_domain", lang: "it", value: "Dominio di destinazione" },

      { key: "settings.field.fallback_strategy", lang: "de", value: "Fallback-Strategie" },
      { key: "settings.field.fallback_strategy", lang: "en", value: "Fallback Strategy" },
      { key: "settings.field.fallback_strategy", lang: "fr", value: "Stratégie de repli" },
      { key: "settings.field.fallback_strategy", lang: "it", value: "Strategia di fallback" },

      { key: "settings.strategy.simple", lang: "de", value: "Einfacher Domain-Austausch" },
      { key: "settings.strategy.simple", lang: "en", value: "Simple Domain Replacement" },
      { key: "settings.strategy.simple", lang: "fr", value: "Remplacement simple de domaine" },
      { key: "settings.strategy.simple", lang: "it", value: "Sostituzione semplice dominio" },

      { key: "settings.strategy.smart", lang: "de", value: "Intelligente Such-Weiterleitung" },
      { key: "settings.strategy.smart", lang: "en", value: "Smart Search Redirect" },
      { key: "settings.strategy.smart", lang: "fr", value: "Redirection de recherche intelligente" },
      { key: "settings.strategy.smart", lang: "it", value: "Reindirizzamento ricerca intelligente" },

      // Settings - Footer
      { key: "settings.section.footer", lang: "de", value: "Footer" },
      { key: "settings.section.footer", lang: "en", value: "Footer" },
      { key: "settings.section.footer", lang: "fr", value: "Pied de page" },
      { key: "settings.section.footer", lang: "it", value: "Piè di pagina" },

      { key: "settings.field.copyright", lang: "de", value: "Copyright-Text" },
      { key: "settings.field.copyright", lang: "en", value: "Copyright Text" },
      { key: "settings.field.copyright", lang: "fr", value: "Texte de copyright" },
      { key: "settings.field.copyright", lang: "it", value: "Testo copyright" },

      // Settings - Feedback
      { key: "settings.section.feedback", lang: "de", value: "Benutzer-Feedback-Umfrage" },
      { key: "settings.section.feedback", lang: "en", value: "User Feedback Survey" },
      { key: "settings.section.feedback", lang: "fr", value: "Enquête de satisfaction" },
      { key: "settings.section.feedback", lang: "it", value: "Sondaggio feedback utente" },

      { key: "settings.field.feedback_enable", lang: "de", value: "Feedback-Umfrage aktivieren" },
      { key: "settings.field.feedback_enable", lang: "en", value: "Enable Feedback Survey" },
      { key: "settings.field.feedback_enable", lang: "fr", value: "Activer l'enquête" },
      { key: "settings.field.feedback_enable", lang: "it", value: "Abilita sondaggio" },

      { key: "settings.field.feedback_title", lang: "de", value: "Umfrage Titel" },
      { key: "settings.field.feedback_title", lang: "en", value: "Survey Title" },
      { key: "settings.field.feedback_title", lang: "fr", value: "Titre de l'enquête" },
      { key: "settings.field.feedback_title", lang: "it", value: "Titolo sondaggio" },

      { key: "settings.field.feedback_question", lang: "de", value: "Umfrage Frage" },
      { key: "settings.field.feedback_question", lang: "en", value: "Survey Question" },
      { key: "settings.field.feedback_question", lang: "fr", value: "Question de l'enquête" },
      { key: "settings.field.feedback_question", lang: "it", value: "Domanda sondaggio" },

      // Rules
      { key: "rules.title", lang: "de", value: "URL-Transformationsregeln" },
      { key: "rules.title", lang: "en", value: "URL Transformation Rules" },
      { key: "rules.title", lang: "fr", value: "Règles de transformation URL" },
      { key: "rules.title", lang: "it", value: "Regole di trasformazione URL" },

      { key: "rules.create_new", lang: "de", value: "Neue Regel" },
      { key: "rules.create_new", lang: "en", value: "New Rule" },
      { key: "rules.create_new", lang: "fr", value: "Nouvelle règle" },
      { key: "rules.create_new", lang: "it", value: "Nuova regola" },

      { key: "rules.search_placeholder", lang: "de", value: "Regeln durchsuchen..." },
      { key: "rules.search_placeholder", lang: "en", value: "Search rules..." },
      { key: "rules.search_placeholder", lang: "fr", value: "Rechercher des règles..." },
      { key: "rules.search_placeholder", lang: "it", value: "Cerca regole..." },

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

      // Stats
      { key: "stats.top100", lang: "de", value: "Top 100" },
      { key: "stats.top100", lang: "en", value: "Top 100" },
      { key: "stats.top100", lang: "fr", value: "Top 100" },
      { key: "stats.top100", lang: "it", value: "Top 100" },

      { key: "stats.all_entries", lang: "de", value: "Alle Einträge" },
      { key: "stats.all_entries", lang: "en", value: "All Entries" },
      { key: "stats.all_entries", lang: "fr", value: "Toutes les entrées" },
      { key: "stats.all_entries", lang: "it", value: "Tutte le voci" },

      { key: "stats.search_placeholder", lang: "de", value: "Einträge suchen..." },
      { key: "stats.search_placeholder", lang: "en", value: "Search entries..." },
      { key: "stats.search_placeholder", lang: "fr", value: "Rechercher des entrées..." },
      { key: "stats.search_placeholder", lang: "it", value: "Cerca voci..." },

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

      { key: "stats.no_data", lang: "de", value: "Keine Daten vorhanden." },
      { key: "stats.no_data", lang: "en", value: "No data available." },
      { key: "stats.no_data", lang: "fr", value: "Aucune donnée disponible." },
      { key: "stats.no_data", lang: "it", value: "Nessun dato disponibile." },

      { key: "stats.path", lang: "de", value: "URL-Pfad" },
      { key: "stats.path", lang: "en", value: "Path" },
      { key: "stats.path", lang: "fr", value: "Chemin" },
      { key: "stats.path", lang: "it", value: "Percorso" },

      { key: "stats.views", lang: "de", value: "Aufrufe" },
      { key: "stats.views", lang: "en", value: "Views" },
      { key: "stats.views", lang: "fr", value: "Vues" },
      { key: "stats.views", lang: "it", value: "Visualizzazioni" },

      { key: "stats.share", lang: "de", value: "Anteil" },
      { key: "stats.share", lang: "en", value: "Share" },
      { key: "stats.share", lang: "fr", value: "Part" },
      { key: "stats.share", lang: "it", value: "Quota" },

      { key: "stats.domain", lang: "de", value: "Domain" },
      { key: "stats.domain", lang: "en", value: "Domain" },
      { key: "stats.domain", lang: "fr", value: "Domaine" },
      { key: "stats.domain", lang: "it", value: "Dominio" },

      { key: "stats.count", lang: "de", value: "Anzahl" },
      { key: "stats.count", lang: "en", value: "Count" },
      { key: "stats.count", lang: "fr", value: "Nombre" },
      { key: "stats.count", lang: "it", value: "Conteggio" },

      { key: "stats.top_urls", lang: "de", value: "Top URLs" },
      { key: "stats.top_urls", lang: "en", value: "Top URLs" },
      { key: "stats.top_urls", lang: "fr", value: "Top URLs" },
      { key: "stats.top_urls", lang: "it", value: "URL principali" },

      { key: "stats.top_referrers", lang: "de", value: "Top Referrer" },
      { key: "stats.top_referrers", lang: "en", value: "Top Referrers" },
      { key: "stats.top_referrers", lang: "fr", value: "Meilleurs référents" },
      { key: "stats.top_referrers", lang: "it", value: "Principali referrer" },

      { key: "stats.last_24h", lang: "de", value: "Letzte 24h" },
      { key: "stats.last_24h", lang: "en", value: "Last 24h" },
      { key: "stats.last_24h", lang: "fr", value: "Dernières 24h" },
      { key: "stats.last_24h", lang: "it", value: "Ultime 24h" },

      { key: "stats.last_7d", lang: "de", value: "Letzte 7 Tage" },
      { key: "stats.last_7d", lang: "en", value: "Last 7 days" },
      { key: "stats.last_7d", lang: "fr", value: "Derniers 7 jours" },
      { key: "stats.last_7d", lang: "it", value: "Ultimi 7 giorni" },

      { key: "stats.all_time", lang: "de", value: "Alle Zeit" },
      { key: "stats.all_time", lang: "en", value: "All time" },
      { key: "stats.all_time", lang: "fr", value: "Tout le temps" },
      { key: "stats.all_time", lang: "it", value: "Tutto il tempo" },

      { key: "stats.filter_rule", lang: "de", value: "Regel-Filter" },
      { key: "stats.filter_rule", lang: "en", value: "Rule Filter" },
      { key: "stats.filter_rule", lang: "fr", value: "Filtre de règle" },
      { key: "stats.filter_rule", lang: "it", value: "Filtro regola" },

      { key: "stats.filter_all", lang: "de", value: "Alle Einträge" },
      { key: "stats.filter_all", lang: "en", value: "All entries" },
      { key: "stats.filter_all", lang: "fr", value: "Toutes les entrées" },
      { key: "stats.filter_all", lang: "it", value: "Tutte le voci" },

      { key: "stats.filter_with_rule", lang: "de", value: "Nur mit Regeln" },
      { key: "stats.filter_with_rule", lang: "en", value: "With rules only" },
      { key: "stats.filter_with_rule", lang: "fr", value: "Avec règles seulement" },
      { key: "stats.filter_with_rule", lang: "it", value: "Solo con regole" },

      { key: "stats.filter_no_rule", lang: "de", value: "Nur ohne Regeln" },
      { key: "stats.filter_no_rule", lang: "en", value: "Without rules only" },
      { key: "stats.filter_no_rule", lang: "fr", value: "Sans règles seulement" },
      { key: "stats.filter_no_rule", lang: "it", value: "Solo senza regole" },

      { key: "stats.filter_quality", lang: "de", value: "Qualität" },
      { key: "stats.filter_quality", lang: "en", value: "Quality" },
      { key: "stats.filter_quality", lang: "fr", value: "Qualité" },
      { key: "stats.filter_quality", lang: "it", value: "Qualità" },

      { key: "stats.filter_feedback", lang: "de", value: "Feedback" },
      { key: "stats.filter_feedback", lang: "en", value: "Feedback" },
      { key: "stats.filter_feedback", lang: "fr", value: "Feedback" },
      { key: "stats.filter_feedback", lang: "it", value: "Feedback" },

      // Rules new keys
      { key: "rules.loading", lang: "de", value: "Lade Regeln..." },
      { key: "rules.loading", lang: "en", value: "Loading rules..." },
      { key: "rules.loading", lang: "fr", value: "Chargement des règles..." },
      { key: "rules.loading", lang: "it", value: "Caricamento regole..." },

      { key: "rules.no_results", lang: "de", value: "Keine Regeln gefunden." },
      { key: "rules.no_results", lang: "en", value: "No rules found." },
      { key: "rules.no_results", lang: "fr", value: "Aucune règle trouvée." },
      { key: "rules.no_results", lang: "it", value: "Nessuna regola trovata." },

      { key: "rules.no_rules", lang: "de", value: "Keine Regeln vorhanden. Erstellen Sie eine neue Regel." },
      { key: "rules.no_rules", lang: "en", value: "No rules available. Create a new rule." },
      { key: "rules.no_rules", lang: "fr", value: "Aucune règle disponible. Créez une nouvelle règle." },
      { key: "rules.no_rules", lang: "it", value: "Nessuna regola disponibile. Crea una nuova regola." },

      { key: "rules.count_found", lang: "de", value: "Regeln gefunden" },
      { key: "rules.count_found", lang: "en", value: "rules found" },
      { key: "rules.count_found", lang: "fr", value: "règles trouvées" },
      { key: "rules.count_found", lang: "it", value: "regole trovate" },

      { key: "rules.count_total", lang: "de", value: "Regeln insgesamt" },
      { key: "rules.count_total", lang: "en", value: "rules total" },
      { key: "rules.count_total", lang: "fr", value: "règles au total" },
      { key: "rules.count_total", lang: "it", value: "regole totali" },

      { key: "rules.delete_selected", lang: "de", value: "löschen" },
      { key: "rules.delete_selected", lang: "en", value: "delete" },
      { key: "rules.delete_selected", lang: "fr", value: "supprimer" },
      { key: "rules.delete_selected", lang: "it", value: "elimina" },

      { key: "rules.page", lang: "de", value: "Seite" },
      { key: "rules.page", lang: "en", value: "Page" },
      { key: "rules.page", lang: "fr", value: "Page" },
      { key: "rules.page", lang: "it", value: "Pagina" },

      { key: "rules.of", lang: "de", value: "von" },
      { key: "rules.of", lang: "en", value: "of" },
      { key: "rules.of", lang: "fr", value: "sur" },
      { key: "rules.of", lang: "it", value: "di" },

      { key: "rules.first", lang: "de", value: "Erste" },
      { key: "rules.first", lang: "en", value: "First" },
      { key: "rules.first", lang: "fr", value: "Première" },
      { key: "rules.first", lang: "it", value: "Prima" },

      { key: "rules.prev", lang: "de", value: "Vorherige" },
      { key: "rules.prev", lang: "en", value: "Previous" },
      { key: "rules.prev", lang: "fr", value: "Précédente" },
      { key: "rules.prev", lang: "it", value: "Precedente" },

      { key: "rules.next", lang: "de", value: "Nächste" },
      { key: "rules.next", lang: "en", value: "Next" },
      { key: "rules.next", lang: "fr", value: "Suivante" },
      { key: "rules.next", lang: "it", value: "Successiva" },

      { key: "rules.last", lang: "de", value: "Letzte" },
      { key: "rules.last", lang: "en", value: "Last" },
      { key: "rules.last", lang: "fr", value: "Dernière" },
      { key: "rules.last", lang: "it", value: "Ultima" },

      { key: "rules.show_range", lang: "de", value: "Zeige" },
      { key: "rules.show_range", lang: "en", value: "Showing" },
      { key: "rules.show_range", lang: "fr", value: "Affichage" },
      { key: "rules.show_range", lang: "it", value: "Mostrando" },

      // Export
      { key: "export.title_standard", lang: "de", value: "Standard Import / Export (Excel, CSV)" },
      { key: "export.title_standard", lang: "en", value: "Standard Import / Export (Excel, CSV)" },
      { key: "export.title_standard", lang: "fr", value: "Import / Export Standard (Excel, CSV)" },
      { key: "export.title_standard", lang: "it", value: "Import / Export Standard (Excel, CSV)" },

      { key: "export.desc_standard", lang: "de", value: "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV. Mit Vorschau-Funktion vor dem Import." },
      { key: "export.desc_standard", lang: "en", value: "User-friendly import and export for redirect rules. Supports Excel (.xlsx) and CSV. With preview function before import." },
      { key: "export.desc_standard", lang: "fr", value: "Import et export convivial pour les règles de redirection. Prend en charge Excel (.xlsx) et CSV. Avec fonction de prévisualisation avant import." },
      { key: "export.desc_standard", lang: "it", value: "Importazione ed esportazione user-friendly per le regole di reindirizzamento. Supporta Excel (.xlsx) e CSV. Con funzione di anteprima prima dell'importazione." },

      { key: "export.import_rules", lang: "de", value: "Regeln Importieren" },
      { key: "export.import_rules", lang: "en", value: "Import Rules" },
      { key: "export.import_rules", lang: "fr", value: "Importer des règles" },
      { key: "export.import_rules", lang: "it", value: "Importa regole" },

      { key: "export.import_desc", lang: "de", value: "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:" },
      { key: "export.import_desc", lang: "en", value: "Upload an Excel or CSV file. Expected columns:" },
      { key: "export.import_desc", lang: "fr", value: "Téléchargez un fichier Excel ou CSV. Colonnes attendues :" },
      { key: "export.import_desc", lang: "it", value: "Carica un file Excel o CSV. Colonne previste:" },

      { key: "export.sample_excel", lang: "de", value: "Musterdatei (Excel)" },
      { key: "export.sample_excel", lang: "en", value: "Sample File (Excel)" },
      { key: "export.sample_excel", lang: "fr", value: "Fichier exemple (Excel)" },
      { key: "export.sample_excel", lang: "it", value: "File di esempio (Excel)" },

      { key: "export.sample_csv", lang: "de", value: "Musterdatei (CSV)" },
      { key: "export.sample_csv", lang: "en", value: "Sample File (CSV)" },
      { key: "export.sample_csv", lang: "fr", value: "Fichier exemple (CSV)" },
      { key: "export.sample_csv", lang: "it", value: "File di esempio (CSV)" },

      { key: "export.click_to_select", lang: "de", value: "Klicken zum Auswählen" },
      { key: "export.click_to_select", lang: "en", value: "Click to select" },
      { key: "export.click_to_select", lang: "fr", value: "Cliquez pour sélectionner" },
      { key: "export.click_to_select", lang: "it", value: "Clicca per selezionare" },

      { key: "export.drag_drop", lang: "de", value: "oder Datei hierher ziehen" },
      { key: "export.drag_drop", lang: "en", value: "or drag file here" },
      { key: "export.drag_drop", lang: "fr", value: "ou glissez le fichier ici" },
      { key: "export.drag_drop", lang: "it", value: "o trascina il file qui" },

      { key: "export.analyzing", lang: "de", value: "Analysiere Datei..." },
      { key: "export.analyzing", lang: "en", value: "Analyzing file..." },
      { key: "export.analyzing", lang: "fr", value: "Analyse du fichier..." },
      { key: "export.analyzing", lang: "it", value: "Analisi del file..." },

      { key: "export.auto_encode", lang: "de", value: "URLs automatisch kodieren" },
      { key: "export.auto_encode", lang: "en", value: "Auto-encode URLs" },
      { key: "export.auto_encode", lang: "fr", value: "Encoder automatiquement les URL" },
      { key: "export.auto_encode", lang: "it", value: "Codifica automatica URL" },

      { key: "export.auto_encode_desc", lang: "de", value: "Sonderzeichen in URLs automatisch konvertieren (encodeURI)" },
      { key: "export.auto_encode_desc", lang: "en", value: "Automatically convert special characters in URLs (encodeURI)" },
      { key: "export.auto_encode_desc", lang: "fr", value: "Convertir automatiquement les caractères spéciaux dans les URL (encodeURI)" },
      { key: "export.auto_encode_desc", lang: "it", value: "Converti automaticamente i caratteri speciali negli URL (encodeURI)" },

      { key: "export.export_rules", lang: "de", value: "Regeln Exportieren" },
      { key: "export.export_rules", lang: "en", value: "Export Rules" },
      { key: "export.export_rules", lang: "fr", value: "Exporter les règles" },
      { key: "export.export_rules", lang: "it", value: "Esporta regole" },

      { key: "export.export_desc", lang: "de", value: "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup. Die Dateien können später wieder importiert werden." },
      { key: "export.export_desc", lang: "en", value: "Export all rules for editing in Excel or as a backup. The files can be imported again later." },
      { key: "export.export_desc", lang: "fr", value: "Exportez toutes les règles pour modification dans Excel ou comme sauvegarde. Les fichiers peuvent être réimportés plus tard." },
      { key: "export.export_desc", lang: "it", value: "Esporta tutte le regole per la modifica in Excel o come backup. I file possono essere importati nuovamente in seguito." },

      { key: "export.download_excel", lang: "de", value: "Herunterladen (Excel)" },
      { key: "export.download_excel", lang: "en", value: "Download (Excel)" },
      { key: "export.download_excel", lang: "fr", value: "Télécharger (Excel)" },
      { key: "export.download_excel", lang: "it", value: "Scarica (Excel)" },

      { key: "export.download_csv", lang: "de", value: "Herunterladen (CSV)" },
      { key: "export.download_csv", lang: "en", value: "Download (CSV)" },
      { key: "export.download_csv", lang: "fr", value: "Télécharger (CSV)" },
      { key: "export.download_csv", lang: "it", value: "Scarica (CSV)" },

      { key: "export.title_advanced", lang: "de", value: "Erweiterter Regel-Import/Export" },
      { key: "export.title_advanced", lang: "en", value: "Advanced Rule Import/Export" },
      { key: "export.title_advanced", lang: "fr", value: "Import/Export avancé de règles" },
      { key: "export.title_advanced", lang: "it", value: "Import/Export avanzato regole" },

      { key: "export.desc_advanced", lang: "de", value: "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau." },
      { key: "export.desc_advanced", lang: "en", value: "For advanced users and system backups. Imports raw data without preview." },
      { key: "export.desc_advanced", lang: "fr", value: "Pour les utilisateurs avancés et les sauvegardes système. Importe des données brutes sans aperçu." },
      { key: "export.desc_advanced", lang: "it", value: "Per utenti avanzati e backup di sistema. Importa dati grezzi senza anteprima." },

      { key: "export.json_raw", lang: "de", value: "Regel-Rohdaten (JSON)" },
      { key: "export.json_raw", lang: "en", value: "Raw Rule Data (JSON)" },
      { key: "export.json_raw", lang: "fr", value: "Données brutes des règles (JSON)" },
      { key: "export.json_raw", lang: "it", value: "Dati grezzi delle regole (JSON)" },

      { key: "export.download_json", lang: "de", value: "Herunterladen (JSON)" },
      { key: "export.download_json", lang: "en", value: "Download (JSON)" },
      { key: "export.download_json", lang: "fr", value: "Télécharger (JSON)" },
      { key: "export.download_json", lang: "it", value: "Scarica (JSON)" },

      { key: "export.import_json", lang: "de", value: "Importieren (JSON)" },
      { key: "export.import_json", lang: "en", value: "Import (JSON)" },
      { key: "export.import_json", lang: "fr", value: "Importer (JSON)" },
      { key: "export.import_json", lang: "it", value: "Importa (JSON)" },

      { key: "export.warning_json", lang: "de", value: "Warnung: Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort." },
      { key: "export.warning_json", lang: "en", value: "Warning: No preview. Overwrites existing rules immediately in case of ID conflict." },
      { key: "export.warning_json", lang: "fr", value: "Attention : Pas d'aperçu. Écrase immédiatement les règles existantes en cas de conflit d'ID." },
      { key: "export.warning_json", lang: "it", value: "Attenzione: Nessuna anteprima. Sovrascrive immediatamente le regole esistenti in caso di conflitto ID." },

      { key: "export.title_system", lang: "de", value: "System & Statistiken" },
      { key: "export.title_system", lang: "en", value: "System & Statistics" },
      { key: "export.title_system", lang: "fr", value: "Système et statistiques" },
      { key: "export.title_system", lang: "it", value: "Sistema e statistiche" },

      { key: "export.desc_system", lang: "de", value: "Verwaltung von Systemeinstellungen und Statistiken." },
      { key: "export.desc_system", lang: "en", value: "Management of system settings and statistics." },
      { key: "export.desc_system", lang: "fr", value: "Gestion des paramètres système et des statistiques." },
      { key: "export.desc_system", lang: "it", value: "Gestione delle impostazioni di sistema e delle statistiche." },

      { key: "export.system_settings", lang: "de", value: "System-Einstellungen" },
      { key: "export.system_settings", lang: "en", value: "System Settings" },
      { key: "export.system_settings", lang: "fr", value: "Paramètres système" },
      { key: "export.system_settings", lang: "it", value: "Impostazioni di sistema" },

      { key: "export.system_settings_desc", lang: "de", value: "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen." },
      { key: "export.system_settings_desc", lang: "en", value: "Export the complete configuration (title, text, colors) as a backup or to transfer it to another instance." },
      { key: "export.system_settings_desc", lang: "fr", value: "Exportez la configuration complète (titre, textes, couleurs) comme sauvegarde ou pour la transférer vers une autre instance." },
      { key: "export.system_settings_desc", lang: "it", value: "Esporta la configurazione completa (titolo, testi, colori) come backup o per trasferirla su un'altra istanza." },

      { key: "export.stats", lang: "de", value: "Statistiken" },
      { key: "export.stats", lang: "en", value: "Statistics" },
      { key: "export.stats", lang: "fr", value: "Statistiques" },
      { key: "export.stats", lang: "it", value: "Statistiche" },

      { key: "export.stats_desc", lang: "de", value: "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse." },
      { key: "export.stats_desc", lang: "en", value: "Export the tracking logs of all redirects for external analysis." },
      { key: "export.stats_desc", lang: "fr", value: "Exportez les journaux de suivi de toutes les redirections pour une analyse externe." },
      { key: "export.stats_desc", lang: "it", value: "Esporta i log di tracciamento di tutti i reindirizzamenti per l'analisi esterna." },

      // Danger Zone
      { key: "danger.cache_maintenance", lang: "de", value: "Cache Wartung" },
      { key: "danger.cache_maintenance", lang: "en", value: "Cache Maintenance" },
      { key: "danger.cache_maintenance", lang: "fr", value: "Maintenance du cache" },
      { key: "danger.cache_maintenance", lang: "it", value: "Manutenzione cache" },

      { key: "danger.rebuild_cache", lang: "de", value: "Cache neu aufbauen" },
      { key: "danger.rebuild_cache", lang: "en", value: "Rebuild Cache" },
      { key: "danger.rebuild_cache", lang: "fr", value: "Reconstruire le cache" },
      { key: "danger.rebuild_cache", lang: "it", value: "Ricostruisci cache" },

      { key: "danger.rebuild_cache_desc", lang: "de", value: "Nur bei Problemen mit der Regelerkennung notwendig." },
      { key: "danger.rebuild_cache_desc", lang: "en", value: "Only necessary if there are problems with rule detection." },
      { key: "danger.rebuild_cache_desc", lang: "fr", value: "Nécessaire uniquement en cas de problème de détection de règle." },
      { key: "danger.rebuild_cache_desc", lang: "it", value: "Necessario solo in caso di problemi con il rilevamento delle regole." },

      { key: "danger.security", lang: "de", value: "Sicherheit" },
      { key: "danger.security", lang: "en", value: "Security" },
      { key: "danger.security", lang: "fr", value: "Sécurité" },
      { key: "danger.security", lang: "it", value: "Sicurezza" },

      { key: "danger.manage_ips", lang: "de", value: "Blockierte IPs anzeigen und verwalten" },
      { key: "danger.manage_ips", lang: "en", value: "View and manage blocked IPs" },
      { key: "danger.manage_ips", lang: "fr", value: "Voir et gérer les IP bloquées" },
      { key: "danger.manage_ips", lang: "it", value: "Visualizza e gestisci IP bloccati" },

      { key: "danger.manage_ips_desc", lang: "de", value: "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren." },
      { key: "danger.manage_ips_desc", lang: "en", value: "View list of blocked IPs, block new IPs or unblock individual ones." },
      { key: "danger.manage_ips_desc", lang: "fr", value: "Voir la liste des IP bloquées, bloquer de nouvelles IP ou en débloquer individuellement." },
      { key: "danger.manage_ips_desc", lang: "it", value: "Visualizza l'elenco degli IP bloccati, blocca nuovi IP o sblocca singoli IP." },

      { key: "danger.destructive", lang: "de", value: "Destruktive Aktionen" },
      { key: "danger.destructive", lang: "en", value: "Destructive Actions" },
      { key: "danger.destructive", lang: "fr", value: "Actions destructrices" },
      { key: "danger.destructive", lang: "it", value: "Azioni distruttive" },

      { key: "danger.delete_rules", lang: "de", value: "Alle Regeln löschen" },
      { key: "danger.delete_rules", lang: "en", value: "Delete All Rules" },
      { key: "danger.delete_rules", lang: "fr", value: "Supprimer toutes les règles" },
      { key: "danger.delete_rules", lang: "it", value: "Elimina tutte le regole" },

      { key: "danger.delete_rules_desc", lang: "de", value: "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich." },
      { key: "danger.delete_rules_desc", lang: "en", value: "Irrevocably deletes all existing redirect rules." },
      { key: "danger.delete_rules_desc", lang: "fr", value: "Supprime irrévocablement toutes les règles de redirection existantes." },
      { key: "danger.delete_rules_desc", lang: "it", value: "Elimina irrevocabilmente tutte le regole di reindirizzamento esistenti." },

      { key: "danger.delete_stats", lang: "de", value: "Alle Statistiken löschen" },
      { key: "danger.delete_stats", lang: "en", value: "Delete All Statistics" },
      { key: "danger.delete_stats", lang: "fr", value: "Supprimer toutes les statistiques" },
      { key: "danger.delete_stats", lang: "it", value: "Elimina tutte le statistiche" },

      { key: "danger.delete_stats_desc", lang: "de", value: "Löscht alle erfassten Tracking-Daten unwiderruflich." },
      { key: "danger.delete_stats_desc", lang: "en", value: "Irrevocably deletes all collected tracking data." },
      { key: "danger.delete_stats_desc", lang: "fr", value: "Supprime irrévocablement toutes les données de suivi collectées." },
      { key: "danger.delete_stats_desc", lang: "it", value: "Elimina irrevocabilmente tutti i dati di tracciamento raccolti." },

      { key: "danger.delete_ips", lang: "de", value: "Blockierte IPs löschen" },
      { key: "danger.delete_ips", lang: "en", value: "Delete Blocked IPs" },
      { key: "danger.delete_ips", lang: "fr", value: "Supprimer les IP bloquées" },
      { key: "danger.delete_ips", lang: "it", value: "Elimina IP bloccati" },

      { key: "danger.delete_ips_desc", lang: "de", value: "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff." },
      { key: "danger.delete_ips_desc", lang: "en", value: "Deletes all blocked IP addresses. Blocked users regain access immediately." },
      { key: "danger.delete_ips_desc", lang: "fr", value: "Supprime toutes les adresses IP bloquées. Les utilisateurs bloqués retrouvent immédiatement l'accès." },
      { key: "danger.delete_ips_desc", lang: "it", value: "Elimina tutti gli indirizzi IP bloccati. Gli utenti bloccati riottengono l'accesso immediatamente." },

      // Toasts
      { key: "toast.rule_created", lang: "de", value: "Regel erstellt" },
      { key: "toast.rule_created", lang: "en", value: "Rule Created" },
      { key: "toast.rule_created", lang: "fr", value: "Règle créée" },
      { key: "toast.rule_created", lang: "it", value: "Regola creata" },

      { key: "toast.rule_created_desc", lang: "de", value: "Die URL-Regel wurde erfolgreich erstellt." },
      { key: "toast.rule_created_desc", lang: "en", value: "The URL rule was successfully created." },
      { key: "toast.rule_created_desc", lang: "fr", value: "La règle URL a été créée avec succès." },
      { key: "toast.rule_created_desc", lang: "it", value: "La regola URL è stata creata con successo." },

      { key: "toast.rule_updated", lang: "de", value: "Regel aktualisiert" },
      { key: "toast.rule_updated", lang: "en", value: "Rule Updated" },
      { key: "toast.rule_updated", lang: "fr", value: "Règle mise à jour" },
      { key: "toast.rule_updated", lang: "it", value: "Regola aggiornata" },

      { key: "toast.rule_updated_desc", lang: "de", value: "Die URL-Regel wurde erfolgreich aktualisiert." },
      { key: "toast.rule_updated_desc", lang: "en", value: "The URL rule was successfully updated." },
      { key: "toast.rule_updated_desc", lang: "fr", value: "La règle URL a été mise à jour avec succès." },
      { key: "toast.rule_updated_desc", lang: "it", value: "La regola URL è stata aggiornata con successo." },

      { key: "toast.rule_deleted", lang: "de", value: "Regel gelöscht" },
      { key: "toast.rule_deleted", lang: "en", value: "Rule Deleted" },
      { key: "toast.rule_deleted", lang: "fr", value: "Règle supprimée" },
      { key: "toast.rule_deleted", lang: "it", value: "Regola eliminata" },

      { key: "toast.rule_deleted_desc", lang: "de", value: "1 Regel wurde erfolgreich gelöscht." },
      { key: "toast.rule_deleted_desc", lang: "en", value: "1 rule was successfully deleted." },
      { key: "toast.rule_deleted_desc", lang: "fr", value: "1 règle a été supprimée avec succès." },
      { key: "toast.rule_deleted_desc", lang: "it", value: "1 regola è stata eliminata con successo." },

      { key: "toast.rules_deleted", lang: "de", value: "Regeln gelöscht" },
      { key: "toast.rules_deleted", lang: "en", value: "Rules Deleted" },
      { key: "toast.rules_deleted", lang: "fr", value: "Règles supprimées" },
      { key: "toast.rules_deleted", lang: "it", value: "Regole eliminate" },

      { key: "toast.error", lang: "de", value: "Fehler" },
      { key: "toast.error", lang: "en", value: "Error" },
      { key: "toast.error", lang: "fr", value: "Erreur" },
      { key: "toast.error", lang: "it", value: "Errore" },

      { key: "toast.validation_error", lang: "de", value: "Validierungsfehler" },
      { key: "toast.validation_error", lang: "en", value: "Validation Error" },
      { key: "toast.validation_error", lang: "fr", value: "Erreur de validation" },
      { key: "toast.validation_error", lang: "it", value: "Errore di convalida" },

      { key: "toast.auth_required", lang: "de", value: "Authentifizierung erforderlich" },
      { key: "toast.auth_required", lang: "en", value: "Authentication Required" },
      { key: "toast.auth_required", lang: "fr", value: "Authentification requise" },
      { key: "toast.auth_required", lang: "it", value: "Autenticazione richiesta" },

      { key: "toast.auth_required_desc", lang: "de", value: "Bitte melden Sie sich erneut an." },
      { key: "toast.auth_required_desc", lang: "en", value: "Please log in again." },
      { key: "toast.auth_required_desc", lang: "fr", value: "Veuillez vous reconnecter." },
      { key: "toast.auth_required_desc", lang: "it", value: "Effettua nuovamente l'accesso." },

      { key: "toast.settings_saved", lang: "de", value: "Einstellungen gespeichert" },
      { key: "toast.settings_saved", lang: "en", value: "Settings Saved" },
      { key: "toast.settings_saved", lang: "fr", value: "Paramètres enregistrés" },
      { key: "toast.settings_saved", lang: "it", value: "Impostazioni salvate" },

      { key: "toast.settings_saved_desc", lang: "de", value: "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert." },
      { key: "toast.settings_saved_desc", lang: "en", value: "General settings have been successfully updated." },
      { key: "toast.settings_saved_desc", lang: "fr", value: "Les paramètres généraux ont été mis à jour avec succès." },
      { key: "toast.settings_saved_desc", lang: "it", value: "Le impostazioni generali sono state aggiornate con successo." },

      { key: "toast.import_success", lang: "de", value: "Import erfolgreich" },
      { key: "toast.import_success", lang: "en", value: "Import Successful" },
      { key: "toast.import_success", lang: "fr", value: "Import réussi" },
      { key: "toast.import_success", lang: "it", value: "Importazione riuscita" },

      { key: "toast.import_failed", lang: "de", value: "Import fehlgeschlagen" },
      { key: "toast.import_failed", lang: "en", value: "Import Failed" },
      { key: "toast.import_failed", lang: "fr", value: "Échec de l'importation" },
      { key: "toast.import_failed", lang: "it", value: "Importazione fallita" },

      { key: "toast.cache_rebuilt", lang: "de", value: "Cache neu aufgebaut" },
      { key: "toast.cache_rebuilt", lang: "en", value: "Cache Rebuilt" },
      { key: "toast.cache_rebuilt", lang: "fr", value: "Cache reconstruit" },
      { key: "toast.cache_rebuilt", lang: "it", value: "Cache ricostruita" },

      { key: "toast.cache_rebuilt_desc", lang: "de", value: "Der Regel-Cache wurde erfolgreich neu erstellt." },
      { key: "toast.cache_rebuilt_desc", lang: "en", value: "The rule cache was successfully rebuilt." },
      { key: "toast.cache_rebuilt_desc", lang: "fr", value: "Le cache des règles a été reconstruit avec succès." },
      { key: "toast.cache_rebuilt_desc", lang: "it", value: "La cache delle regole è stata ricostruita con successo." },

      { key: "toast.all_rules_deleted", lang: "de", value: "Alle Regeln gelöscht" },
      { key: "toast.all_rules_deleted", lang: "en", value: "All Rules Deleted" },
      { key: "toast.all_rules_deleted", lang: "fr", value: "Toutes les règles supprimées" },
      { key: "toast.all_rules_deleted", lang: "it", value: "Tutte le regole eliminate" },

      { key: "toast.all_stats_deleted", lang: "de", value: "Alle Statistiken gelöscht" },
      { key: "toast.all_stats_deleted", lang: "en", value: "All Statistics Deleted" },
      { key: "toast.all_stats_deleted", lang: "fr", value: "Toutes les statistiques supprimées" },
      { key: "toast.all_stats_deleted", lang: "it", value: "Tutte le statistiche eliminate" },

      { key: "toast.ips_cleared", lang: "de", value: "Blockierte IPs gelöscht" },
      { key: "toast.ips_cleared", lang: "en", value: "Blocked IPs Cleared" },
      { key: "toast.ips_cleared", lang: "fr", value: "IP bloquées effacées" },
      { key: "toast.ips_cleared", lang: "it", value: "IP bloccati cancellati" },

      // Dialogs
      { key: "dialog.rule.edit", lang: "de", value: "Regel bearbeiten" },
      { key: "dialog.rule.edit", lang: "en", value: "Edit Rule" },
      { key: "dialog.rule.edit", lang: "fr", value: "Modifier la règle" },
      { key: "dialog.rule.edit", lang: "it", value: "Modifica regola" },

      { key: "dialog.rule.create", lang: "de", value: "Neue Regel erstellen" },
      { key: "dialog.rule.create", lang: "en", value: "Create New Rule" },
      { key: "dialog.rule.create", lang: "fr", value: "Créer une nouvelle règle" },
      { key: "dialog.rule.create", lang: "it", value: "Crea nuova regola" },

      { key: "dialog.rule.edit_desc", lang: "de", value: "Bearbeiten Sie die existierende Regel hier." },
      { key: "dialog.rule.edit_desc", lang: "en", value: "Edit the existing rule here." },
      { key: "dialog.rule.edit_desc", lang: "fr", value: "Modifiez la règle existante ici." },
      { key: "dialog.rule.edit_desc", lang: "it", value: "Modifica qui la regola esistente." },

      { key: "dialog.rule.create_desc", lang: "de", value: "Erstellen Sie hier eine neue Regel." },
      { key: "dialog.rule.create_desc", lang: "en", value: "Create a new rule here." },
      { key: "dialog.rule.create_desc", lang: "fr", value: "Créez une nouvelle règle ici." },
      { key: "dialog.rule.create_desc", lang: "it", value: "Crea qui una nuova regola." },

      { key: "dialog.delete_rules", lang: "de", value: "Regeln löschen" },
      { key: "dialog.delete_rules", lang: "en", value: "Delete Rules" },
      { key: "dialog.delete_rules", lang: "fr", value: "Supprimer les règles" },
      { key: "dialog.delete_rules", lang: "it", value: "Elimina regole" },

      { key: "dialog.delete_rules_confirm", lang: "de", value: "Sind Sie sicher, dass Sie die ausgewählten Regeln löschen möchten?" },
      { key: "dialog.delete_rules_confirm", lang: "en", value: "Are you sure you want to delete the selected rules?" },
      { key: "dialog.delete_rules_confirm", lang: "fr", value: "Êtes-vous sûr de vouloir supprimer les règles sélectionnées ?" },
      { key: "dialog.delete_rules_confirm", lang: "it", value: "Sei sicuro di voler eliminare le regole selezionate?" },

      { key: "dialog.delete_all_rules", lang: "de", value: "Alle Regeln löschen?" },
      { key: "dialog.delete_all_rules", lang: "en", value: "Delete All Rules?" },
      { key: "dialog.delete_all_rules", lang: "fr", value: "Supprimer toutes les règles ?" },
      { key: "dialog.delete_all_rules", lang: "it", value: "Eliminare tutte le regole?" },

      { key: "dialog.delete_all_stats", lang: "de", value: "Alle Statistiken löschen?" },
      { key: "dialog.delete_all_stats", lang: "en", value: "Delete All Statistics?" },
      { key: "dialog.delete_all_stats", lang: "fr", value: "Supprimer toutes les statistiques ?" },
      { key: "dialog.delete_all_stats", lang: "it", value: "Eliminare tutte le statistiche?" },

      { key: "dialog.delete_all_confirm", lang: "de", value: "Dies löscht alle Daten unwiderruflich." },
      { key: "dialog.delete_all_confirm", lang: "en", value: "This will irrevocably delete all data." },
      { key: "dialog.delete_all_confirm", lang: "fr", value: "Cela supprimera irrévocablement toutes les données." },
      { key: "dialog.delete_all_confirm", lang: "it", value: "Ciò eliminerà irrevocabilmente tutti i dati." },

      { key: "dialog.validation", lang: "de", value: "Validierungswarnung" },
      { key: "dialog.validation", lang: "en", value: "Validation Warning" },
      { key: "dialog.validation", lang: "fr", value: "Avertissement de validation" },
      { key: "dialog.validation", lang: "it", value: "Avviso di convalida" },

      { key: "dialog.validation_desc", lang: "de", value: "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?" },
      { key: "dialog.validation_desc", lang: "en", value: "Do you want to save the rule despite the following warning(s)?" },
      { key: "dialog.validation_desc", lang: "fr", value: "Voulez-vous enregistrer la règle malgré le(s) avertissement(s) suivant(s) ?" },
      { key: "dialog.validation_desc", lang: "it", value: "Vuoi salvare la regola nonostante i seguenti avvisi?" },

      { key: "dialog.save_anyway", lang: "de", value: "Trotzdem speichern" },
      { key: "dialog.save_anyway", lang: "en", value: "Save Anyway" },
      { key: "dialog.save_anyway", lang: "fr", value: "Enregistrer quand même" },
      { key: "dialog.save_anyway", lang: "it", value: "Salva comunque" },

      // Editor
      { key: "editor.mode_active", lang: "de", value: "Editier-Modus" },
      { key: "editor.mode_active", lang: "en", value: "Edit Mode" },
      { key: "editor.mode_active", lang: "fr", value: "Mode édition" },
      { key: "editor.mode_active", lang: "it", value: "Modalità modifica" },

      // Dashboard
      { key: "dashboard.total_requests", lang: "de", value: "Aufrufe Gesamt" },
      { key: "dashboard.total_requests", lang: "en", value: "Total Requests" },
      { key: "dashboard.total_requests", lang: "fr", value: "Total des demandes" },
      { key: "dashboard.total_requests", lang: "it", value: "Totale richieste" },

      { key: "dashboard.today", lang: "de", value: "Heute" },
      { key: "dashboard.today", lang: "en", value: "Today" },
      { key: "dashboard.today", lang: "fr", value: "Aujourd'hui" },
      { key: "dashboard.today", lang: "it", value: "Oggi" },
    ];

    let hasChanges = false;
    for (const seedItem of seed) {
      const existingIndex = all.findIndex(t => t.key === seedItem.key && t.lang === seedItem.lang);
      if (existingIndex !== -1) {
        // Update if different? For now, we only add missing keys to respect user customizations
        // Uncomment the next lines to force update standard keys:
        // if (all[existingIndex].value !== seedItem.value) {
        //   all[existingIndex].value = seedItem.value;
        //   hasChanges = true;
        // }
      } else {
        all.push(seedItem);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.writeJsonFile(TRANSLATIONS_FILE, all);
      this.translationsCache = all;
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
