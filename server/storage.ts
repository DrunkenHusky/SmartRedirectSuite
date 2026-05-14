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
import { BUILT_IN_LANGUAGES, DEFAULT_LANGUAGE, assertValidLanguageCode, mergeTranslationDictionaries, sanitizeTranslationPayload } from "@shared/i18n";
import { sequelize, initDb, UrlRuleModel, UrlTrackingModel, GeneralSettingsModel, TranslationModel } from "./db";
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
  // Translations
  getTranslation(lang: string): Promise<Record<string, string>>;
  listTranslationLanguages(): Promise<string[]>;
  updateTranslation(lang: string, data: Record<string, string>): Promise<void>;

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


  // Translations
  async getTranslation(lang: string): Promise<Record<string, string>> {
    const normalizedLanguageCode = assertValidLanguageCode(lang);
    const englishRecord = await TranslationModel.findByPk(DEFAULT_LANGUAGE);
    const baseLanguageCode = normalizedLanguageCode.split('-')[0];
    const requestedRecord =
      (await TranslationModel.findByPk(normalizedLanguageCode)) ||
      (baseLanguageCode !== normalizedLanguageCode ? await TranslationModel.findByPk(baseLanguageCode) : null);
    const englishTranslations = (englishRecord?.get('data') as Record<string, string> | undefined) || {};
    const requestedTranslations = (requestedRecord?.get('data') as Record<string, string> | undefined) || {};

    if (normalizedLanguageCode === DEFAULT_LANGUAGE) {
      return englishTranslations;
    }

    return mergeTranslationDictionaries(englishTranslations, requestedTranslations);
  }

  async listTranslationLanguages(): Promise<string[]> {
    const records = await TranslationModel.findAll({ attributes: ['lang'] });
    const languageCodes = records
      .map((record) => record.get('lang') as string)
      .filter(Boolean);

    return Array.from(new Set([
      ...BUILT_IN_LANGUAGES.map((language) => language.code),
      ...languageCodes,
    ])).sort();
  }

  async updateTranslation(lang: string, data: Record<string, string>): Promise<void> {
    const normalizedLanguageCode = assertValidLanguageCode(lang);
    const sanitizedTranslationData = sanitizeTranslationPayload(data);

    await TranslationModel.upsert({ lang: normalizedLanguageCode, data: sanitizedTranslationData });
  }

  private async initTranslations() {
    const defaultTranslations: Record<string, Record<string, string>> = {
      "en": {
            "incorrect_password_please_try_": "Incorrect password. Please try again.",
            "please_enter_the_administrator": "Please enter the administrator password.",
            "enter_password": "Enter password",
            "incorrect_password": "Incorrect password",
            "password": "password",
            "enter_administrator_password": "Enter administrator password",
            "administrator_login": "Administrator login",
            "welcome_to_the_admin_area": "Welcome to the admin area.",
            "open_administrator_area": "Open administrator area",
            "loading_app": "Loading application...",
            "admin_area": "Admin Area",
            "lang": "Lang",
            "showing": "Showing",
            "of": "of",
            "entries": "entries",
            "performance": "Performance",
            "memory": "Memory:",
            "performance_monitor": "Performance Monitor",
            "overview": "Overview",
            "loading": "Loading",
            "memory_1": "Memory",
            "issues_detected": "Issues Detected:",
            "dom": "DOM:",
            "load": "Load:",
            "heap": "Heap:",
            "dom_ready": "DOM Ready:",
            "load_complete": "Load Complete:",
            "first_paint": "First Paint:",
            "dns_lookup": "DNS Lookup:",
            "tcp_connect": "TCP Connect:",
            "server_response": "Server Response:",
            "resources": "Resources:",
            "slow_resources": "Slow Resources:",
            "js_size": "JS Size:",
            "css_size": "CSS Size:",
            "loading_performance_data": "Loading performance data...",
            "used_heap": "Used Heap:",
            "total_heap": "Total Heap:",
            "heap_limit": "Heap Limit:",
            "usage": "Usage:",
            "memory_data_not_available": "Memory data not available",
            "administrator_anmeldung": "Administrator-Anmeldung",
            "bitte_geben_sie_das_administra": "Bitte geben Sie das Administrator-Passwort ein.",
            "passwort": "Passwort",
            "abbrechen": "Abbrechen",
            "überprüfe_authentifizierung": "Überprüfe Authentifizierung...",
            "administrator_bereich": "Administrator-Bereich",
            "admin": "Admin",
            "schließen": "Schließen",
            "allgemein": "Allgemein",
            "regeln": "Regeln",
            "global": "Global",
            "statistiken": "Statistiken",
            "system_daten": "System & Daten",
            "sprachen": "Sprachen",
            "allgemeine_einstellungen": "Allgemeine Einstellungen",
            "hier_können_sie_alle_texte_der": "Hier können Sie alle Texte der Anwendung anpassen.",
            "bitte_melden_sie_sich_an_auth": "Bitte melden Sie sich an... (Auth:",
            "lade_einstellungen_auth": "Lade Einstellungen... (Auth:",
            "loading_1": ", Loading:",
            "header_einstellungen": "Header-Einstellungen",
            "anpassung_des_oberen_bereichs_": "Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt",
            "titel": "Titel",
            "wird_als_haupttitel_im_header_": "Wird als Haupttitel im Header der Anwendung angezeigt",
            "icon": "Icon",
            "kein_icon": "🚫 Kein Icon",
            "pfeil_wechsel": "🔄 Pfeil Wechsel",
            "warnung": "⚠️ Warnung",
            "fehler": "❌ Fehler",
            "alert": "⭕ Alert",
            "ℹ_info": "ℹ️ Info",
            "lesezeichen": "🔖 Lesezeichen",
            "teilen": "📤 Teilen",
            "zeit": "⏰ Zeit",
            "häkchen": "✅ Häkchen",
            "stern": "⭐ Stern",
            "herz": "❤️ Herz",
            "glocke": "🔔 Glocke",
            "hintergrundfarbe": "Hintergrundfarbe",
            "logo_hochladen": "Logo hochladen",
            "empfehlung": "Empfehlung:",
            "png_mit_transparentem_hintergr": "PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)",
            "funktion": "Funktion:",
            "wenn_ein_logo_hochgeladen_wird": "Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt.",
            "aktuelles_logo": "Aktuelles Logo:",
            "löschen": "Löschen",
            "logo_aktiv_wird_anstelle_des_i": "Logo aktiv - wird anstelle des Icons angezeigt",
            "interaktionen": "Interaktionen",
            "steuern_sie_die_interaktionsmö": "Steuern Sie die Interaktionsmöglichkeiten auf der Migrationsseite",
            "kopier_button_anzeigen": "Kopier-Button anzeigen",
            "blendet_den_button_zum_kopiere": "Blendet den Button zum Kopieren der URL ein/aus",
            "öffnen_button_anzeigen": "Öffnen-Button anzeigen",
            "blendet_den_button_zum_öffnen_": "Blendet den Button zum Öffnen im neuen Tab ein/aus",
            "verhalten_bei_klick_auf_url_fe": "Verhalten bei Klick auf URL-Feld",
            "kopieren_standard": "Kopieren (Standard)",
            "in_neuem_tab_öffnen": "In neuem Tab öffnen",
            "keine_aktion": "Keine Aktion",
            "definiert_was_passiert_wenn_de": "Definiert was passiert, wenn der Nutzer direkt auf das Feld mit der neuen URL klickt.",
            "button_text_url_kopieren": "Button-Text \"URL kopieren\"",
            "button_text_in_neuem_tab_öffne": "Button-Text \"In neuem Tab öffnen\"",
            "popup_einstellungen": "PopUp-Einstellungen",
            "dialog_fenster_das_automatisch": "Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft",
            "popup_anzeige": "PopUp-Anzeige",
            "aktiv": "Aktiv",
            "inline": "Inline",
            "deaktiviert": "Deaktiviert",
            "beschreibung": "Beschreibung",
            "erklärt_dem_nutzer_die_situati": "Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte",
            "popup_button_text": "PopUp Button-Text",
            "text_für_den_button_der_das_po": "Text für den Button der das PopUp-Fenster öffnet",
            "alert_hintergrundfarbe": "Alert-Hintergrundfarbe",
            "gelb": "🟡 Gelb",
            "rot": "🔴 Rot",
            "orange": "🟠 Orange",
            "blau": "🔵 Blau",
            "grau": "⚫ Grau",
            "hauptinhalt_hintergrundfarbe": "Hauptinhalt-Hintergrundfarbe",
            "routing_fallback_verhalten": "Routing & Fallback-Verhalten",
            "konfiguration_des_verhaltens_b": "Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung",
            "ziel_domain_standard_neue_doma": "Ziel-Domain (Standard neue Domain)",
            "verwendet_für_partial_matches_": "Verwendet für Partial Matches und spezifische Regeln.",
            "fallback_strategie": "Fallback-Strategie",
            "einfacher_domain_austausch": "Einfacher Domain-Austausch",
            "standard_verhalten_ersetzt_die": "Standard-Verhalten: Ersetzt die alte Domain durch die neue \"Target Domain\". Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt.",
            "intelligente_such_weiterleitun": "Intelligente Such-Weiterleitung",
            "intelligenter_fallback_leitet_": "Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite.",
            "definiert_was_passiert_wenn_ke": "Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift.",
            "such_basis_url": "Such-Basis-URL",
            "beispiel_https_newapp_com_q": "Beispiel: https://newapp.com/?q=",
            "nicht_kodieren": "Nicht kodieren",
            "extraktions_regeln_regex": "Extraktions-Regeln (Regex)",
            "regex_pattern_extraction_optio": "Regex Pattern (Extraction - optional)",
            "path_matcher_prefix": "Path Matcher (Prefix)",
            "custom_search_base_url_optiona": "Custom Search Base URL (Optional)",
            "suchbegriff_nicht_kodieren_no_": "Suchbegriff nicht kodieren (No URL Encoding)",
            "regel_hinzufügen": "Regel hinzufügen",
            "beispiel_hinzufügen": "Beispiel hinzufügen",
            "definieren_sie_eine_liste_von_": "Definieren Sie eine Liste von Regeln. Die Regeln werden von oben nach unten geprüft.\n                                    Wenn Sie ein Regex-Pattern definieren, muss es eine Capture Group () enthalten.",
            "lassen_sie_das_feld_regex_patt": "Lassen Sie das Feld \"Regex Pattern\" leer, um automatisch das letzte Pfadsegment zu verwenden.",
            "wenn_keine_regel_greift_wird_a": "Wenn keine Regel greift, wird als Fallback ebenfalls das letzte Pfadsegment verwendet.",
            "fallback_info_nachrichten": "Fallback-Info-Nachrichten",
            "spezielle_hinweise_titel": "Spezielle Hinweise - Titel",
            "spezielle_hinweise_icon": "Spezielle Hinweise - Icon",
            "standard_info_text_beschreibun": "Standard Info Text (Beschreibung)",
            "angezeigt_wenn_eine_regel_matc": "Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat.",
            "smart_search_nachricht": "Smart Search Nachricht",
            "angezeigt_nur_wenn_intelligent": "Angezeigt NUR wenn \"Intelligente Such-Weiterleitung\" ausgelöst wird (keine Regel matched).",
            "visualisierung": "Visualisierung",
            "label_für_alte_url": "Label für alte URL",
            "label_für_neue_url": "Label für neue URL",
            "link_qualitätstacho_anzeigen": "Link-Qualitätstacho anzeigen",
            "text_für_hohe_übereinstimmung_": "Text für hohe Übereinstimmung (100%)",
            "text_für_mittlere_übereinstimm": "Text für mittlere Übereinstimmung (75%)",
            "text_für_geringe_übereinstimmu": "Text für geringe Übereinstimmung (50%)",
            "text_für_startseiten_treffer_1": "Text für Startseiten-Treffer (100%)",
            "text_für_keine_übereinstimmung": "Text für keine Übereinstimmung (0%)",
            "zusätzliche_informationen": "Zusätzliche Informationen",
            "wird_nur_angezeigt_wenn_mindes": "Wird nur angezeigt wenn mindestens ein Info-Punkt konfiguriert ist",
            "titel_der_sektion": "Titel der Sektion",
            "überschrift_für_den_bereich_mi": "Überschrift für den Bereich mit zusätzlichen Informationen",
            "icon_für_den_titel": "Icon für den Titel",
            "informations_punkte": "Informations-Punkte",
            "liste_von_stichpunkten_die_unt": "Liste von Stichpunkten die unter dem Info-Text angezeigt werden",
            "hinzufügen": "Hinzufügen",
            "bookmark": "🔖 Bookmark",
            "share": "📤 Share",
            "clock": "⏰ Clock",
            "check": "✅ Check",
            "star": "⭐ Star",
            "heart": "❤️ Heart",
            "bell": "🔔 Bell",
            "keine_info_punkte_vorhanden_kl": "Keine Info-Punkte vorhanden. Klicken Sie \"Hinzufügen\" um welche zu erstellen.",
            "footer": "Footer",
            "copyright_und_fußzeile_der_anw": "Copyright und Fußzeile der Anwendung",
            "copyright_text": "Copyright-Text",
            "link_erkennung_leistung": "Link-Erkennung & Leistung",
            "einstellungen_zur_erkennungslo": "Einstellungen zur Erkennungslogik und Systemleistung",
            "groß_kleinschreibung_beachten": "Groß-/Kleinschreibung beachten",
            "wenn_aktiviert_werden_regeln_n": "Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert.",
            "referrer_tracking_aktivieren": "Referrer Tracking aktivieren",
            "erfasst_die_herkunfts_url_refe": "Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen.",
            "tracking_cache_aktivieren_ram": "Tracking-Cache aktivieren (RAM)",
            "speichert_statistik_daten_im_a": "Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten.",
            "max_statistik_einträge": "Max. Statistik-Einträge",
            "begrenzt_die_anzahl_der_gespei": "Begrenzt die Anzahl der gespeicherten Statistik-Einträge in der tracking.json. Älteste Einträge werden bei Überschreitung gelöscht. (0 = Unbegrenzt)",
            "lassen_sie_den_tracking_cache_": "Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (&lt; 512MB) oder Sie haben extrem viele Tracking-Daten (&gt; 1 Mio. Einträge).",
            "automatische_weiterleitung": "Automatische Weiterleitung",
            "globale_einstellungen_für_auto": "Globale Einstellungen für automatische Weiterleitungen",
            "automatische_weiterleitung_akt": "Automatische Weiterleitung aktivieren",
            "wenn_aktiviert_werden_alle_ben": "Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen.",
            "hinweis_feedback_umfrage_wird_": "Hinweis: Feedback-Umfrage wird deaktiviert, da keine Interaktion stattfindet (Auto-Redirect wird als Feedback geloggt).",
            "admin_zugriff": "Admin-Zugriff:",
            "bei_aktivierter_automatischer_": "Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter",
            "admin_true": "?admin=true",
            "erreichen": "erreichen.",
            "benutzer_feedback_umfrage": "Benutzer-Feedback-Umfrage",
            "erfassen_sie_feedback_von_nutz": "Erfassen Sie Feedback von Nutzern zur Qualität der Weiterleitung",
            "feedback_umfrage_aktivieren": "Feedback-Umfrage aktivieren",
            "zeigt_ein_popup_an_wenn_nutzer": "Zeigt ein Popup an, wenn Nutzer auf \"Kopieren\" oder \"Öffnen\" klicken, um zu fragen, ob der Link funktioniert hat.",
            "trend_anzeige": "Trend-Anzeige",
            "konfiguration_für_den_redirect": "Konfiguration für den \"Redirect Satisfaction Trend\"",
            "zeitraum_tage": "Zeitraum (Tage)",
            "nur_feedback_ok_nok_anzeigen": "Nur Feedback (OK/NOK) anzeigen",
            "berechnet_den_score_ausschließ": "Berechnet den Score ausschließlich basierend auf Benutzer-Feedback, ignoriert automatische Match-Qualität.",
            "umfrage_titel": "Umfrage Titel",
            "umfrage_frage": "Umfrage Frage",
            "erfolgsmeldung": "Erfolgsmeldung",
            "button_ja_ok": "Button Ja (OK)",
            "text_auf_dem_button_für_positi": "Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)",
            "button_nein_nok": "Button Nein (NOK)",
            "text_auf_dem_button_für_negati": "Text auf dem Button für negative Rückmeldung (Standard: Nein)",
            "such_vorschlag_bei_nein_aktivi": "Such-Vorschlag bei \"Nein\" aktivieren",
            "zeigt_dem_nutzer_einen_link_zu": "Zeigt dem Nutzer einen Link zur intelligenten Suche an, wenn die Bewertung negativ ausfällt. (Erfordert aktive \"Intelligente Such-Weiterleitung\")",
            "nur_verfügbar_wenn_intelligent": "* Nur verfügbar wenn \"Intelligente Such-Weiterleitung\" als Fallback-Strategie gewählt ist.",
            "vorschlag_titel": "Vorschlag Titel",
            "vorschlag_beschreibung": "Vorschlag Beschreibung",
            "vorschlag_frage": "Vorschlag Frage",
            "kommentar_funktion_bei_nein_ak": "Kommentar-Funktion bei \"Nein\" aktivieren",
            "fragt_den_nutzer_nach_der_korr": "Fragt den Nutzer nach der korrekten URL, wenn die Bewertung negativ ausfällt (oder nachdem die Suche erfolglos war).",
            "kommentar_titel": "Kommentar Titel",
            "kommentar_beschreibung": "Kommentar Beschreibung",
            "platzhalter": "Platzhalter",
            "button_text": "Button Text",
            "speichern_sie_ihre_änderungen_": "Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.",
            "url_transformationsregeln": "URL-Transformationsregeln",
            "verwalten_sie_url_transformati": "Verwalten Sie URL-Transformations-Regeln für die Migration.",
            "löschen_1": "löschen",
            "konfigurationsvalidierung": "Konfigurationsvalidierung",
            "neue_regel": "Neue Regel",
            "suche": "Suche...",
            "seite": "Seite",
            "von": "von",
            "lade_regeln": "Lade Regeln...",
            "keine_regeln_für": "Keine Regeln für \"",
            "gefunden": "\" gefunden.",
            "versuchen_sie_einen_anderen_su": "Versuchen Sie einen anderen Suchbegriff oder erstellen Sie eine neue Regel.",
            "erste": "Erste",
            "vorherige": "Vorherige",
            "zeige": "Zeige",
            "nächste": "Nächste",
            "letzte": "Letzte",
            "overall": "Overall",
            "alle_einträge": "Alle Einträge",
            "letzte_24h": "Letzte 24h",
            "letzte_7_tage": "Letzte 7 Tage",
            "alle_zeit": "Alle Zeit",
            "nur_mit_regeln": "Nur mit Regeln",
            "nur_ohne_regeln": "Nur ohne Regeln",
            "alle_qualitäten": "Alle Qualitäten",
            "100_exakt": "100% (Exakt)",
            "75_fast_exakt": "75% (Fast exakt)",
            "50_teilweise": "50% (Teilweise)",
            "0_kein_treffer": "0% (Kein Treffer)",
            "alle_feedbacks": "Alle Feedbacks",
            "ok": "👍 OK",
            "nok": "👎 NOK",
            "auto": "⚡ Auto",
            "api": "🤖 API",
            "kein_feedback": "Kein Feedback",
            "gesamte_weiterleitungen": "Gesamte Weiterleitungen",
            "heute": "Heute",
            "exakte_trefferquote": "Exakte Trefferquote",
            "redirect_satisfaction_trend": "Redirect Satisfaction Trend",
            "entwicklung_der_qualität_und_n": "Entwicklung der Qualität und Nutzerzufriedenheit über die letzten",
            "tage": "Tage.",
            "täglich": "Täglich",
            "wöchentlich": "Wöchentlich",
            "monatlich": "Monatlich",
            "lade_trend": "Lade Trend...",
            "link_quality": "Link Quality",
            "qualitätsverteilung_der_link_m": "Qualitätsverteilung der Link-Matches",
            "lade_statistiken": "Lade Statistiken...",
            "exakter_treffer_100": "Exakter Treffer (100%)",
            "hoher_treffer_75": "Hoher Treffer (75%)",
            "mittlerer_treffer_50": "Mittlerer Treffer (50%)",
            "kein_treffer_0": "Kein Treffer (0%)",
            "nutzer_feedback": "Nutzer-Feedback",
            "rückmeldungen_zu_weiterleitung": "Rückmeldungen zu Weiterleitungen",
            "auto_redirect": "Auto-Redirect",
            "top_urls": "Top URLs",
            "lade_urls": "Lade URLs...",
            "keine_url_aufrufe_vorhanden": "Keine URL-Aufrufe vorhanden.",
            "url_pfad": "URL-Pfad",
            "aufrufe": "Aufrufe",
            "anteil": "Anteil",
            "top_referrer": "Top Referrer",
            "lade_referrer": "Lade Referrer...",
            "keine_referrer_daten_vorhanden": "Keine Referrer-Daten vorhanden.",
            "domain": "Domain",
            "anzahl": "Anzahl",
            "alle_tracking_einträge": "Alle Tracking-Einträge",
            "lade_einträge": "Lade Einträge...",
            "standard_import_export_excel_c": "Standard Import / Export (Excel, CSV)",
            "benutzerfreundlicher_import_un": "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV.\n                        Mit Vorschau-Funktion vor dem Import.",
            "regeln_importieren": "Regeln Importieren",
            "laden_sie_eine_excel_oder_csv_": "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:",
            "matcher": "Matcher",
            "pflicht_z_b_alte_seite": "(Pflicht) - z.B. /alte-seite",
            "target_url": "Target URL",
            "pflicht_z_b_https_neue_seite_d": "(Pflicht) - z.B. https://neue-seite.de",
            "type": "Type",
            "pflicht_partial_wildcard_oder_": "(Pflicht) - 'partial', 'wildcard' oder 'domain'",
            "info": "Info",
            "optional_beschreibung": "(Optional) - Beschreibung",
            "auto_redirect_1": "Auto Redirect",
            "optional_true_false": "(Optional) - 'true'/'false'",
            "discard_query_params": "Discard Query Params",
            "keep_query_params": "Keep Query Params",
            "static_query_params": "Static Query Params",
            "optional_json_array": "(Optional) - JSON Array",
            "search_replace": "Search Replace",
            "id": "ID",
            "optional_nur_für_updates_beste": "(Optional) - Nur für Updates bestehender Regeln",
            "musterdatei_excel": "Musterdatei (Excel)",
            "musterdatei_csv": "Musterdatei (CSV)",
            "analysiere_datei": "Analysiere Datei...",
            "klicken_zum_auswählen": "Klicken zum Auswählen",
            "oder_datei_hierher_ziehen": "oder Datei hierher ziehen",
            "excel_xlsx_oder_csv": "Excel (.xlsx) oder CSV",
            "urls_automatisch_kodieren": "URLs automatisch kodieren",
            "sonderzeichen_in_urls_automati": "Sonderzeichen in URLs automatisch konvertieren (encodeURI)",
            "regeln_exportieren": "Regeln Exportieren",
            "exportieren_sie_alle_regeln_zu": "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup.\n                                Die Dateien können später wieder importiert werden.",
            "herunterladen_excel": "Herunterladen (Excel)",
            "herunterladen_csv": "Herunterladen (CSV)",
            "erweiterter_regel_import_expor": "Erweiterter Regel-Import/Export",
            "für_fortgeschrittene_benutzer_": "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau.",
            "regel_rohdaten_json": "Regel-Rohdaten (JSON)",
            "herunterladen_json": "Herunterladen (JSON)",
            "importieren_json": "Importieren (JSON)",
            "musterdatei_json": "Musterdatei (JSON)",
            "warnung_1": "Warnung:",
            "keine_vorschau_überschreibt_be": "Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort.",
            "system_statistiken": "System & Statistiken",
            "verwaltung_von_systemeinstellu": "Verwaltung von Systemeinstellungen und Statistiken.",
            "system_einstellungen": "System-Einstellungen",
            "exportieren_sie_die_komplette_": "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen.",
            "exportieren_sie_die_tracking_l": "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse.",
            "gefahrenzone": "Gefahrenzone!",
            "cache_wartung": "Cache Wartung",
            "nur_bei_problemen_mit_der_rege": "Nur bei Problemen mit der Regelerkennung notwendig.",
            "sicherheit": "Sicherheit",
            "blockierte_ips_anzeigen_und_ve": "Blockierte IPs anzeigen und verwalten",
            "liste_der_blockierten_ips_eins": "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren.",
            "destruktive_aktionen": "Destruktive Aktionen",
            "alle_regeln_löschen": "Alle Regeln löschen",
            "löscht_alle_vorhandenen_weiter": "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich.",
            "alle_statistiken_löschen": "Alle Statistiken löschen",
            "löscht_alle_erfassten_tracking": "Löscht alle erfassten Tracking-Daten unwiderruflich.",
            "blockierte_ips_löschen": "Blockierte IPs löschen",
            "löscht_alle_blockierten_ip_adr": "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff.",
            "import_vorschau": "Import Vorschau",
            "überprüfen_sie_die_zu_importie": "Überprüfen Sie die zu importierenden Regeln.",
            "neu": "Neu:",
            "update": "Update:",
            "ungültig": "Ungültig:",
            "filter_löschen": "Filter löschen",
            "gesamt": "(Gesamt:",
            "mehr_laden_100": "Mehr laden (+100)",
            "url_pfad_matcher": "URL-Pfad Matcher",
            "ziel_url_optional": "Ziel-URL (optional)",
            "redirect_typ": "Redirect-Typ",
            "teilweise": "Teilweise",
            "nur_die_pfadsegmente_ab_dem_ma": "Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.",
            "vollständig": "Vollständig",
            "alte_links_werden_komplett_auf": "Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.",
            "domain_ersatz": "Domain-Ersatz",
            "ersetzt_nur_die_domain_host_de": "Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Wenn eine Ziel-URL angegeben ist, wird deren Domain verwendet.",
            "der_matcher_kann_hier_auch_ein": "Der Matcher kann hier auch eine Domain sein (z.B. \"www.alteseite.ch\"). Bei Verwendung eines Pfad-Matchers (\"/news\") mit diesem Typ wird nur die Domain ersetzt, während der Pfad erhalten bleibt.",
            "info_text_markdown": "Info-Text (Markdown)",
            "suchen_ersetzen": "Suchen & Ersetzen",
            "ersetzen_sie_teile_der_url_pfa": "Ersetzen Sie Teile der URL (Pfad oder Parameter) vor der Weiterleitung.",
            "suchen": "Suchen",
            "ersetzen": "Ersetzen",
            "aa": "Aa",
            "ersetzung_hinzufügen": "Ersetzung hinzufügen",
            "statische_parameter_hinzufügen": "Statische Parameter hinzufügen",
            "definieren_sie_parameter_die_i": "Definieren Sie Parameter, die immer an die Ziel-URL angehängt werden (z.B. ?source=migration).",
            "key": "Key",
            "value": "Value",
            "raw": "Raw",
            "parameter_hinzufügen": "Parameter hinzufügen",
            "alle_link_parameter_entfernen": "Alle Link-Parameter entfernen",
            "wenn_aktiviert_werden_alle_que": "Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten).",
            "alle_link_parameter_beibehalte": "Alle Link-Parameter beibehalten",
            "wenn_aktiviert_werden_die_ursp": "Wenn aktiviert, werden die ursprünglichen Query-Parameter 1:1 an die Ziel-URL angehängt.\n                      Deaktivieren Sie dies, um spezifische Parameter auszuwählen oder umzubenennen.",
            "parameter_beibehalten_umbenenn": "Parameter beibehalten / umbenennen (Regex)",
            "definieren_sie_ausnahmen_für_p": "Definieren Sie Ausnahmen für Parameter, die trotz Aktivierung erhalten bleiben sollen. Die Reihenfolge bestimmt die Position im neuen Query-String.",
            "parameter_key_regex": "Parameter Key (Regex)",
            "value_matcher_optional_regex": "Value Matcher (Optional Regex)",
            "neuer_name_optional": "Neuer Name (Optional)",
            "beispiel_file_hinzufügen": "Beispiel (File) hinzufügen",
            "automatische_weiterleitung_für": "Automatische Weiterleitung für diese Regel",
            "wenn_aktiviert_werden_benutzer": "Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet.",
            "warnung_da_die_feedback_umfrag": "Warnung: Da die Feedback-Umfrage global aktiviert ist, erhält der Nutzer bei diesem Auto-Redirect keine Möglichkeit Feedback zu geben.",
            "wichtiger_hinweis": "Wichtiger Hinweis",
            "bestätigung_für_die_aktivierun": "Bestätigung für die Aktivierung der automatischen Weiterleitung",
            "sie_sind_dabei_die_automatisch": "Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet.",
            "wichtiger_hinweis_1": "Wichtiger Hinweis:",
            "bei_aktivierter_automatischer__1": "Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter",
            "beispiel": "Beispiel:",
            "ich_habe_verstanden": "Ich habe verstanden",
            "blockierte_ips_löschen_1": "Blockierte IPs löschen?",
            "dies_löscht_alle_derzeit_block": "Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden.",
            "diese_aktion_hebt_den_brute_fo": "Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf.",
            "backup_herunterladen_excel": "Backup herunterladen (Excel)",
            "bestätigung_erforderlich": "Bestätigung erforderlich",
            "blockierte_ips_verwalten": "Blockierte IPs verwalten",
            "hier_können_sie_aktuell_blocki": "Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten.",
            "blockieren": "Blockieren",
            "ip_adresse": "IP-Adresse",
            "fehlversuche": "Fehlversuche",
            "blockiert_bis": "Blockiert bis",
            "aktionen": "Aktionen",
            "lade": "Lade...",
            "keine_blockierten_ip_adressen": "Keine blockierten IP-Adressen.",
            "alle_statistiken_löschen_1": "Alle Statistiken löschen?",
            "dies_löscht_alle_erfassten_tra": "Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "wir_empfehlen_dringend_vor_dem": "Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.",
            "backup_herunterladen_csv": "Backup herunterladen (CSV)",
            "validierungswarnung": "Validierungswarnung",
            "möchten_sie_die_regel_trotz_de": "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?",
            "regeln_löschen": "Regeln löschen",
            "sind_sie_sicher_dass_sie_die_a": "Sind Sie sicher, dass Sie die ausgewählten",
            "löschen_möchten_diese_aktion_k": "löschen möchten?\n              Diese Aktion kann nicht rückgängig gemacht werden.",
            "hinweis": "Hinweis:",
            "es_werden_nur_die_auf_der_aktu": "Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht.",
            "validierungsfehler": "Validierungsfehler",
            "die_einstellungen_konnten_aufg": "Die Einstellungen konnten aufgrund folgender Fehler nicht gespeichert werden:",
            "verstanden": "Verstanden",
            "statistik_limitierung_ändern": "Statistik-Limitierung ändern?",
            "sie_ändern_das_limit_für_stati": "Sie ändern das Limit für Statistik-Einträge von",
            "auf": "auf",
            "wenn_aktuell_mehr_als": "Wenn aktuell mehr als",
            "einträge_vorhanden_sind_aktuel": "Einträge vorhanden sind (aktuell:",
            "werden_die_ältesten_einträge_b": "), werden die ältesten Einträge beim\n              Speichern",
            "unwiderruflich_gelöscht": "unwiderruflich gelöscht",
            "verstanden_speichern": "Verstanden & Speichern",
            "validierung_neu_laden": "Validierung neu laden?",
            "sie_haben_eine_regel_geändert_": "Sie haben eine Regel geändert. Möchten Sie die Konfigurationsvalidierung mit den neuen Einstellungen neu laden?",
            "nein": "Nein",
            "ja_neu_laden": "Ja, neu laden",
            "alle_regeln_löschen_1": "Alle Regeln löschen?",
            "dies_löscht_alle_vorhandenen_r": "Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "backup_herunterladen_json": "Backup herunterladen (JSON)",
            "administrator_passwort_eingebe": "Administrator-Passwort eingeben",
            "smart_redirect_service": "Smart Redirect Service",
            "ffffff": "#ffffff",
            "url_veraltet_aktualisierung_er": "URL veraltet - Aktualisierung erforderlich",
            "du_verwendest_einen_alten_link": "Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen.",
            "zeige_mir_die_neue_url": "Zeige mir die neue URL",
            "https_thisisthenewurl_com": "https://thisisthenewurl.com/",
            "https_newapp_com_q": "https://newapp.com/?q=",
            "file": "[?&]file=([^&]+)",
            "teams_regex": "/teams (Regex)",
            "fügt_eine_beispiel_regex_hinzu": "Fügt eine Beispiel-Regex hinzu",
            "proudly_brewed_with_generative": "Proudly brewed with Generative AI.",
            "war_die_neue_url_korrekt": "War die neue URL korrekt?",
            "dein_feedback_hilft_uns_die_we": "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
            "vielen_dank_für_deine_rückmeld": "Vielen Dank für deine Rückmeldung.",
            "ja_ok": "Ja, OK",
            "regeln_durchsuchen": "Regeln durchsuchen...",
            "regeln_durchsuchen_1": "Regeln durchsuchen",
            "einträge_suchen": "Einträge suchen...",
            "statistiken_durchsuchen": "Statistiken durchsuchen",
            "regel_filter": "Regel-Filter",
            "qualität": "Qualität",
            "feedback": "Feedback",
            "news_beitrag": "/news-beitrag",
            "nachrichtenbeiträge_wurden_mig": "Nachrichtenbeiträge wurden migriert...",
            "alte_seite": "/alte-seite",
            "neue_seite_leer_löschen": "/neue-seite (leer = löschen)",
            "source": "source",
            "migration": "migration",
            "nicht_kodieren_no_url_encoding": "Nicht kodieren (No URL Encoding)",
            "nach_oben": "Nach oben",
            "nach_unten": "Nach unten",
            "file_1": "file",
            "f": "f",
            "tippen_sie_delete_zur_bestätig": "Tippen Sie \"DELETE\" zur Bestätigung",
            "ip_adresse_z_b_192_168_1_1": "IP-Adresse (z.B. 192.168.1.1)",
            "erfolgreich_angemeldet": "Erfolgreich angemeldet",
            "willkommen_im_administrator_be": "Willkommen im Administrator-Bereich.",
            "anmeldung_fehlgeschlagen": "Anmeldung fehlgeschlagen",
            "regel_erstellt": "Regel erstellt",
            "die_url_regel_wurde_erfolgreic": "Die URL-Regel wurde erfolgreich erstellt.",
            "authentifizierung_erforderlich": "Authentifizierung erforderlich",
            "bitte_melden_sie_sich_erneut_a": "Bitte melden Sie sich erneut an.",
            "regel_aktualisiert": "Regel aktualisiert",
            "die_url_regel_wurde_erfolgreic_1": "Die URL-Regel wurde erfolgreich aktualisiert.",
            "regel_gelöscht": "Regel gelöscht",
            "1_regel_wurde_erfolgreich_gelö": "1 Regel wurde erfolgreich gelöscht.",
            "fehler_1": "Fehler",
            "die_regel_konnte_nicht_gelösch": "Die Regel konnte nicht gelöscht werden.",
            "alle_statistiken_gelöscht": "Alle Statistiken gelöscht",
            "alle_tracking_daten_wurden_erf": "Alle Tracking-Daten wurden erfolgreich gelöscht.",
            "blockierte_ips_gelöscht": "Blockierte IPs gelöscht",
            "alle_blockierten_ip_adressen_w": "Alle blockierten IP-Adressen wurden erfolgreich gelöscht.",
            "ip_blockiert": "IP blockiert",
            "die_ip_adresse_wurde_erfolgrei": "Die IP-Adresse wurde erfolgreich blockiert.",
            "ip_entsperrt": "IP entsperrt",
            "die_ip_adresse_wurde_erfolgrei_1": "Die IP-Adresse wurde erfolgreich entsperrt.",
            "teilweise_gelöscht": "Teilweise gelöscht",
            "regeln_gelöscht": "Regeln gelöscht",
            "fehler_beim_löschen": "Fehler beim Löschen",
            "fehler_beim_speichern": "Fehler beim Speichern",
            "import_erfolgreich": "Import erfolgreich",
            "die_einstellungen_wurden_erfol": "Die Einstellungen wurden erfolgreich importiert.",
            "import_fehlgeschlagen": "Import fehlgeschlagen",
            "die_einstellungen_konnten_nich": "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
            "die_url_regel_wurde_trotz_warn": "Die URL-Regel wurde trotz Warnung erfolgreich erstellt.",
            "die_regel_konnte_auch_mit_forc": "Die Regel konnte auch mit Force-Option nicht erstellt werden.",
            "die_url_regel_wurde_trotz_warn_1": "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert.",
            "die_regel_konnte_auch_mit_forc_1": "Die Regel konnte auch mit Force-Option nicht aktualisiert werden.",
            "keine_gültigen_regeln_ausgewäh": "Keine gültigen Regeln ausgewählt",
            "keine_der_ausgewählten_regeln_": "Keine der ausgewählten Regeln befinden sich auf der aktuellen Seite.",
            "warnung_ungültige_auswahl_erka": "Warnung: Ungültige Auswahl erkannt",
            "sicherheitsfehler": "Sicherheitsfehler",
            "export_erfolgreich": "Export erfolgreich",
            "export_fehlgeschlagen": "Export fehlgeschlagen",
            "die_daten_konnten_nicht_export": "Die Daten konnten nicht exportiert werden.",
            "einstellungen_gespeichert": "Einstellungen gespeichert",
            "die_allgemeinen_einstellungen_": "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert.",
            "erfolgreich_abgemeldet": "Erfolgreich abgemeldet",
            "sie_wurden_erfolgreich_abgemel": "Sie wurden erfolgreich abgemeldet.",
            "abmeldung_fehlgeschlagen": "Abmeldung fehlgeschlagen",
            "vorschau_fehlgeschlagen": "Vorschau fehlgeschlagen",
            "import_mit_validierungsfehlern": "Import mit Validierungsfehlern",
            "datei_zu_groß": "Datei zu groß",
            "die_import_datei_ist_zu_groß_b": "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei).",
            "cache_neu_aufgebaut": "Cache neu aufgebaut",
            "der_regel_cache_wurde_erfolgre": "Der Regel-Cache wurde erfolgreich neu erstellt.",
            "fehler_beim_cache_neuaufbau": "Fehler beim Cache-Neuaufbau",
            "alle_regeln_gelöscht": "Alle Regeln gelöscht",
            "alle_url_regeln_wurden_erfolgr": "Alle URL-Regeln wurden erfolgreich gelöscht.",
            "import_fehler": "Import Fehler",
            "konnte_die_vollständigen_daten": "Konnte die vollständigen Daten für den Import nicht laden.",
            "dateifehler": "Dateifehler",
            "die_import_datei_konnte_nicht_": "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
            "die_datei_darf_maximal_5mb_gro": "Die Datei darf maximal 5MB groß sein.",
            "logo_hochgeladen": "Logo hochgeladen",
            "das_header_logo_wurde_erfolgre": "Das Header-Logo wurde erfolgreich aktualisiert.",
            "fehler_beim_hochladen": "Fehler beim Hochladen",
            "das_logo_konnte_nicht_hochgela": "Das Logo konnte nicht hochgeladen werden.",
            "logo_entfernt": "Logo entfernt",
            "das_header_logo_wurde_erfolgre_1": "Das Header-Logo wurde erfolgreich entfernt.",
            "das_logo_konnte_nicht_entfernt": "Das Logo konnte nicht entfernt werden.",
            "die_globalen_regeln_wurden_erf": "Die globalen Regeln wurden erfolgreich aktualisiert.",
            "url_wird_analysiert": "URL wird analysiert...",
            "klicken_zum_kopieren": "Klicken zum Kopieren",
            "url_erfolgreich_in_die_zwische": "URL erfolgreich in die Zwischenablage kopiert!",
            "v": "v",
            "überspringen": "Überspringen",
            "neue_url_in_neuem_tab_öffnen": "Neue URL in neuem Tab öffnen",
            "kopieren_fehlgeschlagen": "Kopieren fehlgeschlagen",
            "bitte_kopieren_sie_die_url_man": "Bitte kopieren Sie die URL manuell.",
            "404_page_not_found": "404 Page Not Found",
            "did_you_forget_to_add_the_page": "Did you forget to add the page to the router?",
            "globale_regeln": "Globale Regeln",
            "diese_regeln_werden_auf_alle_w": "Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).\n                    Spezifische Regeln überschreiben diese globalen Einstellungen.",
            "globales_suchen_ersetzen": "Globales Suchen & Ersetzen",
            "ersetzen_sie_text_in_der_ziel_": "Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.",
            "reihenfolge_global_hier_rarr_r": "Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.",
            "globale_statische_parameter": "Globale Statische Parameter",
            "parameter_die_immer_angehängt_": "Parameter, die immer angehängt werden (z.B. ?source=migration).",
            "wenn_eine_regel_denselben_para": "Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.",
            "globale_parameter_übernahme_wh": "Globale Parameter-Übernahme (Whitelist)",
            "parameter_die_bei_aktivierter_": "Parameter, die bei aktivierter \"Parameter entfernen\" Option (in einer Regel) trotzdem behalten werden.",
            "wird_zusätzlich_zu_den_regel_s": "Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.",
            "key_pattern_regex": "Key Pattern (Regex)",
            "value_pattern_opt": "Value Pattern (Opt.)",
            "neuer_name_opt": "Neuer Name (Opt.)",
            "beispiel_file": "Beispiel (file)",
            "alte_pfade": "/alte-pfade",
            "neue_pfade": "/neue-pfade",
            "utm_source": "utm_source",
            "migration_tool": "migration_tool",
            "nicht_kodieren_raw": "Nicht kodieren (Raw)",
            "id_lang": "id|lang",
            "new_id": "new_id",
            "query_parameters": "Query Parameters",
            "mode": "Mode:",
            "kept_params_exceptions": "Kept Params (Exceptions):",
            "rarr": "&rarr;",
            "static_params_appended": "Static Params (Appended):",
            "search_replace_1": "Search & Replace",
            "case_sensitive": "Case Sensitive",
            "keine_suchen_ersetzen_regeln": "Keine Suchen & Ersetzen Regeln.",
            "info_beschreibung": "Info / Beschreibung",
            "status": "Status",
            "ziel_url": "Ziel-URL",
            "typ": "Typ",
            "auto_1": "Auto",
            "erstellt_am": "Erstellt am",
            "das_auswählen_und_löschen_mehr": "Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.",
            "params_entfernen": "Params Entfernen",
            "params_behalten": "Params Behalten",
            "regel_löschen": "Regel löschen",
            "sind_sie_sicher_dass_sie_diese": "Sind Sie sicher, dass Sie diese Regel löschen möchten?\n                      Diese Aktion kann nicht rückgängig gemacht werden.",
            "ziel_url_1": "Ziel-URL:",
            "automatisch_generiert": "Automatisch generiert",
            "info_text": "Info-Text:",
            "erstellt": "Erstellt:",
            "bearbeiten": "Bearbeiten",
            "regel_bearbeiten": "Regel bearbeiten",
            "expand_all": "Expand All",
            "collapse_all": "Collapse All",
            "erstellt_1": "Erstellt",
            "action": "Action",
            "on": "On",
            "sind_sie_sicher": "Sind Sie sicher?",
            "parameter_konfiguration": "Parameter Konfiguration",
            "handling_mode": "Handling Mode:",
            "ausnahmen_kept": "Ausnahmen (Kept):",
            "statische_parameter": "Statische Parameter:",
            "keine": "Keine.",
            "alle_regeln_auf_dieser_seite_a": "Alle Regeln auf dieser Seite auswählen/abwählen",
            "nicht_genügend_daten_für_trend": "Nicht genügend Daten für Trendanzeige",
            "match_quality": "Match Quality",
            "feedback_inkl_auto": "Feedback (inkl. Auto)",
            "match": "Match:",
            "score": "Score:",
            "total": "Total:",
            "ok_1": "(OK:",
            "auto_2": ", Auto:",
            "nok_1": ", NOK:",
            "spalten_anpassen": "Spalten anpassen",
            "spalten_auswählen": "Spalten auswählen",
            "zeitstempel": "Zeitstempel",
            "alte_url": "Alte URL",
            "neue_url": "Neue URL",
            "pfad": "Pfad",
            "referrer": "Referrer",
            "regel": "Regel",
            "n_a": "N/A",
            "smart_search": "Smart Search",
            "domain_redirect": "Domain Redirect",
            "regel_nicht_mehr_vorhanden": "Regel nicht mehr vorhanden",
            "gelöscht": "Gelöscht",
            "api_1": "API",
            "vorschlag": "Vorschlag:",
            "intelligente_suche_fallback": "Intelligente Suche (Fallback)",
            "standard_domain_weiterleitung_": "Standard Domain-Weiterleitung (Fallback)",
            "api_call": "API Call",
            "übersetzungen_für_die_anwendun": "Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.",
            "speichern": "Speichern",
            "schlüssel_key": "Schlüssel (Key)",
            "wert_value": "Wert (Value)",
            "sprache_auswählen": "Sprache auswählen",
            "neuer_schlüssel": "Neuer Schlüssel...",
            "wert": "Wert...",
            "erfolg": "Erfolg",
            "übersetzungen_gespeichert": "Übersetzungen gespeichert.",
            "konnte_übersetzungen_nicht_spe": "Konnte Übersetzungen nicht speichern.",
            "old": "Old:",
            "new": "New:",
            "ergebnis_analyse": "Ergebnis-Analyse",
            "original": "Original:",
            "smart_search_fallback": "Smart Search Fallback:",
            "weiterleitung_zur_suche_da_kei": "Weiterleitung zur Suche, da keine Regel passte.",
            "angewandte_regel": "Angewandte Regel",
            "id_1": "ID:",
            "matcher_1": "Matcher:",
            "ziel": "Ziel:",
            "typ_1": "Typ:",
            "parameter_werden_verworfen": "Parameter werden verworfen",
            "keine_spezifische_regel_gefund": "Keine spezifische Regel gefunden (Fallback).",
            "angewandte_globale_regeln": "Angewandte Globale Regeln",
            "keine_globalen_regeln_angewend": "Keine globalen Regeln angewendet",
            "verarbeitungsschritte": "Verarbeitungsschritte",
            "testen_sie_ihre_regeln_mit_ein": "Testen Sie Ihre Regeln mit einer Liste von URLs. Importieren Sie eine CSV/Excel-Datei oder fügen Sie URLs ein.",
            "text_einfügen": "Text einfügen",
            "datei_hochladen": "Datei hochladen",
            "urls_einfügen_durch_komma_semi": "URLs einfügen (durch Komma, Semikolon oder neue Zeile getrennt)",
            "leerzeichen_nach_trennzeichen_": "Leerzeichen nach Trennzeichen werden automatisch entfernt.",
            "unterstützt_csv_xlsx_xls_nur_e": "Unterstützt CSV, XLSX, XLS (nur erste Spalte wird verwendet)",
            "ausgewählt": "Ausgewählt",
            "hinweis_1": "Hinweis",
            "verarbeite_urls": "Verarbeite URLs...",
            "ergebnisse": "Ergebnisse",
            "neu_berechnen": "Neu berechnen",
            "csv_export": "CSV Export",
            "neue_suche": "Neue Suche",
            "url_transformation": "URL Transformation",
            "rule_tag": "Rule Tag",
            "validierung_starten": "Validierung starten",
            "https_example_com_a_10_https_e": "https://example.com/a&#10;https://example.com/b",
            "alle_ausklappen": "Alle ausklappen",
            "alle_einklappen": "Alle einklappen",
            "keine_daten_zum_aktualisieren": "Keine Daten zum Aktualisieren",
            "bitte_starten_sie_den_prozess_": "Bitte starten Sie den Prozess neu.",
            "close": "Close",
            "bitte_geben_sie_das_administra_1": "Bitte geben Sie das Administrator-Passwort ein:",
            "passwort_eingeben": "Passwort eingeben",
            "link_qualität": "Link-Qualität:"
      },
      "de": {
            "incorrect_password_please_try_": "Falsches Passwort. Bitte versuchen Sie es erneut.",
            "please_enter_the_administrator": "Bitte geben Sie das Administrator-Passwort ein.",
            "enter_password": "Passwort eingeben",
            "incorrect_password": "Falsches Passwort",
            "password": "Passwort",
            "enter_administrator_password": "Administrator-Passwort eingeben",
            "administrator_login": "Administrator-Anmeldung",
            "welcome_to_the_admin_area": "Willkommen im Administrator-Bereich.",
            "open_administrator_area": "Administrator-Bereich öffnen",
            "loading_app": "",
            "admin_area": "",
            "lang": "Lang",
            "showing": "Showing",
            "of": "of",
            "entries": "entries",
            "performance": "Performance",
            "memory": "Memory:",
            "performance_monitor": "Performance Monitor",
            "overview": "Overview",
            "loading": "Loading",
            "memory_1": "Memory",
            "issues_detected": "Issues Detected:",
            "dom": "DOM:",
            "load": "Load:",
            "heap": "Heap:",
            "dom_ready": "DOM Ready:",
            "load_complete": "Load Complete:",
            "first_paint": "First Paint:",
            "dns_lookup": "DNS Lookup:",
            "tcp_connect": "TCP Connect:",
            "server_response": "Server Response:",
            "resources": "Resources:",
            "slow_resources": "Slow Resources:",
            "js_size": "JS Size:",
            "css_size": "CSS Size:",
            "loading_performance_data": "Loading performance data...",
            "used_heap": "Used Heap:",
            "total_heap": "Total Heap:",
            "heap_limit": "Heap Limit:",
            "usage": "Usage:",
            "memory_data_not_available": "Memory data not available",
            "administrator_anmeldung": "Administrator-Anmeldung",
            "bitte_geben_sie_das_administra": "Bitte geben Sie das Administrator-Passwort ein.",
            "passwort": "Passwort",
            "abbrechen": "Abbrechen",
            "überprüfe_authentifizierung": "Überprüfe Authentifizierung...",
            "administrator_bereich": "Administrator-Bereich",
            "admin": "Admin",
            "schließen": "Schließen",
            "allgemein": "Allgemein",
            "regeln": "Regeln",
            "global": "Global",
            "statistiken": "Statistiken",
            "system_daten": "System & Daten",
            "sprachen": "Sprachen",
            "allgemeine_einstellungen": "Allgemeine Einstellungen",
            "hier_können_sie_alle_texte_der": "Hier können Sie alle Texte der Anwendung anpassen.",
            "bitte_melden_sie_sich_an_auth": "Bitte melden Sie sich an... (Auth:",
            "lade_einstellungen_auth": "Lade Einstellungen... (Auth:",
            "loading_1": ", Loading:",
            "header_einstellungen": "Header-Einstellungen",
            "anpassung_des_oberen_bereichs_": "Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt",
            "titel": "Titel",
            "wird_als_haupttitel_im_header_": "Wird als Haupttitel im Header der Anwendung angezeigt",
            "icon": "Icon",
            "kein_icon": "🚫 Kein Icon",
            "pfeil_wechsel": "🔄 Pfeil Wechsel",
            "warnung": "⚠️ Warnung",
            "fehler": "❌ Fehler",
            "alert": "⭕ Alert",
            "ℹ_info": "ℹ️ Info",
            "lesezeichen": "🔖 Lesezeichen",
            "teilen": "📤 Teilen",
            "zeit": "⏰ Zeit",
            "häkchen": "✅ Häkchen",
            "stern": "⭐ Stern",
            "herz": "❤️ Herz",
            "glocke": "🔔 Glocke",
            "hintergrundfarbe": "Hintergrundfarbe",
            "logo_hochladen": "Logo hochladen",
            "empfehlung": "Empfehlung:",
            "png_mit_transparentem_hintergr": "PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)",
            "funktion": "Funktion:",
            "wenn_ein_logo_hochgeladen_wird": "Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt.",
            "aktuelles_logo": "Aktuelles Logo:",
            "löschen": "Löschen",
            "logo_aktiv_wird_anstelle_des_i": "Logo aktiv - wird anstelle des Icons angezeigt",
            "interaktionen": "Interaktionen",
            "steuern_sie_die_interaktionsmö": "Steuern Sie die Interaktionsmöglichkeiten auf der Migrationsseite",
            "kopier_button_anzeigen": "Kopier-Button anzeigen",
            "blendet_den_button_zum_kopiere": "Blendet den Button zum Kopieren der URL ein/aus",
            "öffnen_button_anzeigen": "Öffnen-Button anzeigen",
            "blendet_den_button_zum_öffnen_": "Blendet den Button zum Öffnen im neuen Tab ein/aus",
            "verhalten_bei_klick_auf_url_fe": "Verhalten bei Klick auf URL-Feld",
            "kopieren_standard": "Kopieren (Standard)",
            "in_neuem_tab_öffnen": "In neuem Tab öffnen",
            "keine_aktion": "Keine Aktion",
            "definiert_was_passiert_wenn_de": "Definiert was passiert, wenn der Nutzer direkt auf das Feld mit der neuen URL klickt.",
            "button_text_url_kopieren": "Button-Text \"URL kopieren\"",
            "button_text_in_neuem_tab_öffne": "Button-Text \"In neuem Tab öffnen\"",
            "popup_einstellungen": "PopUp-Einstellungen",
            "dialog_fenster_das_automatisch": "Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft",
            "popup_anzeige": "PopUp-Anzeige",
            "aktiv": "Aktiv",
            "inline": "Inline",
            "deaktiviert": "Deaktiviert",
            "beschreibung": "Beschreibung",
            "erklärt_dem_nutzer_die_situati": "Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte",
            "popup_button_text": "PopUp Button-Text",
            "text_für_den_button_der_das_po": "Text für den Button der das PopUp-Fenster öffnet",
            "alert_hintergrundfarbe": "Alert-Hintergrundfarbe",
            "gelb": "🟡 Gelb",
            "rot": "🔴 Rot",
            "orange": "🟠 Orange",
            "blau": "🔵 Blau",
            "grau": "⚫ Grau",
            "hauptinhalt_hintergrundfarbe": "Hauptinhalt-Hintergrundfarbe",
            "routing_fallback_verhalten": "Routing & Fallback-Verhalten",
            "konfiguration_des_verhaltens_b": "Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung",
            "ziel_domain_standard_neue_doma": "Ziel-Domain (Standard neue Domain)",
            "verwendet_für_partial_matches_": "Verwendet für Partial Matches und spezifische Regeln.",
            "fallback_strategie": "Fallback-Strategie",
            "einfacher_domain_austausch": "Einfacher Domain-Austausch",
            "standard_verhalten_ersetzt_die": "Standard-Verhalten: Ersetzt die alte Domain durch die neue \"Target Domain\". Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt.",
            "intelligente_such_weiterleitun": "Intelligente Such-Weiterleitung",
            "intelligenter_fallback_leitet_": "Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite.",
            "definiert_was_passiert_wenn_ke": "Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift.",
            "such_basis_url": "Such-Basis-URL",
            "beispiel_https_newapp_com_q": "Beispiel: https://newapp.com/?q=",
            "nicht_kodieren": "Nicht kodieren",
            "extraktions_regeln_regex": "Extraktions-Regeln (Regex)",
            "regex_pattern_extraction_optio": "Regex Pattern (Extraction - optional)",
            "path_matcher_prefix": "Path Matcher (Prefix)",
            "custom_search_base_url_optiona": "Custom Search Base URL (Optional)",
            "suchbegriff_nicht_kodieren_no_": "Suchbegriff nicht kodieren (No URL Encoding)",
            "regel_hinzufügen": "Regel hinzufügen",
            "beispiel_hinzufügen": "Beispiel hinzufügen",
            "definieren_sie_eine_liste_von_": "Definieren Sie eine Liste von Regeln. Die Regeln werden von oben nach unten geprüft.\n                                    Wenn Sie ein Regex-Pattern definieren, muss es eine Capture Group () enthalten.",
            "lassen_sie_das_feld_regex_patt": "Lassen Sie das Feld \"Regex Pattern\" leer, um automatisch das letzte Pfadsegment zu verwenden.",
            "wenn_keine_regel_greift_wird_a": "Wenn keine Regel greift, wird als Fallback ebenfalls das letzte Pfadsegment verwendet.",
            "fallback_info_nachrichten": "Fallback-Info-Nachrichten",
            "spezielle_hinweise_titel": "Spezielle Hinweise - Titel",
            "spezielle_hinweise_icon": "Spezielle Hinweise - Icon",
            "standard_info_text_beschreibun": "Standard Info Text (Beschreibung)",
            "angezeigt_wenn_eine_regel_matc": "Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat.",
            "smart_search_nachricht": "Smart Search Nachricht",
            "angezeigt_nur_wenn_intelligent": "Angezeigt NUR wenn \"Intelligente Such-Weiterleitung\" ausgelöst wird (keine Regel matched).",
            "visualisierung": "Visualisierung",
            "label_für_alte_url": "Label für alte URL",
            "label_für_neue_url": "Label für neue URL",
            "link_qualitätstacho_anzeigen": "Link-Qualitätstacho anzeigen",
            "text_für_hohe_übereinstimmung_": "Text für hohe Übereinstimmung (100%)",
            "text_für_mittlere_übereinstimm": "Text für mittlere Übereinstimmung (75%)",
            "text_für_geringe_übereinstimmu": "Text für geringe Übereinstimmung (50%)",
            "text_für_startseiten_treffer_1": "Text für Startseiten-Treffer (100%)",
            "text_für_keine_übereinstimmung": "Text für keine Übereinstimmung (0%)",
            "zusätzliche_informationen": "Zusätzliche Informationen",
            "wird_nur_angezeigt_wenn_mindes": "Wird nur angezeigt wenn mindestens ein Info-Punkt konfiguriert ist",
            "titel_der_sektion": "Titel der Sektion",
            "überschrift_für_den_bereich_mi": "Überschrift für den Bereich mit zusätzlichen Informationen",
            "icon_für_den_titel": "Icon für den Titel",
            "informations_punkte": "Informations-Punkte",
            "liste_von_stichpunkten_die_unt": "Liste von Stichpunkten die unter dem Info-Text angezeigt werden",
            "hinzufügen": "Hinzufügen",
            "bookmark": "🔖 Bookmark",
            "share": "📤 Share",
            "clock": "⏰ Clock",
            "check": "✅ Check",
            "star": "⭐ Star",
            "heart": "❤️ Heart",
            "bell": "🔔 Bell",
            "keine_info_punkte_vorhanden_kl": "Keine Info-Punkte vorhanden. Klicken Sie \"Hinzufügen\" um welche zu erstellen.",
            "footer": "Footer",
            "copyright_und_fußzeile_der_anw": "Copyright und Fußzeile der Anwendung",
            "copyright_text": "Copyright-Text",
            "link_erkennung_leistung": "Link-Erkennung & Leistung",
            "einstellungen_zur_erkennungslo": "Einstellungen zur Erkennungslogik und Systemleistung",
            "groß_kleinschreibung_beachten": "Groß-/Kleinschreibung beachten",
            "wenn_aktiviert_werden_regeln_n": "Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert.",
            "referrer_tracking_aktivieren": "Referrer Tracking aktivieren",
            "erfasst_die_herkunfts_url_refe": "Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen.",
            "tracking_cache_aktivieren_ram": "Tracking-Cache aktivieren (RAM)",
            "speichert_statistik_daten_im_a": "Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten.",
            "max_statistik_einträge": "Max. Statistik-Einträge",
            "begrenzt_die_anzahl_der_gespei": "Begrenzt die Anzahl der gespeicherten Statistik-Einträge in der tracking.json. Älteste Einträge werden bei Überschreitung gelöscht. (0 = Unbegrenzt)",
            "lassen_sie_den_tracking_cache_": "Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (&lt; 512MB) oder Sie haben extrem viele Tracking-Daten (&gt; 1 Mio. Einträge).",
            "automatische_weiterleitung": "Automatische Weiterleitung",
            "globale_einstellungen_für_auto": "Globale Einstellungen für automatische Weiterleitungen",
            "automatische_weiterleitung_akt": "Automatische Weiterleitung aktivieren",
            "wenn_aktiviert_werden_alle_ben": "Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen.",
            "hinweis_feedback_umfrage_wird_": "Hinweis: Feedback-Umfrage wird deaktiviert, da keine Interaktion stattfindet (Auto-Redirect wird als Feedback geloggt).",
            "admin_zugriff": "Admin-Zugriff:",
            "bei_aktivierter_automatischer_": "Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter",
            "admin_true": "?admin=true",
            "erreichen": "erreichen.",
            "benutzer_feedback_umfrage": "Benutzer-Feedback-Umfrage",
            "erfassen_sie_feedback_von_nutz": "Erfassen Sie Feedback von Nutzern zur Qualität der Weiterleitung",
            "feedback_umfrage_aktivieren": "Feedback-Umfrage aktivieren",
            "zeigt_ein_popup_an_wenn_nutzer": "Zeigt ein Popup an, wenn Nutzer auf \"Kopieren\" oder \"Öffnen\" klicken, um zu fragen, ob der Link funktioniert hat.",
            "trend_anzeige": "Trend-Anzeige",
            "konfiguration_für_den_redirect": "Konfiguration für den \"Redirect Satisfaction Trend\"",
            "zeitraum_tage": "Zeitraum (Tage)",
            "nur_feedback_ok_nok_anzeigen": "Nur Feedback (OK/NOK) anzeigen",
            "berechnet_den_score_ausschließ": "Berechnet den Score ausschließlich basierend auf Benutzer-Feedback, ignoriert automatische Match-Qualität.",
            "umfrage_titel": "Umfrage Titel",
            "umfrage_frage": "Umfrage Frage",
            "erfolgsmeldung": "Erfolgsmeldung",
            "button_ja_ok": "Button Ja (OK)",
            "text_auf_dem_button_für_positi": "Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)",
            "button_nein_nok": "Button Nein (NOK)",
            "text_auf_dem_button_für_negati": "Text auf dem Button für negative Rückmeldung (Standard: Nein)",
            "such_vorschlag_bei_nein_aktivi": "Such-Vorschlag bei \"Nein\" aktivieren",
            "zeigt_dem_nutzer_einen_link_zu": "Zeigt dem Nutzer einen Link zur intelligenten Suche an, wenn die Bewertung negativ ausfällt. (Erfordert aktive \"Intelligente Such-Weiterleitung\")",
            "nur_verfügbar_wenn_intelligent": "* Nur verfügbar wenn \"Intelligente Such-Weiterleitung\" als Fallback-Strategie gewählt ist.",
            "vorschlag_titel": "Vorschlag Titel",
            "vorschlag_beschreibung": "Vorschlag Beschreibung",
            "vorschlag_frage": "Vorschlag Frage",
            "kommentar_funktion_bei_nein_ak": "Kommentar-Funktion bei \"Nein\" aktivieren",
            "fragt_den_nutzer_nach_der_korr": "Fragt den Nutzer nach der korrekten URL, wenn die Bewertung negativ ausfällt (oder nachdem die Suche erfolglos war).",
            "kommentar_titel": "Kommentar Titel",
            "kommentar_beschreibung": "Kommentar Beschreibung",
            "platzhalter": "Platzhalter",
            "button_text": "Button Text",
            "speichern_sie_ihre_änderungen_": "Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.",
            "url_transformationsregeln": "URL-Transformationsregeln",
            "verwalten_sie_url_transformati": "Verwalten Sie URL-Transformations-Regeln für die Migration.",
            "löschen_1": "löschen",
            "konfigurationsvalidierung": "Konfigurationsvalidierung",
            "neue_regel": "Neue Regel",
            "suche": "Suche...",
            "seite": "Seite",
            "von": "von",
            "lade_regeln": "Lade Regeln...",
            "keine_regeln_für": "Keine Regeln für \"",
            "gefunden": "\" gefunden.",
            "versuchen_sie_einen_anderen_su": "Versuchen Sie einen anderen Suchbegriff oder erstellen Sie eine neue Regel.",
            "erste": "Erste",
            "vorherige": "Vorherige",
            "zeige": "Zeige",
            "nächste": "Nächste",
            "letzte": "Letzte",
            "overall": "Overall",
            "alle_einträge": "Alle Einträge",
            "letzte_24h": "Letzte 24h",
            "letzte_7_tage": "Letzte 7 Tage",
            "alle_zeit": "Alle Zeit",
            "nur_mit_regeln": "Nur mit Regeln",
            "nur_ohne_regeln": "Nur ohne Regeln",
            "alle_qualitäten": "Alle Qualitäten",
            "100_exakt": "100% (Exakt)",
            "75_fast_exakt": "75% (Fast exakt)",
            "50_teilweise": "50% (Teilweise)",
            "0_kein_treffer": "0% (Kein Treffer)",
            "alle_feedbacks": "Alle Feedbacks",
            "ok": "👍 OK",
            "nok": "👎 NOK",
            "auto": "⚡ Auto",
            "api": "🤖 API",
            "kein_feedback": "Kein Feedback",
            "gesamte_weiterleitungen": "Gesamte Weiterleitungen",
            "heute": "Heute",
            "exakte_trefferquote": "Exakte Trefferquote",
            "redirect_satisfaction_trend": "Redirect Satisfaction Trend",
            "entwicklung_der_qualität_und_n": "Entwicklung der Qualität und Nutzerzufriedenheit über die letzten",
            "tage": "Tage.",
            "täglich": "Täglich",
            "wöchentlich": "Wöchentlich",
            "monatlich": "Monatlich",
            "lade_trend": "Lade Trend...",
            "link_quality": "Link Quality",
            "qualitätsverteilung_der_link_m": "Qualitätsverteilung der Link-Matches",
            "lade_statistiken": "Lade Statistiken...",
            "exakter_treffer_100": "Exakter Treffer (100%)",
            "hoher_treffer_75": "Hoher Treffer (75%)",
            "mittlerer_treffer_50": "Mittlerer Treffer (50%)",
            "kein_treffer_0": "Kein Treffer (0%)",
            "nutzer_feedback": "Nutzer-Feedback",
            "rückmeldungen_zu_weiterleitung": "Rückmeldungen zu Weiterleitungen",
            "auto_redirect": "Auto-Redirect",
            "top_urls": "Top URLs",
            "lade_urls": "Lade URLs...",
            "keine_url_aufrufe_vorhanden": "Keine URL-Aufrufe vorhanden.",
            "url_pfad": "URL-Pfad",
            "aufrufe": "Aufrufe",
            "anteil": "Anteil",
            "top_referrer": "Top Referrer",
            "lade_referrer": "Lade Referrer...",
            "keine_referrer_daten_vorhanden": "Keine Referrer-Daten vorhanden.",
            "domain": "Domain",
            "anzahl": "Anzahl",
            "alle_tracking_einträge": "Alle Tracking-Einträge",
            "lade_einträge": "Lade Einträge...",
            "standard_import_export_excel_c": "Standard Import / Export (Excel, CSV)",
            "benutzerfreundlicher_import_un": "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV.\n                        Mit Vorschau-Funktion vor dem Import.",
            "regeln_importieren": "Regeln Importieren",
            "laden_sie_eine_excel_oder_csv_": "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:",
            "matcher": "Matcher",
            "pflicht_z_b_alte_seite": "(Pflicht) - z.B. /alte-seite",
            "target_url": "Target URL",
            "pflicht_z_b_https_neue_seite_d": "(Pflicht) - z.B. https://neue-seite.de",
            "type": "Type",
            "pflicht_partial_wildcard_oder_": "(Pflicht) - 'partial', 'wildcard' oder 'domain'",
            "info": "Info",
            "optional_beschreibung": "(Optional) - Beschreibung",
            "auto_redirect_1": "Auto Redirect",
            "optional_true_false": "(Optional) - 'true'/'false'",
            "discard_query_params": "Discard Query Params",
            "keep_query_params": "Keep Query Params",
            "static_query_params": "Static Query Params",
            "optional_json_array": "(Optional) - JSON Array",
            "search_replace": "Search Replace",
            "id": "ID",
            "optional_nur_für_updates_beste": "(Optional) - Nur für Updates bestehender Regeln",
            "musterdatei_excel": "Musterdatei (Excel)",
            "musterdatei_csv": "Musterdatei (CSV)",
            "analysiere_datei": "Analysiere Datei...",
            "klicken_zum_auswählen": "Klicken zum Auswählen",
            "oder_datei_hierher_ziehen": "oder Datei hierher ziehen",
            "excel_xlsx_oder_csv": "Excel (.xlsx) oder CSV",
            "urls_automatisch_kodieren": "URLs automatisch kodieren",
            "sonderzeichen_in_urls_automati": "Sonderzeichen in URLs automatisch konvertieren (encodeURI)",
            "regeln_exportieren": "Regeln Exportieren",
            "exportieren_sie_alle_regeln_zu": "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup.\n                                Die Dateien können später wieder importiert werden.",
            "herunterladen_excel": "Herunterladen (Excel)",
            "herunterladen_csv": "Herunterladen (CSV)",
            "erweiterter_regel_import_expor": "Erweiterter Regel-Import/Export",
            "für_fortgeschrittene_benutzer_": "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau.",
            "regel_rohdaten_json": "Regel-Rohdaten (JSON)",
            "herunterladen_json": "Herunterladen (JSON)",
            "importieren_json": "Importieren (JSON)",
            "musterdatei_json": "Musterdatei (JSON)",
            "warnung_1": "Warnung:",
            "keine_vorschau_überschreibt_be": "Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort.",
            "system_statistiken": "System & Statistiken",
            "verwaltung_von_systemeinstellu": "Verwaltung von Systemeinstellungen und Statistiken.",
            "system_einstellungen": "System-Einstellungen",
            "exportieren_sie_die_komplette_": "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen.",
            "exportieren_sie_die_tracking_l": "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse.",
            "gefahrenzone": "Gefahrenzone!",
            "cache_wartung": "Cache Wartung",
            "nur_bei_problemen_mit_der_rege": "Nur bei Problemen mit der Regelerkennung notwendig.",
            "sicherheit": "Sicherheit",
            "blockierte_ips_anzeigen_und_ve": "Blockierte IPs anzeigen und verwalten",
            "liste_der_blockierten_ips_eins": "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren.",
            "destruktive_aktionen": "Destruktive Aktionen",
            "alle_regeln_löschen": "Alle Regeln löschen",
            "löscht_alle_vorhandenen_weiter": "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich.",
            "alle_statistiken_löschen": "Alle Statistiken löschen",
            "löscht_alle_erfassten_tracking": "Löscht alle erfassten Tracking-Daten unwiderruflich.",
            "blockierte_ips_löschen": "Blockierte IPs löschen",
            "löscht_alle_blockierten_ip_adr": "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff.",
            "import_vorschau": "Import Vorschau",
            "überprüfen_sie_die_zu_importie": "Überprüfen Sie die zu importierenden Regeln.",
            "neu": "Neu:",
            "update": "Update:",
            "ungültig": "Ungültig:",
            "filter_löschen": "Filter löschen",
            "gesamt": "(Gesamt:",
            "mehr_laden_100": "Mehr laden (+100)",
            "url_pfad_matcher": "URL-Pfad Matcher",
            "ziel_url_optional": "Ziel-URL (optional)",
            "redirect_typ": "Redirect-Typ",
            "teilweise": "Teilweise",
            "nur_die_pfadsegmente_ab_dem_ma": "Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.",
            "vollständig": "Vollständig",
            "alte_links_werden_komplett_auf": "Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.",
            "domain_ersatz": "Domain-Ersatz",
            "ersetzt_nur_die_domain_host_de": "Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Wenn eine Ziel-URL angegeben ist, wird deren Domain verwendet.",
            "der_matcher_kann_hier_auch_ein": "Der Matcher kann hier auch eine Domain sein (z.B. \"www.alteseite.ch\"). Bei Verwendung eines Pfad-Matchers (\"/news\") mit diesem Typ wird nur die Domain ersetzt, während der Pfad erhalten bleibt.",
            "info_text_markdown": "Info-Text (Markdown)",
            "suchen_ersetzen": "Suchen & Ersetzen",
            "ersetzen_sie_teile_der_url_pfa": "Ersetzen Sie Teile der URL (Pfad oder Parameter) vor der Weiterleitung.",
            "suchen": "Suchen",
            "ersetzen": "Ersetzen",
            "aa": "Aa",
            "ersetzung_hinzufügen": "Ersetzung hinzufügen",
            "statische_parameter_hinzufügen": "Statische Parameter hinzufügen",
            "definieren_sie_parameter_die_i": "Definieren Sie Parameter, die immer an die Ziel-URL angehängt werden (z.B. ?source=migration).",
            "key": "Key",
            "value": "Value",
            "raw": "Raw",
            "parameter_hinzufügen": "Parameter hinzufügen",
            "alle_link_parameter_entfernen": "Alle Link-Parameter entfernen",
            "wenn_aktiviert_werden_alle_que": "Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten).",
            "alle_link_parameter_beibehalte": "Alle Link-Parameter beibehalten",
            "wenn_aktiviert_werden_die_ursp": "Wenn aktiviert, werden die ursprünglichen Query-Parameter 1:1 an die Ziel-URL angehängt.\n                      Deaktivieren Sie dies, um spezifische Parameter auszuwählen oder umzubenennen.",
            "parameter_beibehalten_umbenenn": "Parameter beibehalten / umbenennen (Regex)",
            "definieren_sie_ausnahmen_für_p": "Definieren Sie Ausnahmen für Parameter, die trotz Aktivierung erhalten bleiben sollen. Die Reihenfolge bestimmt die Position im neuen Query-String.",
            "parameter_key_regex": "Parameter Key (Regex)",
            "value_matcher_optional_regex": "Value Matcher (Optional Regex)",
            "neuer_name_optional": "Neuer Name (Optional)",
            "beispiel_file_hinzufügen": "Beispiel (File) hinzufügen",
            "automatische_weiterleitung_für": "Automatische Weiterleitung für diese Regel",
            "wenn_aktiviert_werden_benutzer": "Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet.",
            "warnung_da_die_feedback_umfrag": "Warnung: Da die Feedback-Umfrage global aktiviert ist, erhält der Nutzer bei diesem Auto-Redirect keine Möglichkeit Feedback zu geben.",
            "wichtiger_hinweis": "Wichtiger Hinweis",
            "bestätigung_für_die_aktivierun": "Bestätigung für die Aktivierung der automatischen Weiterleitung",
            "sie_sind_dabei_die_automatisch": "Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet.",
            "wichtiger_hinweis_1": "Wichtiger Hinweis:",
            "bei_aktivierter_automatischer__1": "Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter",
            "beispiel": "Beispiel:",
            "ich_habe_verstanden": "Ich habe verstanden",
            "blockierte_ips_löschen_1": "Blockierte IPs löschen?",
            "dies_löscht_alle_derzeit_block": "Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden.",
            "diese_aktion_hebt_den_brute_fo": "Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf.",
            "backup_herunterladen_excel": "Backup herunterladen (Excel)",
            "bestätigung_erforderlich": "Bestätigung erforderlich",
            "blockierte_ips_verwalten": "Blockierte IPs verwalten",
            "hier_können_sie_aktuell_blocki": "Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten.",
            "blockieren": "Blockieren",
            "ip_adresse": "IP-Adresse",
            "fehlversuche": "Fehlversuche",
            "blockiert_bis": "Blockiert bis",
            "aktionen": "Aktionen",
            "lade": "Lade...",
            "keine_blockierten_ip_adressen": "Keine blockierten IP-Adressen.",
            "alle_statistiken_löschen_1": "Alle Statistiken löschen?",
            "dies_löscht_alle_erfassten_tra": "Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "wir_empfehlen_dringend_vor_dem": "Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.",
            "backup_herunterladen_csv": "Backup herunterladen (CSV)",
            "validierungswarnung": "Validierungswarnung",
            "möchten_sie_die_regel_trotz_de": "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?",
            "regeln_löschen": "Regeln löschen",
            "sind_sie_sicher_dass_sie_die_a": "Sind Sie sicher, dass Sie die ausgewählten",
            "löschen_möchten_diese_aktion_k": "löschen möchten?\n              Diese Aktion kann nicht rückgängig gemacht werden.",
            "hinweis": "Hinweis:",
            "es_werden_nur_die_auf_der_aktu": "Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht.",
            "validierungsfehler": "Validierungsfehler",
            "die_einstellungen_konnten_aufg": "Die Einstellungen konnten aufgrund folgender Fehler nicht gespeichert werden:",
            "verstanden": "Verstanden",
            "statistik_limitierung_ändern": "Statistik-Limitierung ändern?",
            "sie_ändern_das_limit_für_stati": "Sie ändern das Limit für Statistik-Einträge von",
            "auf": "auf",
            "wenn_aktuell_mehr_als": "Wenn aktuell mehr als",
            "einträge_vorhanden_sind_aktuel": "Einträge vorhanden sind (aktuell:",
            "werden_die_ältesten_einträge_b": "), werden die ältesten Einträge beim\n              Speichern",
            "unwiderruflich_gelöscht": "unwiderruflich gelöscht",
            "verstanden_speichern": "Verstanden & Speichern",
            "validierung_neu_laden": "Validierung neu laden?",
            "sie_haben_eine_regel_geändert_": "Sie haben eine Regel geändert. Möchten Sie die Konfigurationsvalidierung mit den neuen Einstellungen neu laden?",
            "nein": "Nein",
            "ja_neu_laden": "Ja, neu laden",
            "alle_regeln_löschen_1": "Alle Regeln löschen?",
            "dies_löscht_alle_vorhandenen_r": "Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "backup_herunterladen_json": "Backup herunterladen (JSON)",
            "administrator_passwort_eingebe": "Administrator-Passwort eingeben",
            "smart_redirect_service": "Smart Redirect Service",
            "ffffff": "#ffffff",
            "url_veraltet_aktualisierung_er": "URL veraltet - Aktualisierung erforderlich",
            "du_verwendest_einen_alten_link": "Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen.",
            "zeige_mir_die_neue_url": "Zeige mir die neue URL",
            "https_thisisthenewurl_com": "https://thisisthenewurl.com/",
            "https_newapp_com_q": "https://newapp.com/?q=",
            "file": "[?&]file=([^&]+)",
            "teams_regex": "/teams (Regex)",
            "fügt_eine_beispiel_regex_hinzu": "Fügt eine Beispiel-Regex hinzu",
            "proudly_brewed_with_generative": "Proudly brewed with Generative AI.",
            "war_die_neue_url_korrekt": "War die neue URL korrekt?",
            "dein_feedback_hilft_uns_die_we": "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
            "vielen_dank_für_deine_rückmeld": "Vielen Dank für deine Rückmeldung.",
            "ja_ok": "Ja, OK",
            "regeln_durchsuchen": "Regeln durchsuchen...",
            "regeln_durchsuchen_1": "Regeln durchsuchen",
            "einträge_suchen": "Einträge suchen...",
            "statistiken_durchsuchen": "Statistiken durchsuchen",
            "regel_filter": "Regel-Filter",
            "qualität": "Qualität",
            "feedback": "Feedback",
            "news_beitrag": "/news-beitrag",
            "nachrichtenbeiträge_wurden_mig": "Nachrichtenbeiträge wurden migriert...",
            "alte_seite": "/alte-seite",
            "neue_seite_leer_löschen": "/neue-seite (leer = löschen)",
            "source": "source",
            "migration": "migration",
            "nicht_kodieren_no_url_encoding": "Nicht kodieren (No URL Encoding)",
            "nach_oben": "Nach oben",
            "nach_unten": "Nach unten",
            "file_1": "file",
            "f": "f",
            "tippen_sie_delete_zur_bestätig": "Tippen Sie \"DELETE\" zur Bestätigung",
            "ip_adresse_z_b_192_168_1_1": "IP-Adresse (z.B. 192.168.1.1)",
            "erfolgreich_angemeldet": "Erfolgreich angemeldet",
            "willkommen_im_administrator_be": "Willkommen im Administrator-Bereich.",
            "anmeldung_fehlgeschlagen": "Anmeldung fehlgeschlagen",
            "regel_erstellt": "Regel erstellt",
            "die_url_regel_wurde_erfolgreic": "Die URL-Regel wurde erfolgreich erstellt.",
            "authentifizierung_erforderlich": "Authentifizierung erforderlich",
            "bitte_melden_sie_sich_erneut_a": "Bitte melden Sie sich erneut an.",
            "regel_aktualisiert": "Regel aktualisiert",
            "die_url_regel_wurde_erfolgreic_1": "Die URL-Regel wurde erfolgreich aktualisiert.",
            "regel_gelöscht": "Regel gelöscht",
            "1_regel_wurde_erfolgreich_gelö": "1 Regel wurde erfolgreich gelöscht.",
            "fehler_1": "Fehler",
            "die_regel_konnte_nicht_gelösch": "Die Regel konnte nicht gelöscht werden.",
            "alle_statistiken_gelöscht": "Alle Statistiken gelöscht",
            "alle_tracking_daten_wurden_erf": "Alle Tracking-Daten wurden erfolgreich gelöscht.",
            "blockierte_ips_gelöscht": "Blockierte IPs gelöscht",
            "alle_blockierten_ip_adressen_w": "Alle blockierten IP-Adressen wurden erfolgreich gelöscht.",
            "ip_blockiert": "IP blockiert",
            "die_ip_adresse_wurde_erfolgrei": "Die IP-Adresse wurde erfolgreich blockiert.",
            "ip_entsperrt": "IP entsperrt",
            "die_ip_adresse_wurde_erfolgrei_1": "Die IP-Adresse wurde erfolgreich entsperrt.",
            "teilweise_gelöscht": "Teilweise gelöscht",
            "regeln_gelöscht": "Regeln gelöscht",
            "fehler_beim_löschen": "Fehler beim Löschen",
            "fehler_beim_speichern": "Fehler beim Speichern",
            "import_erfolgreich": "Import erfolgreich",
            "die_einstellungen_wurden_erfol": "Die Einstellungen wurden erfolgreich importiert.",
            "import_fehlgeschlagen": "Import fehlgeschlagen",
            "die_einstellungen_konnten_nich": "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
            "die_url_regel_wurde_trotz_warn": "Die URL-Regel wurde trotz Warnung erfolgreich erstellt.",
            "die_regel_konnte_auch_mit_forc": "Die Regel konnte auch mit Force-Option nicht erstellt werden.",
            "die_url_regel_wurde_trotz_warn_1": "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert.",
            "die_regel_konnte_auch_mit_forc_1": "Die Regel konnte auch mit Force-Option nicht aktualisiert werden.",
            "keine_gültigen_regeln_ausgewäh": "Keine gültigen Regeln ausgewählt",
            "keine_der_ausgewählten_regeln_": "Keine der ausgewählten Regeln befinden sich auf der aktuellen Seite.",
            "warnung_ungültige_auswahl_erka": "Warnung: Ungültige Auswahl erkannt",
            "sicherheitsfehler": "Sicherheitsfehler",
            "export_erfolgreich": "Export erfolgreich",
            "export_fehlgeschlagen": "Export fehlgeschlagen",
            "die_daten_konnten_nicht_export": "Die Daten konnten nicht exportiert werden.",
            "einstellungen_gespeichert": "Einstellungen gespeichert",
            "die_allgemeinen_einstellungen_": "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert.",
            "erfolgreich_abgemeldet": "Erfolgreich abgemeldet",
            "sie_wurden_erfolgreich_abgemel": "Sie wurden erfolgreich abgemeldet.",
            "abmeldung_fehlgeschlagen": "Abmeldung fehlgeschlagen",
            "vorschau_fehlgeschlagen": "Vorschau fehlgeschlagen",
            "import_mit_validierungsfehlern": "Import mit Validierungsfehlern",
            "datei_zu_groß": "Datei zu groß",
            "die_import_datei_ist_zu_groß_b": "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei).",
            "cache_neu_aufgebaut": "Cache neu aufgebaut",
            "der_regel_cache_wurde_erfolgre": "Der Regel-Cache wurde erfolgreich neu erstellt.",
            "fehler_beim_cache_neuaufbau": "Fehler beim Cache-Neuaufbau",
            "alle_regeln_gelöscht": "Alle Regeln gelöscht",
            "alle_url_regeln_wurden_erfolgr": "Alle URL-Regeln wurden erfolgreich gelöscht.",
            "import_fehler": "Import Fehler",
            "konnte_die_vollständigen_daten": "Konnte die vollständigen Daten für den Import nicht laden.",
            "dateifehler": "Dateifehler",
            "die_import_datei_konnte_nicht_": "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
            "die_datei_darf_maximal_5mb_gro": "Die Datei darf maximal 5MB groß sein.",
            "logo_hochgeladen": "Logo hochgeladen",
            "das_header_logo_wurde_erfolgre": "Das Header-Logo wurde erfolgreich aktualisiert.",
            "fehler_beim_hochladen": "Fehler beim Hochladen",
            "das_logo_konnte_nicht_hochgela": "Das Logo konnte nicht hochgeladen werden.",
            "logo_entfernt": "Logo entfernt",
            "das_header_logo_wurde_erfolgre_1": "Das Header-Logo wurde erfolgreich entfernt.",
            "das_logo_konnte_nicht_entfernt": "Das Logo konnte nicht entfernt werden.",
            "die_globalen_regeln_wurden_erf": "Die globalen Regeln wurden erfolgreich aktualisiert.",
            "url_wird_analysiert": "URL wird analysiert...",
            "klicken_zum_kopieren": "Klicken zum Kopieren",
            "url_erfolgreich_in_die_zwische": "URL erfolgreich in die Zwischenablage kopiert!",
            "v": "v",
            "überspringen": "Überspringen",
            "neue_url_in_neuem_tab_öffnen": "Neue URL in neuem Tab öffnen",
            "kopieren_fehlgeschlagen": "Kopieren fehlgeschlagen",
            "bitte_kopieren_sie_die_url_man": "Bitte kopieren Sie die URL manuell.",
            "404_page_not_found": "404 Page Not Found",
            "did_you_forget_to_add_the_page": "Did you forget to add the page to the router?",
            "globale_regeln": "Globale Regeln",
            "diese_regeln_werden_auf_alle_w": "Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).\n                    Spezifische Regeln überschreiben diese globalen Einstellungen.",
            "globales_suchen_ersetzen": "Globales Suchen & Ersetzen",
            "ersetzen_sie_text_in_der_ziel_": "Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.",
            "reihenfolge_global_hier_rarr_r": "Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.",
            "globale_statische_parameter": "Globale Statische Parameter",
            "parameter_die_immer_angehängt_": "Parameter, die immer angehängt werden (z.B. ?source=migration).",
            "wenn_eine_regel_denselben_para": "Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.",
            "globale_parameter_übernahme_wh": "Globale Parameter-Übernahme (Whitelist)",
            "parameter_die_bei_aktivierter_": "Parameter, die bei aktivierter \"Parameter entfernen\" Option (in einer Regel) trotzdem behalten werden.",
            "wird_zusätzlich_zu_den_regel_s": "Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.",
            "key_pattern_regex": "Key Pattern (Regex)",
            "value_pattern_opt": "Value Pattern (Opt.)",
            "neuer_name_opt": "Neuer Name (Opt.)",
            "beispiel_file": "Beispiel (file)",
            "alte_pfade": "/alte-pfade",
            "neue_pfade": "/neue-pfade",
            "utm_source": "utm_source",
            "migration_tool": "migration_tool",
            "nicht_kodieren_raw": "Nicht kodieren (Raw)",
            "id_lang": "id|lang",
            "new_id": "new_id",
            "query_parameters": "Query Parameters",
            "mode": "Mode:",
            "kept_params_exceptions": "Kept Params (Exceptions):",
            "rarr": "&rarr;",
            "static_params_appended": "Static Params (Appended):",
            "search_replace_1": "Search & Replace",
            "case_sensitive": "Case Sensitive",
            "keine_suchen_ersetzen_regeln": "Keine Suchen & Ersetzen Regeln.",
            "info_beschreibung": "Info / Beschreibung",
            "status": "Status",
            "ziel_url": "Ziel-URL",
            "typ": "Typ",
            "auto_1": "Auto",
            "erstellt_am": "Erstellt am",
            "das_auswählen_und_löschen_mehr": "Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.",
            "params_entfernen": "Params Entfernen",
            "params_behalten": "Params Behalten",
            "regel_löschen": "Regel löschen",
            "sind_sie_sicher_dass_sie_diese": "Sind Sie sicher, dass Sie diese Regel löschen möchten?\n                      Diese Aktion kann nicht rückgängig gemacht werden.",
            "ziel_url_1": "Ziel-URL:",
            "automatisch_generiert": "Automatisch generiert",
            "info_text": "Info-Text:",
            "erstellt": "Erstellt:",
            "bearbeiten": "Bearbeiten",
            "regel_bearbeiten": "Regel bearbeiten",
            "expand_all": "Expand All",
            "collapse_all": "Collapse All",
            "erstellt_1": "Erstellt",
            "action": "Action",
            "on": "On",
            "sind_sie_sicher": "Sind Sie sicher?",
            "parameter_konfiguration": "Parameter Konfiguration",
            "handling_mode": "Handling Mode:",
            "ausnahmen_kept": "Ausnahmen (Kept):",
            "statische_parameter": "Statische Parameter:",
            "keine": "Keine.",
            "alle_regeln_auf_dieser_seite_a": "Alle Regeln auf dieser Seite auswählen/abwählen",
            "nicht_genügend_daten_für_trend": "Nicht genügend Daten für Trendanzeige",
            "match_quality": "Match Quality",
            "feedback_inkl_auto": "Feedback (inkl. Auto)",
            "match": "Match:",
            "score": "Score:",
            "total": "Total:",
            "ok_1": "(OK:",
            "auto_2": ", Auto:",
            "nok_1": ", NOK:",
            "spalten_anpassen": "Spalten anpassen",
            "spalten_auswählen": "Spalten auswählen",
            "zeitstempel": "Zeitstempel",
            "alte_url": "Alte URL",
            "neue_url": "Neue URL",
            "pfad": "Pfad",
            "referrer": "Referrer",
            "regel": "Regel",
            "n_a": "N/A",
            "smart_search": "Smart Search",
            "domain_redirect": "Domain Redirect",
            "regel_nicht_mehr_vorhanden": "Regel nicht mehr vorhanden",
            "gelöscht": "Gelöscht",
            "api_1": "API",
            "vorschlag": "Vorschlag:",
            "intelligente_suche_fallback": "Intelligente Suche (Fallback)",
            "standard_domain_weiterleitung_": "Standard Domain-Weiterleitung (Fallback)",
            "api_call": "API Call",
            "übersetzungen_für_die_anwendun": "Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.",
            "speichern": "Speichern",
            "schlüssel_key": "Schlüssel (Key)",
            "wert_value": "Wert (Value)",
            "sprache_auswählen": "Sprache auswählen",
            "neuer_schlüssel": "Neuer Schlüssel...",
            "wert": "Wert...",
            "erfolg": "Erfolg",
            "übersetzungen_gespeichert": "Übersetzungen gespeichert.",
            "konnte_übersetzungen_nicht_spe": "Konnte Übersetzungen nicht speichern.",
            "old": "Old:",
            "new": "New:",
            "ergebnis_analyse": "Ergebnis-Analyse",
            "original": "Original:",
            "smart_search_fallback": "Smart Search Fallback:",
            "weiterleitung_zur_suche_da_kei": "Weiterleitung zur Suche, da keine Regel passte.",
            "angewandte_regel": "Angewandte Regel",
            "id_1": "ID:",
            "matcher_1": "Matcher:",
            "ziel": "Ziel:",
            "typ_1": "Typ:",
            "parameter_werden_verworfen": "Parameter werden verworfen",
            "keine_spezifische_regel_gefund": "Keine spezifische Regel gefunden (Fallback).",
            "angewandte_globale_regeln": "Angewandte Globale Regeln",
            "keine_globalen_regeln_angewend": "Keine globalen Regeln angewendet",
            "verarbeitungsschritte": "Verarbeitungsschritte",
            "testen_sie_ihre_regeln_mit_ein": "Testen Sie Ihre Regeln mit einer Liste von URLs. Importieren Sie eine CSV/Excel-Datei oder fügen Sie URLs ein.",
            "text_einfügen": "Text einfügen",
            "datei_hochladen": "Datei hochladen",
            "urls_einfügen_durch_komma_semi": "URLs einfügen (durch Komma, Semikolon oder neue Zeile getrennt)",
            "leerzeichen_nach_trennzeichen_": "Leerzeichen nach Trennzeichen werden automatisch entfernt.",
            "unterstützt_csv_xlsx_xls_nur_e": "Unterstützt CSV, XLSX, XLS (nur erste Spalte wird verwendet)",
            "ausgewählt": "Ausgewählt",
            "hinweis_1": "Hinweis",
            "verarbeite_urls": "Verarbeite URLs...",
            "ergebnisse": "Ergebnisse",
            "neu_berechnen": "Neu berechnen",
            "csv_export": "CSV Export",
            "neue_suche": "Neue Suche",
            "url_transformation": "URL Transformation",
            "rule_tag": "Rule Tag",
            "validierung_starten": "Validierung starten",
            "https_example_com_a_10_https_e": "https://example.com/a&#10;https://example.com/b",
            "alle_ausklappen": "Alle ausklappen",
            "alle_einklappen": "Alle einklappen",
            "keine_daten_zum_aktualisieren": "Keine Daten zum Aktualisieren",
            "bitte_starten_sie_den_prozess_": "Bitte starten Sie den Prozess neu.",
            "close": "Close",
            "bitte_geben_sie_das_administra_1": "Bitte geben Sie das Administrator-Passwort ein:",
            "passwort_eingeben": "Passwort eingeben",
            "link_qualität": "Link-Qualität:"
      },
      "it": {
            "incorrect_password_please_try_": "Password errata. Per favore riprova.",
            "please_enter_the_administrator": "Inserisci la password dell'amministratore.",
            "enter_password": "Inserisci la password",
            "incorrect_password": "Password errata",
            "password": "password",
            "enter_administrator_password": "Inserisci la password dell'amministratore",
            "administrator_login": "Accesso amministratore",
            "welcome_to_the_admin_area": "Benvenuto nell'area amministrativa.",
            "open_administrator_area": "Apri l'area amministratore",
            "loading_app": "",
            "admin_area": "",
            "lang": "Lang",
            "showing": "Showing",
            "of": "of",
            "entries": "entries",
            "performance": "Performance",
            "memory": "Memory:",
            "performance_monitor": "Performance Monitor",
            "overview": "Overview",
            "loading": "Loading",
            "memory_1": "Memory",
            "issues_detected": "Issues Detected:",
            "dom": "DOM:",
            "load": "Load:",
            "heap": "Heap:",
            "dom_ready": "DOM Ready:",
            "load_complete": "Load Complete:",
            "first_paint": "First Paint:",
            "dns_lookup": "DNS Lookup:",
            "tcp_connect": "TCP Connect:",
            "server_response": "Server Response:",
            "resources": "Resources:",
            "slow_resources": "Slow Resources:",
            "js_size": "JS Size:",
            "css_size": "CSS Size:",
            "loading_performance_data": "Loading performance data...",
            "used_heap": "Used Heap:",
            "total_heap": "Total Heap:",
            "heap_limit": "Heap Limit:",
            "usage": "Usage:",
            "memory_data_not_available": "Memory data not available",
            "administrator_anmeldung": "Administrator-Anmeldung",
            "bitte_geben_sie_das_administra": "Bitte geben Sie das Administrator-Passwort ein.",
            "passwort": "Passwort",
            "abbrechen": "Abbrechen",
            "überprüfe_authentifizierung": "Überprüfe Authentifizierung...",
            "administrator_bereich": "Administrator-Bereich",
            "admin": "Admin",
            "schließen": "Schließen",
            "allgemein": "Allgemein",
            "regeln": "Regeln",
            "global": "Global",
            "statistiken": "Statistiken",
            "system_daten": "System & Daten",
            "sprachen": "Sprachen",
            "allgemeine_einstellungen": "Allgemeine Einstellungen",
            "hier_können_sie_alle_texte_der": "Hier können Sie alle Texte der Anwendung anpassen.",
            "bitte_melden_sie_sich_an_auth": "Bitte melden Sie sich an... (Auth:",
            "lade_einstellungen_auth": "Lade Einstellungen... (Auth:",
            "loading_1": ", Loading:",
            "header_einstellungen": "Header-Einstellungen",
            "anpassung_des_oberen_bereichs_": "Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt",
            "titel": "Titel",
            "wird_als_haupttitel_im_header_": "Wird als Haupttitel im Header der Anwendung angezeigt",
            "icon": "Icon",
            "kein_icon": "🚫 Kein Icon",
            "pfeil_wechsel": "🔄 Pfeil Wechsel",
            "warnung": "⚠️ Warnung",
            "fehler": "❌ Fehler",
            "alert": "⭕ Alert",
            "ℹ_info": "ℹ️ Info",
            "lesezeichen": "🔖 Lesezeichen",
            "teilen": "📤 Teilen",
            "zeit": "⏰ Zeit",
            "häkchen": "✅ Häkchen",
            "stern": "⭐ Stern",
            "herz": "❤️ Herz",
            "glocke": "🔔 Glocke",
            "hintergrundfarbe": "Hintergrundfarbe",
            "logo_hochladen": "Logo hochladen",
            "empfehlung": "Empfehlung:",
            "png_mit_transparentem_hintergr": "PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)",
            "funktion": "Funktion:",
            "wenn_ein_logo_hochgeladen_wird": "Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt.",
            "aktuelles_logo": "Aktuelles Logo:",
            "löschen": "Löschen",
            "logo_aktiv_wird_anstelle_des_i": "Logo aktiv - wird anstelle des Icons angezeigt",
            "interaktionen": "Interaktionen",
            "steuern_sie_die_interaktionsmö": "Steuern Sie die Interaktionsmöglichkeiten auf der Migrationsseite",
            "kopier_button_anzeigen": "Kopier-Button anzeigen",
            "blendet_den_button_zum_kopiere": "Blendet den Button zum Kopieren der URL ein/aus",
            "öffnen_button_anzeigen": "Öffnen-Button anzeigen",
            "blendet_den_button_zum_öffnen_": "Blendet den Button zum Öffnen im neuen Tab ein/aus",
            "verhalten_bei_klick_auf_url_fe": "Verhalten bei Klick auf URL-Feld",
            "kopieren_standard": "Kopieren (Standard)",
            "in_neuem_tab_öffnen": "In neuem Tab öffnen",
            "keine_aktion": "Keine Aktion",
            "definiert_was_passiert_wenn_de": "Definiert was passiert, wenn der Nutzer direkt auf das Feld mit der neuen URL klickt.",
            "button_text_url_kopieren": "Button-Text \"URL kopieren\"",
            "button_text_in_neuem_tab_öffne": "Button-Text \"In neuem Tab öffnen\"",
            "popup_einstellungen": "PopUp-Einstellungen",
            "dialog_fenster_das_automatisch": "Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft",
            "popup_anzeige": "PopUp-Anzeige",
            "aktiv": "Aktiv",
            "inline": "Inline",
            "deaktiviert": "Deaktiviert",
            "beschreibung": "Beschreibung",
            "erklärt_dem_nutzer_die_situati": "Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte",
            "popup_button_text": "PopUp Button-Text",
            "text_für_den_button_der_das_po": "Text für den Button der das PopUp-Fenster öffnet",
            "alert_hintergrundfarbe": "Alert-Hintergrundfarbe",
            "gelb": "🟡 Gelb",
            "rot": "🔴 Rot",
            "orange": "🟠 Orange",
            "blau": "🔵 Blau",
            "grau": "⚫ Grau",
            "hauptinhalt_hintergrundfarbe": "Hauptinhalt-Hintergrundfarbe",
            "routing_fallback_verhalten": "Routing & Fallback-Verhalten",
            "konfiguration_des_verhaltens_b": "Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung",
            "ziel_domain_standard_neue_doma": "Ziel-Domain (Standard neue Domain)",
            "verwendet_für_partial_matches_": "Verwendet für Partial Matches und spezifische Regeln.",
            "fallback_strategie": "Fallback-Strategie",
            "einfacher_domain_austausch": "Einfacher Domain-Austausch",
            "standard_verhalten_ersetzt_die": "Standard-Verhalten: Ersetzt die alte Domain durch die neue \"Target Domain\". Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt.",
            "intelligente_such_weiterleitun": "Intelligente Such-Weiterleitung",
            "intelligenter_fallback_leitet_": "Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite.",
            "definiert_was_passiert_wenn_ke": "Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift.",
            "such_basis_url": "Such-Basis-URL",
            "beispiel_https_newapp_com_q": "Beispiel: https://newapp.com/?q=",
            "nicht_kodieren": "Nicht kodieren",
            "extraktions_regeln_regex": "Extraktions-Regeln (Regex)",
            "regex_pattern_extraction_optio": "Regex Pattern (Extraction - optional)",
            "path_matcher_prefix": "Path Matcher (Prefix)",
            "custom_search_base_url_optiona": "Custom Search Base URL (Optional)",
            "suchbegriff_nicht_kodieren_no_": "Suchbegriff nicht kodieren (No URL Encoding)",
            "regel_hinzufügen": "Regel hinzufügen",
            "beispiel_hinzufügen": "Beispiel hinzufügen",
            "definieren_sie_eine_liste_von_": "Definieren Sie eine Liste von Regeln. Die Regeln werden von oben nach unten geprüft.\n                                    Wenn Sie ein Regex-Pattern definieren, muss es eine Capture Group () enthalten.",
            "lassen_sie_das_feld_regex_patt": "Lassen Sie das Feld \"Regex Pattern\" leer, um automatisch das letzte Pfadsegment zu verwenden.",
            "wenn_keine_regel_greift_wird_a": "Wenn keine Regel greift, wird als Fallback ebenfalls das letzte Pfadsegment verwendet.",
            "fallback_info_nachrichten": "Fallback-Info-Nachrichten",
            "spezielle_hinweise_titel": "Spezielle Hinweise - Titel",
            "spezielle_hinweise_icon": "Spezielle Hinweise - Icon",
            "standard_info_text_beschreibun": "Standard Info Text (Beschreibung)",
            "angezeigt_wenn_eine_regel_matc": "Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat.",
            "smart_search_nachricht": "Smart Search Nachricht",
            "angezeigt_nur_wenn_intelligent": "Angezeigt NUR wenn \"Intelligente Such-Weiterleitung\" ausgelöst wird (keine Regel matched).",
            "visualisierung": "Visualisierung",
            "label_für_alte_url": "Label für alte URL",
            "label_für_neue_url": "Label für neue URL",
            "link_qualitätstacho_anzeigen": "Link-Qualitätstacho anzeigen",
            "text_für_hohe_übereinstimmung_": "Text für hohe Übereinstimmung (100%)",
            "text_für_mittlere_übereinstimm": "Text für mittlere Übereinstimmung (75%)",
            "text_für_geringe_übereinstimmu": "Text für geringe Übereinstimmung (50%)",
            "text_für_startseiten_treffer_1": "Text für Startseiten-Treffer (100%)",
            "text_für_keine_übereinstimmung": "Text für keine Übereinstimmung (0%)",
            "zusätzliche_informationen": "Zusätzliche Informationen",
            "wird_nur_angezeigt_wenn_mindes": "Wird nur angezeigt wenn mindestens ein Info-Punkt konfiguriert ist",
            "titel_der_sektion": "Titel der Sektion",
            "überschrift_für_den_bereich_mi": "Überschrift für den Bereich mit zusätzlichen Informationen",
            "icon_für_den_titel": "Icon für den Titel",
            "informations_punkte": "Informations-Punkte",
            "liste_von_stichpunkten_die_unt": "Liste von Stichpunkten die unter dem Info-Text angezeigt werden",
            "hinzufügen": "Hinzufügen",
            "bookmark": "🔖 Bookmark",
            "share": "📤 Share",
            "clock": "⏰ Clock",
            "check": "✅ Check",
            "star": "⭐ Star",
            "heart": "❤️ Heart",
            "bell": "🔔 Bell",
            "keine_info_punkte_vorhanden_kl": "Keine Info-Punkte vorhanden. Klicken Sie \"Hinzufügen\" um welche zu erstellen.",
            "footer": "Footer",
            "copyright_und_fußzeile_der_anw": "Copyright und Fußzeile der Anwendung",
            "copyright_text": "Copyright-Text",
            "link_erkennung_leistung": "Link-Erkennung & Leistung",
            "einstellungen_zur_erkennungslo": "Einstellungen zur Erkennungslogik und Systemleistung",
            "groß_kleinschreibung_beachten": "Groß-/Kleinschreibung beachten",
            "wenn_aktiviert_werden_regeln_n": "Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert.",
            "referrer_tracking_aktivieren": "Referrer Tracking aktivieren",
            "erfasst_die_herkunfts_url_refe": "Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen.",
            "tracking_cache_aktivieren_ram": "Tracking-Cache aktivieren (RAM)",
            "speichert_statistik_daten_im_a": "Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten.",
            "max_statistik_einträge": "Max. Statistik-Einträge",
            "begrenzt_die_anzahl_der_gespei": "Begrenzt die Anzahl der gespeicherten Statistik-Einträge in der tracking.json. Älteste Einträge werden bei Überschreitung gelöscht. (0 = Unbegrenzt)",
            "lassen_sie_den_tracking_cache_": "Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (&lt; 512MB) oder Sie haben extrem viele Tracking-Daten (&gt; 1 Mio. Einträge).",
            "automatische_weiterleitung": "Automatische Weiterleitung",
            "globale_einstellungen_für_auto": "Globale Einstellungen für automatische Weiterleitungen",
            "automatische_weiterleitung_akt": "Automatische Weiterleitung aktivieren",
            "wenn_aktiviert_werden_alle_ben": "Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen.",
            "hinweis_feedback_umfrage_wird_": "Hinweis: Feedback-Umfrage wird deaktiviert, da keine Interaktion stattfindet (Auto-Redirect wird als Feedback geloggt).",
            "admin_zugriff": "Admin-Zugriff:",
            "bei_aktivierter_automatischer_": "Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter",
            "admin_true": "?admin=true",
            "erreichen": "erreichen.",
            "benutzer_feedback_umfrage": "Benutzer-Feedback-Umfrage",
            "erfassen_sie_feedback_von_nutz": "Erfassen Sie Feedback von Nutzern zur Qualität der Weiterleitung",
            "feedback_umfrage_aktivieren": "Feedback-Umfrage aktivieren",
            "zeigt_ein_popup_an_wenn_nutzer": "Zeigt ein Popup an, wenn Nutzer auf \"Kopieren\" oder \"Öffnen\" klicken, um zu fragen, ob der Link funktioniert hat.",
            "trend_anzeige": "Trend-Anzeige",
            "konfiguration_für_den_redirect": "Konfiguration für den \"Redirect Satisfaction Trend\"",
            "zeitraum_tage": "Zeitraum (Tage)",
            "nur_feedback_ok_nok_anzeigen": "Nur Feedback (OK/NOK) anzeigen",
            "berechnet_den_score_ausschließ": "Berechnet den Score ausschließlich basierend auf Benutzer-Feedback, ignoriert automatische Match-Qualität.",
            "umfrage_titel": "Umfrage Titel",
            "umfrage_frage": "Umfrage Frage",
            "erfolgsmeldung": "Erfolgsmeldung",
            "button_ja_ok": "Button Ja (OK)",
            "text_auf_dem_button_für_positi": "Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)",
            "button_nein_nok": "Button Nein (NOK)",
            "text_auf_dem_button_für_negati": "Text auf dem Button für negative Rückmeldung (Standard: Nein)",
            "such_vorschlag_bei_nein_aktivi": "Such-Vorschlag bei \"Nein\" aktivieren",
            "zeigt_dem_nutzer_einen_link_zu": "Zeigt dem Nutzer einen Link zur intelligenten Suche an, wenn die Bewertung negativ ausfällt. (Erfordert aktive \"Intelligente Such-Weiterleitung\")",
            "nur_verfügbar_wenn_intelligent": "* Nur verfügbar wenn \"Intelligente Such-Weiterleitung\" als Fallback-Strategie gewählt ist.",
            "vorschlag_titel": "Vorschlag Titel",
            "vorschlag_beschreibung": "Vorschlag Beschreibung",
            "vorschlag_frage": "Vorschlag Frage",
            "kommentar_funktion_bei_nein_ak": "Kommentar-Funktion bei \"Nein\" aktivieren",
            "fragt_den_nutzer_nach_der_korr": "Fragt den Nutzer nach der korrekten URL, wenn die Bewertung negativ ausfällt (oder nachdem die Suche erfolglos war).",
            "kommentar_titel": "Kommentar Titel",
            "kommentar_beschreibung": "Kommentar Beschreibung",
            "platzhalter": "Platzhalter",
            "button_text": "Button Text",
            "speichern_sie_ihre_änderungen_": "Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.",
            "url_transformationsregeln": "URL-Transformationsregeln",
            "verwalten_sie_url_transformati": "Verwalten Sie URL-Transformations-Regeln für die Migration.",
            "löschen_1": "löschen",
            "konfigurationsvalidierung": "Konfigurationsvalidierung",
            "neue_regel": "Neue Regel",
            "suche": "Suche...",
            "seite": "Seite",
            "von": "von",
            "lade_regeln": "Lade Regeln...",
            "keine_regeln_für": "Keine Regeln für \"",
            "gefunden": "\" gefunden.",
            "versuchen_sie_einen_anderen_su": "Versuchen Sie einen anderen Suchbegriff oder erstellen Sie eine neue Regel.",
            "erste": "Erste",
            "vorherige": "Vorherige",
            "zeige": "Zeige",
            "nächste": "Nächste",
            "letzte": "Letzte",
            "overall": "Overall",
            "alle_einträge": "Alle Einträge",
            "letzte_24h": "Letzte 24h",
            "letzte_7_tage": "Letzte 7 Tage",
            "alle_zeit": "Alle Zeit",
            "nur_mit_regeln": "Nur mit Regeln",
            "nur_ohne_regeln": "Nur ohne Regeln",
            "alle_qualitäten": "Alle Qualitäten",
            "100_exakt": "100% (Exakt)",
            "75_fast_exakt": "75% (Fast exakt)",
            "50_teilweise": "50% (Teilweise)",
            "0_kein_treffer": "0% (Kein Treffer)",
            "alle_feedbacks": "Alle Feedbacks",
            "ok": "👍 OK",
            "nok": "👎 NOK",
            "auto": "⚡ Auto",
            "api": "🤖 API",
            "kein_feedback": "Kein Feedback",
            "gesamte_weiterleitungen": "Gesamte Weiterleitungen",
            "heute": "Heute",
            "exakte_trefferquote": "Exakte Trefferquote",
            "redirect_satisfaction_trend": "Redirect Satisfaction Trend",
            "entwicklung_der_qualität_und_n": "Entwicklung der Qualität und Nutzerzufriedenheit über die letzten",
            "tage": "Tage.",
            "täglich": "Täglich",
            "wöchentlich": "Wöchentlich",
            "monatlich": "Monatlich",
            "lade_trend": "Lade Trend...",
            "link_quality": "Link Quality",
            "qualitätsverteilung_der_link_m": "Qualitätsverteilung der Link-Matches",
            "lade_statistiken": "Lade Statistiken...",
            "exakter_treffer_100": "Exakter Treffer (100%)",
            "hoher_treffer_75": "Hoher Treffer (75%)",
            "mittlerer_treffer_50": "Mittlerer Treffer (50%)",
            "kein_treffer_0": "Kein Treffer (0%)",
            "nutzer_feedback": "Nutzer-Feedback",
            "rückmeldungen_zu_weiterleitung": "Rückmeldungen zu Weiterleitungen",
            "auto_redirect": "Auto-Redirect",
            "top_urls": "Top URLs",
            "lade_urls": "Lade URLs...",
            "keine_url_aufrufe_vorhanden": "Keine URL-Aufrufe vorhanden.",
            "url_pfad": "URL-Pfad",
            "aufrufe": "Aufrufe",
            "anteil": "Anteil",
            "top_referrer": "Top Referrer",
            "lade_referrer": "Lade Referrer...",
            "keine_referrer_daten_vorhanden": "Keine Referrer-Daten vorhanden.",
            "domain": "Domain",
            "anzahl": "Anzahl",
            "alle_tracking_einträge": "Alle Tracking-Einträge",
            "lade_einträge": "Lade Einträge...",
            "standard_import_export_excel_c": "Standard Import / Export (Excel, CSV)",
            "benutzerfreundlicher_import_un": "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV.\n                        Mit Vorschau-Funktion vor dem Import.",
            "regeln_importieren": "Regeln Importieren",
            "laden_sie_eine_excel_oder_csv_": "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:",
            "matcher": "Matcher",
            "pflicht_z_b_alte_seite": "(Pflicht) - z.B. /alte-seite",
            "target_url": "Target URL",
            "pflicht_z_b_https_neue_seite_d": "(Pflicht) - z.B. https://neue-seite.de",
            "type": "Type",
            "pflicht_partial_wildcard_oder_": "(Pflicht) - 'partial', 'wildcard' oder 'domain'",
            "info": "Info",
            "optional_beschreibung": "(Optional) - Beschreibung",
            "auto_redirect_1": "Auto Redirect",
            "optional_true_false": "(Optional) - 'true'/'false'",
            "discard_query_params": "Discard Query Params",
            "keep_query_params": "Keep Query Params",
            "static_query_params": "Static Query Params",
            "optional_json_array": "(Optional) - JSON Array",
            "search_replace": "Search Replace",
            "id": "ID",
            "optional_nur_für_updates_beste": "(Optional) - Nur für Updates bestehender Regeln",
            "musterdatei_excel": "Musterdatei (Excel)",
            "musterdatei_csv": "Musterdatei (CSV)",
            "analysiere_datei": "Analysiere Datei...",
            "klicken_zum_auswählen": "Klicken zum Auswählen",
            "oder_datei_hierher_ziehen": "oder Datei hierher ziehen",
            "excel_xlsx_oder_csv": "Excel (.xlsx) oder CSV",
            "urls_automatisch_kodieren": "URLs automatisch kodieren",
            "sonderzeichen_in_urls_automati": "Sonderzeichen in URLs automatisch konvertieren (encodeURI)",
            "regeln_exportieren": "Regeln Exportieren",
            "exportieren_sie_alle_regeln_zu": "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup.\n                                Die Dateien können später wieder importiert werden.",
            "herunterladen_excel": "Herunterladen (Excel)",
            "herunterladen_csv": "Herunterladen (CSV)",
            "erweiterter_regel_import_expor": "Erweiterter Regel-Import/Export",
            "für_fortgeschrittene_benutzer_": "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau.",
            "regel_rohdaten_json": "Regel-Rohdaten (JSON)",
            "herunterladen_json": "Herunterladen (JSON)",
            "importieren_json": "Importieren (JSON)",
            "musterdatei_json": "Musterdatei (JSON)",
            "warnung_1": "Warnung:",
            "keine_vorschau_überschreibt_be": "Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort.",
            "system_statistiken": "System & Statistiken",
            "verwaltung_von_systemeinstellu": "Verwaltung von Systemeinstellungen und Statistiken.",
            "system_einstellungen": "System-Einstellungen",
            "exportieren_sie_die_komplette_": "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen.",
            "exportieren_sie_die_tracking_l": "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse.",
            "gefahrenzone": "Gefahrenzone!",
            "cache_wartung": "Cache Wartung",
            "nur_bei_problemen_mit_der_rege": "Nur bei Problemen mit der Regelerkennung notwendig.",
            "sicherheit": "Sicherheit",
            "blockierte_ips_anzeigen_und_ve": "Blockierte IPs anzeigen und verwalten",
            "liste_der_blockierten_ips_eins": "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren.",
            "destruktive_aktionen": "Destruktive Aktionen",
            "alle_regeln_löschen": "Alle Regeln löschen",
            "löscht_alle_vorhandenen_weiter": "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich.",
            "alle_statistiken_löschen": "Alle Statistiken löschen",
            "löscht_alle_erfassten_tracking": "Löscht alle erfassten Tracking-Daten unwiderruflich.",
            "blockierte_ips_löschen": "Blockierte IPs löschen",
            "löscht_alle_blockierten_ip_adr": "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff.",
            "import_vorschau": "Import Vorschau",
            "überprüfen_sie_die_zu_importie": "Überprüfen Sie die zu importierenden Regeln.",
            "neu": "Neu:",
            "update": "Update:",
            "ungültig": "Ungültig:",
            "filter_löschen": "Filter löschen",
            "gesamt": "(Gesamt:",
            "mehr_laden_100": "Mehr laden (+100)",
            "url_pfad_matcher": "URL-Pfad Matcher",
            "ziel_url_optional": "Ziel-URL (optional)",
            "redirect_typ": "Redirect-Typ",
            "teilweise": "Teilweise",
            "nur_die_pfadsegmente_ab_dem_ma": "Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.",
            "vollständig": "Vollständig",
            "alte_links_werden_komplett_auf": "Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.",
            "domain_ersatz": "Domain-Ersatz",
            "ersetzt_nur_die_domain_host_de": "Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Wenn eine Ziel-URL angegeben ist, wird deren Domain verwendet.",
            "der_matcher_kann_hier_auch_ein": "Der Matcher kann hier auch eine Domain sein (z.B. \"www.alteseite.ch\"). Bei Verwendung eines Pfad-Matchers (\"/news\") mit diesem Typ wird nur die Domain ersetzt, während der Pfad erhalten bleibt.",
            "info_text_markdown": "Info-Text (Markdown)",
            "suchen_ersetzen": "Suchen & Ersetzen",
            "ersetzen_sie_teile_der_url_pfa": "Ersetzen Sie Teile der URL (Pfad oder Parameter) vor der Weiterleitung.",
            "suchen": "Suchen",
            "ersetzen": "Ersetzen",
            "aa": "Aa",
            "ersetzung_hinzufügen": "Ersetzung hinzufügen",
            "statische_parameter_hinzufügen": "Statische Parameter hinzufügen",
            "definieren_sie_parameter_die_i": "Definieren Sie Parameter, die immer an die Ziel-URL angehängt werden (z.B. ?source=migration).",
            "key": "Key",
            "value": "Value",
            "raw": "Raw",
            "parameter_hinzufügen": "Parameter hinzufügen",
            "alle_link_parameter_entfernen": "Alle Link-Parameter entfernen",
            "wenn_aktiviert_werden_alle_que": "Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten).",
            "alle_link_parameter_beibehalte": "Alle Link-Parameter beibehalten",
            "wenn_aktiviert_werden_die_ursp": "Wenn aktiviert, werden die ursprünglichen Query-Parameter 1:1 an die Ziel-URL angehängt.\n                      Deaktivieren Sie dies, um spezifische Parameter auszuwählen oder umzubenennen.",
            "parameter_beibehalten_umbenenn": "Parameter beibehalten / umbenennen (Regex)",
            "definieren_sie_ausnahmen_für_p": "Definieren Sie Ausnahmen für Parameter, die trotz Aktivierung erhalten bleiben sollen. Die Reihenfolge bestimmt die Position im neuen Query-String.",
            "parameter_key_regex": "Parameter Key (Regex)",
            "value_matcher_optional_regex": "Value Matcher (Optional Regex)",
            "neuer_name_optional": "Neuer Name (Optional)",
            "beispiel_file_hinzufügen": "Beispiel (File) hinzufügen",
            "automatische_weiterleitung_für": "Automatische Weiterleitung für diese Regel",
            "wenn_aktiviert_werden_benutzer": "Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet.",
            "warnung_da_die_feedback_umfrag": "Warnung: Da die Feedback-Umfrage global aktiviert ist, erhält der Nutzer bei diesem Auto-Redirect keine Möglichkeit Feedback zu geben.",
            "wichtiger_hinweis": "Wichtiger Hinweis",
            "bestätigung_für_die_aktivierun": "Bestätigung für die Aktivierung der automatischen Weiterleitung",
            "sie_sind_dabei_die_automatisch": "Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet.",
            "wichtiger_hinweis_1": "Wichtiger Hinweis:",
            "bei_aktivierter_automatischer__1": "Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter",
            "beispiel": "Beispiel:",
            "ich_habe_verstanden": "Ich habe verstanden",
            "blockierte_ips_löschen_1": "Blockierte IPs löschen?",
            "dies_löscht_alle_derzeit_block": "Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden.",
            "diese_aktion_hebt_den_brute_fo": "Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf.",
            "backup_herunterladen_excel": "Backup herunterladen (Excel)",
            "bestätigung_erforderlich": "Bestätigung erforderlich",
            "blockierte_ips_verwalten": "Blockierte IPs verwalten",
            "hier_können_sie_aktuell_blocki": "Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten.",
            "blockieren": "Blockieren",
            "ip_adresse": "IP-Adresse",
            "fehlversuche": "Fehlversuche",
            "blockiert_bis": "Blockiert bis",
            "aktionen": "Aktionen",
            "lade": "Lade...",
            "keine_blockierten_ip_adressen": "Keine blockierten IP-Adressen.",
            "alle_statistiken_löschen_1": "Alle Statistiken löschen?",
            "dies_löscht_alle_erfassten_tra": "Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "wir_empfehlen_dringend_vor_dem": "Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.",
            "backup_herunterladen_csv": "Backup herunterladen (CSV)",
            "validierungswarnung": "Validierungswarnung",
            "möchten_sie_die_regel_trotz_de": "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?",
            "regeln_löschen": "Regeln löschen",
            "sind_sie_sicher_dass_sie_die_a": "Sind Sie sicher, dass Sie die ausgewählten",
            "löschen_möchten_diese_aktion_k": "löschen möchten?\n              Diese Aktion kann nicht rückgängig gemacht werden.",
            "hinweis": "Hinweis:",
            "es_werden_nur_die_auf_der_aktu": "Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht.",
            "validierungsfehler": "Validierungsfehler",
            "die_einstellungen_konnten_aufg": "Die Einstellungen konnten aufgrund folgender Fehler nicht gespeichert werden:",
            "verstanden": "Verstanden",
            "statistik_limitierung_ändern": "Statistik-Limitierung ändern?",
            "sie_ändern_das_limit_für_stati": "Sie ändern das Limit für Statistik-Einträge von",
            "auf": "auf",
            "wenn_aktuell_mehr_als": "Wenn aktuell mehr als",
            "einträge_vorhanden_sind_aktuel": "Einträge vorhanden sind (aktuell:",
            "werden_die_ältesten_einträge_b": "), werden die ältesten Einträge beim\n              Speichern",
            "unwiderruflich_gelöscht": "unwiderruflich gelöscht",
            "verstanden_speichern": "Verstanden & Speichern",
            "validierung_neu_laden": "Validierung neu laden?",
            "sie_haben_eine_regel_geändert_": "Sie haben eine Regel geändert. Möchten Sie die Konfigurationsvalidierung mit den neuen Einstellungen neu laden?",
            "nein": "Nein",
            "ja_neu_laden": "Ja, neu laden",
            "alle_regeln_löschen_1": "Alle Regeln löschen?",
            "dies_löscht_alle_vorhandenen_r": "Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "backup_herunterladen_json": "Backup herunterladen (JSON)",
            "administrator_passwort_eingebe": "Administrator-Passwort eingeben",
            "smart_redirect_service": "Smart Redirect Service",
            "ffffff": "#ffffff",
            "url_veraltet_aktualisierung_er": "URL veraltet - Aktualisierung erforderlich",
            "du_verwendest_einen_alten_link": "Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen.",
            "zeige_mir_die_neue_url": "Zeige mir die neue URL",
            "https_thisisthenewurl_com": "https://thisisthenewurl.com/",
            "https_newapp_com_q": "https://newapp.com/?q=",
            "file": "[?&]file=([^&]+)",
            "teams_regex": "/teams (Regex)",
            "fügt_eine_beispiel_regex_hinzu": "Fügt eine Beispiel-Regex hinzu",
            "proudly_brewed_with_generative": "Proudly brewed with Generative AI.",
            "war_die_neue_url_korrekt": "War die neue URL korrekt?",
            "dein_feedback_hilft_uns_die_we": "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
            "vielen_dank_für_deine_rückmeld": "Vielen Dank für deine Rückmeldung.",
            "ja_ok": "Ja, OK",
            "regeln_durchsuchen": "Regeln durchsuchen...",
            "regeln_durchsuchen_1": "Regeln durchsuchen",
            "einträge_suchen": "Einträge suchen...",
            "statistiken_durchsuchen": "Statistiken durchsuchen",
            "regel_filter": "Regel-Filter",
            "qualität": "Qualität",
            "feedback": "Feedback",
            "news_beitrag": "/news-beitrag",
            "nachrichtenbeiträge_wurden_mig": "Nachrichtenbeiträge wurden migriert...",
            "alte_seite": "/alte-seite",
            "neue_seite_leer_löschen": "/neue-seite (leer = löschen)",
            "source": "source",
            "migration": "migration",
            "nicht_kodieren_no_url_encoding": "Nicht kodieren (No URL Encoding)",
            "nach_oben": "Nach oben",
            "nach_unten": "Nach unten",
            "file_1": "file",
            "f": "f",
            "tippen_sie_delete_zur_bestätig": "Tippen Sie \"DELETE\" zur Bestätigung",
            "ip_adresse_z_b_192_168_1_1": "IP-Adresse (z.B. 192.168.1.1)",
            "erfolgreich_angemeldet": "Erfolgreich angemeldet",
            "willkommen_im_administrator_be": "Willkommen im Administrator-Bereich.",
            "anmeldung_fehlgeschlagen": "Anmeldung fehlgeschlagen",
            "regel_erstellt": "Regel erstellt",
            "die_url_regel_wurde_erfolgreic": "Die URL-Regel wurde erfolgreich erstellt.",
            "authentifizierung_erforderlich": "Authentifizierung erforderlich",
            "bitte_melden_sie_sich_erneut_a": "Bitte melden Sie sich erneut an.",
            "regel_aktualisiert": "Regel aktualisiert",
            "die_url_regel_wurde_erfolgreic_1": "Die URL-Regel wurde erfolgreich aktualisiert.",
            "regel_gelöscht": "Regel gelöscht",
            "1_regel_wurde_erfolgreich_gelö": "1 Regel wurde erfolgreich gelöscht.",
            "fehler_1": "Fehler",
            "die_regel_konnte_nicht_gelösch": "Die Regel konnte nicht gelöscht werden.",
            "alle_statistiken_gelöscht": "Alle Statistiken gelöscht",
            "alle_tracking_daten_wurden_erf": "Alle Tracking-Daten wurden erfolgreich gelöscht.",
            "blockierte_ips_gelöscht": "Blockierte IPs gelöscht",
            "alle_blockierten_ip_adressen_w": "Alle blockierten IP-Adressen wurden erfolgreich gelöscht.",
            "ip_blockiert": "IP blockiert",
            "die_ip_adresse_wurde_erfolgrei": "Die IP-Adresse wurde erfolgreich blockiert.",
            "ip_entsperrt": "IP entsperrt",
            "die_ip_adresse_wurde_erfolgrei_1": "Die IP-Adresse wurde erfolgreich entsperrt.",
            "teilweise_gelöscht": "Teilweise gelöscht",
            "regeln_gelöscht": "Regeln gelöscht",
            "fehler_beim_löschen": "Fehler beim Löschen",
            "fehler_beim_speichern": "Fehler beim Speichern",
            "import_erfolgreich": "Import erfolgreich",
            "die_einstellungen_wurden_erfol": "Die Einstellungen wurden erfolgreich importiert.",
            "import_fehlgeschlagen": "Import fehlgeschlagen",
            "die_einstellungen_konnten_nich": "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
            "die_url_regel_wurde_trotz_warn": "Die URL-Regel wurde trotz Warnung erfolgreich erstellt.",
            "die_regel_konnte_auch_mit_forc": "Die Regel konnte auch mit Force-Option nicht erstellt werden.",
            "die_url_regel_wurde_trotz_warn_1": "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert.",
            "die_regel_konnte_auch_mit_forc_1": "Die Regel konnte auch mit Force-Option nicht aktualisiert werden.",
            "keine_gültigen_regeln_ausgewäh": "Keine gültigen Regeln ausgewählt",
            "keine_der_ausgewählten_regeln_": "Keine der ausgewählten Regeln befinden sich auf der aktuellen Seite.",
            "warnung_ungültige_auswahl_erka": "Warnung: Ungültige Auswahl erkannt",
            "sicherheitsfehler": "Sicherheitsfehler",
            "export_erfolgreich": "Export erfolgreich",
            "export_fehlgeschlagen": "Export fehlgeschlagen",
            "die_daten_konnten_nicht_export": "Die Daten konnten nicht exportiert werden.",
            "einstellungen_gespeichert": "Einstellungen gespeichert",
            "die_allgemeinen_einstellungen_": "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert.",
            "erfolgreich_abgemeldet": "Erfolgreich abgemeldet",
            "sie_wurden_erfolgreich_abgemel": "Sie wurden erfolgreich abgemeldet.",
            "abmeldung_fehlgeschlagen": "Abmeldung fehlgeschlagen",
            "vorschau_fehlgeschlagen": "Vorschau fehlgeschlagen",
            "import_mit_validierungsfehlern": "Import mit Validierungsfehlern",
            "datei_zu_groß": "Datei zu groß",
            "die_import_datei_ist_zu_groß_b": "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei).",
            "cache_neu_aufgebaut": "Cache neu aufgebaut",
            "der_regel_cache_wurde_erfolgre": "Der Regel-Cache wurde erfolgreich neu erstellt.",
            "fehler_beim_cache_neuaufbau": "Fehler beim Cache-Neuaufbau",
            "alle_regeln_gelöscht": "Alle Regeln gelöscht",
            "alle_url_regeln_wurden_erfolgr": "Alle URL-Regeln wurden erfolgreich gelöscht.",
            "import_fehler": "Import Fehler",
            "konnte_die_vollständigen_daten": "Konnte die vollständigen Daten für den Import nicht laden.",
            "dateifehler": "Dateifehler",
            "die_import_datei_konnte_nicht_": "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
            "die_datei_darf_maximal_5mb_gro": "Die Datei darf maximal 5MB groß sein.",
            "logo_hochgeladen": "Logo hochgeladen",
            "das_header_logo_wurde_erfolgre": "Das Header-Logo wurde erfolgreich aktualisiert.",
            "fehler_beim_hochladen": "Fehler beim Hochladen",
            "das_logo_konnte_nicht_hochgela": "Das Logo konnte nicht hochgeladen werden.",
            "logo_entfernt": "Logo entfernt",
            "das_header_logo_wurde_erfolgre_1": "Das Header-Logo wurde erfolgreich entfernt.",
            "das_logo_konnte_nicht_entfernt": "Das Logo konnte nicht entfernt werden.",
            "die_globalen_regeln_wurden_erf": "Die globalen Regeln wurden erfolgreich aktualisiert.",
            "url_wird_analysiert": "URL wird analysiert...",
            "klicken_zum_kopieren": "Klicken zum Kopieren",
            "url_erfolgreich_in_die_zwische": "URL erfolgreich in die Zwischenablage kopiert!",
            "v": "v",
            "überspringen": "Überspringen",
            "neue_url_in_neuem_tab_öffnen": "Neue URL in neuem Tab öffnen",
            "kopieren_fehlgeschlagen": "Kopieren fehlgeschlagen",
            "bitte_kopieren_sie_die_url_man": "Bitte kopieren Sie die URL manuell.",
            "404_page_not_found": "404 Page Not Found",
            "did_you_forget_to_add_the_page": "Did you forget to add the page to the router?",
            "globale_regeln": "Globale Regeln",
            "diese_regeln_werden_auf_alle_w": "Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).\n                    Spezifische Regeln überschreiben diese globalen Einstellungen.",
            "globales_suchen_ersetzen": "Globales Suchen & Ersetzen",
            "ersetzen_sie_text_in_der_ziel_": "Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.",
            "reihenfolge_global_hier_rarr_r": "Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.",
            "globale_statische_parameter": "Globale Statische Parameter",
            "parameter_die_immer_angehängt_": "Parameter, die immer angehängt werden (z.B. ?source=migration).",
            "wenn_eine_regel_denselben_para": "Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.",
            "globale_parameter_übernahme_wh": "Globale Parameter-Übernahme (Whitelist)",
            "parameter_die_bei_aktivierter_": "Parameter, die bei aktivierter \"Parameter entfernen\" Option (in einer Regel) trotzdem behalten werden.",
            "wird_zusätzlich_zu_den_regel_s": "Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.",
            "key_pattern_regex": "Key Pattern (Regex)",
            "value_pattern_opt": "Value Pattern (Opt.)",
            "neuer_name_opt": "Neuer Name (Opt.)",
            "beispiel_file": "Beispiel (file)",
            "alte_pfade": "/alte-pfade",
            "neue_pfade": "/neue-pfade",
            "utm_source": "utm_source",
            "migration_tool": "migration_tool",
            "nicht_kodieren_raw": "Nicht kodieren (Raw)",
            "id_lang": "id|lang",
            "new_id": "new_id",
            "query_parameters": "Query Parameters",
            "mode": "Mode:",
            "kept_params_exceptions": "Kept Params (Exceptions):",
            "rarr": "&rarr;",
            "static_params_appended": "Static Params (Appended):",
            "search_replace_1": "Search & Replace",
            "case_sensitive": "Case Sensitive",
            "keine_suchen_ersetzen_regeln": "Keine Suchen & Ersetzen Regeln.",
            "info_beschreibung": "Info / Beschreibung",
            "status": "Status",
            "ziel_url": "Ziel-URL",
            "typ": "Typ",
            "auto_1": "Auto",
            "erstellt_am": "Erstellt am",
            "das_auswählen_und_löschen_mehr": "Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.",
            "params_entfernen": "Params Entfernen",
            "params_behalten": "Params Behalten",
            "regel_löschen": "Regel löschen",
            "sind_sie_sicher_dass_sie_diese": "Sind Sie sicher, dass Sie diese Regel löschen möchten?\n                      Diese Aktion kann nicht rückgängig gemacht werden.",
            "ziel_url_1": "Ziel-URL:",
            "automatisch_generiert": "Automatisch generiert",
            "info_text": "Info-Text:",
            "erstellt": "Erstellt:",
            "bearbeiten": "Bearbeiten",
            "regel_bearbeiten": "Regel bearbeiten",
            "expand_all": "Expand All",
            "collapse_all": "Collapse All",
            "erstellt_1": "Erstellt",
            "action": "Action",
            "on": "On",
            "sind_sie_sicher": "Sind Sie sicher?",
            "parameter_konfiguration": "Parameter Konfiguration",
            "handling_mode": "Handling Mode:",
            "ausnahmen_kept": "Ausnahmen (Kept):",
            "statische_parameter": "Statische Parameter:",
            "keine": "Keine.",
            "alle_regeln_auf_dieser_seite_a": "Alle Regeln auf dieser Seite auswählen/abwählen",
            "nicht_genügend_daten_für_trend": "Nicht genügend Daten für Trendanzeige",
            "match_quality": "Match Quality",
            "feedback_inkl_auto": "Feedback (inkl. Auto)",
            "match": "Match:",
            "score": "Score:",
            "total": "Total:",
            "ok_1": "(OK:",
            "auto_2": ", Auto:",
            "nok_1": ", NOK:",
            "spalten_anpassen": "Spalten anpassen",
            "spalten_auswählen": "Spalten auswählen",
            "zeitstempel": "Zeitstempel",
            "alte_url": "Alte URL",
            "neue_url": "Neue URL",
            "pfad": "Pfad",
            "referrer": "Referrer",
            "regel": "Regel",
            "n_a": "N/A",
            "smart_search": "Smart Search",
            "domain_redirect": "Domain Redirect",
            "regel_nicht_mehr_vorhanden": "Regel nicht mehr vorhanden",
            "gelöscht": "Gelöscht",
            "api_1": "API",
            "vorschlag": "Vorschlag:",
            "intelligente_suche_fallback": "Intelligente Suche (Fallback)",
            "standard_domain_weiterleitung_": "Standard Domain-Weiterleitung (Fallback)",
            "api_call": "API Call",
            "übersetzungen_für_die_anwendun": "Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.",
            "speichern": "Speichern",
            "schlüssel_key": "Schlüssel (Key)",
            "wert_value": "Wert (Value)",
            "sprache_auswählen": "Sprache auswählen",
            "neuer_schlüssel": "Neuer Schlüssel...",
            "wert": "Wert...",
            "erfolg": "Erfolg",
            "übersetzungen_gespeichert": "Übersetzungen gespeichert.",
            "konnte_übersetzungen_nicht_spe": "Konnte Übersetzungen nicht speichern.",
            "old": "Old:",
            "new": "New:",
            "ergebnis_analyse": "Ergebnis-Analyse",
            "original": "Original:",
            "smart_search_fallback": "Smart Search Fallback:",
            "weiterleitung_zur_suche_da_kei": "Weiterleitung zur Suche, da keine Regel passte.",
            "angewandte_regel": "Angewandte Regel",
            "id_1": "ID:",
            "matcher_1": "Matcher:",
            "ziel": "Ziel:",
            "typ_1": "Typ:",
            "parameter_werden_verworfen": "Parameter werden verworfen",
            "keine_spezifische_regel_gefund": "Keine spezifische Regel gefunden (Fallback).",
            "angewandte_globale_regeln": "Angewandte Globale Regeln",
            "keine_globalen_regeln_angewend": "Keine globalen Regeln angewendet",
            "verarbeitungsschritte": "Verarbeitungsschritte",
            "testen_sie_ihre_regeln_mit_ein": "Testen Sie Ihre Regeln mit einer Liste von URLs. Importieren Sie eine CSV/Excel-Datei oder fügen Sie URLs ein.",
            "text_einfügen": "Text einfügen",
            "datei_hochladen": "Datei hochladen",
            "urls_einfügen_durch_komma_semi": "URLs einfügen (durch Komma, Semikolon oder neue Zeile getrennt)",
            "leerzeichen_nach_trennzeichen_": "Leerzeichen nach Trennzeichen werden automatisch entfernt.",
            "unterstützt_csv_xlsx_xls_nur_e": "Unterstützt CSV, XLSX, XLS (nur erste Spalte wird verwendet)",
            "ausgewählt": "Ausgewählt",
            "hinweis_1": "Hinweis",
            "verarbeite_urls": "Verarbeite URLs...",
            "ergebnisse": "Ergebnisse",
            "neu_berechnen": "Neu berechnen",
            "csv_export": "CSV Export",
            "neue_suche": "Neue Suche",
            "url_transformation": "URL Transformation",
            "rule_tag": "Rule Tag",
            "validierung_starten": "Validierung starten",
            "https_example_com_a_10_https_e": "https://example.com/a&#10;https://example.com/b",
            "alle_ausklappen": "Alle ausklappen",
            "alle_einklappen": "Alle einklappen",
            "keine_daten_zum_aktualisieren": "Keine Daten zum Aktualisieren",
            "bitte_starten_sie_den_prozess_": "Bitte starten Sie den Prozess neu.",
            "close": "Close",
            "bitte_geben_sie_das_administra_1": "Bitte geben Sie das Administrator-Passwort ein:",
            "passwort_eingeben": "Passwort eingeben",
            "link_qualität": "Link-Qualität:"
      },
      "es": {
            "incorrect_password_please_try_": "Contraseña incorrecta. Por favor inténtalo de nuevo.",
            "please_enter_the_administrator": "Por favor ingrese la contraseña de administrador.",
            "enter_password": "Introduce la contraseña",
            "incorrect_password": "Contraseña incorrecta",
            "password": "contraseña",
            "enter_administrator_password": "Introduzca la contraseña de administrador",
            "administrator_login": "Inicio de sesión de administrador",
            "welcome_to_the_admin_area": "Bienvenido al área de administración.",
            "open_administrator_area": "Abrir área de administrador",
            "loading_app": "",
            "admin_area": "",
            "lang": "Lang",
            "showing": "Showing",
            "of": "of",
            "entries": "entries",
            "performance": "Performance",
            "memory": "Memory:",
            "performance_monitor": "Performance Monitor",
            "overview": "Overview",
            "loading": "Loading",
            "memory_1": "Memory",
            "issues_detected": "Issues Detected:",
            "dom": "DOM:",
            "load": "Load:",
            "heap": "Heap:",
            "dom_ready": "DOM Ready:",
            "load_complete": "Load Complete:",
            "first_paint": "First Paint:",
            "dns_lookup": "DNS Lookup:",
            "tcp_connect": "TCP Connect:",
            "server_response": "Server Response:",
            "resources": "Resources:",
            "slow_resources": "Slow Resources:",
            "js_size": "JS Size:",
            "css_size": "CSS Size:",
            "loading_performance_data": "Loading performance data...",
            "used_heap": "Used Heap:",
            "total_heap": "Total Heap:",
            "heap_limit": "Heap Limit:",
            "usage": "Usage:",
            "memory_data_not_available": "Memory data not available",
            "administrator_anmeldung": "Administrator-Anmeldung",
            "bitte_geben_sie_das_administra": "Bitte geben Sie das Administrator-Passwort ein.",
            "passwort": "Passwort",
            "abbrechen": "Abbrechen",
            "überprüfe_authentifizierung": "Überprüfe Authentifizierung...",
            "administrator_bereich": "Administrator-Bereich",
            "admin": "Admin",
            "schließen": "Schließen",
            "allgemein": "Allgemein",
            "regeln": "Regeln",
            "global": "Global",
            "statistiken": "Statistiken",
            "system_daten": "System & Daten",
            "sprachen": "Sprachen",
            "allgemeine_einstellungen": "Allgemeine Einstellungen",
            "hier_können_sie_alle_texte_der": "Hier können Sie alle Texte der Anwendung anpassen.",
            "bitte_melden_sie_sich_an_auth": "Bitte melden Sie sich an... (Auth:",
            "lade_einstellungen_auth": "Lade Einstellungen... (Auth:",
            "loading_1": ", Loading:",
            "header_einstellungen": "Header-Einstellungen",
            "anpassung_des_oberen_bereichs_": "Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt",
            "titel": "Titel",
            "wird_als_haupttitel_im_header_": "Wird als Haupttitel im Header der Anwendung angezeigt",
            "icon": "Icon",
            "kein_icon": "🚫 Kein Icon",
            "pfeil_wechsel": "🔄 Pfeil Wechsel",
            "warnung": "⚠️ Warnung",
            "fehler": "❌ Fehler",
            "alert": "⭕ Alert",
            "ℹ_info": "ℹ️ Info",
            "lesezeichen": "🔖 Lesezeichen",
            "teilen": "📤 Teilen",
            "zeit": "⏰ Zeit",
            "häkchen": "✅ Häkchen",
            "stern": "⭐ Stern",
            "herz": "❤️ Herz",
            "glocke": "🔔 Glocke",
            "hintergrundfarbe": "Hintergrundfarbe",
            "logo_hochladen": "Logo hochladen",
            "empfehlung": "Empfehlung:",
            "png_mit_transparentem_hintergr": "PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)",
            "funktion": "Funktion:",
            "wenn_ein_logo_hochgeladen_wird": "Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt.",
            "aktuelles_logo": "Aktuelles Logo:",
            "löschen": "Löschen",
            "logo_aktiv_wird_anstelle_des_i": "Logo aktiv - wird anstelle des Icons angezeigt",
            "interaktionen": "Interaktionen",
            "steuern_sie_die_interaktionsmö": "Steuern Sie die Interaktionsmöglichkeiten auf der Migrationsseite",
            "kopier_button_anzeigen": "Kopier-Button anzeigen",
            "blendet_den_button_zum_kopiere": "Blendet den Button zum Kopieren der URL ein/aus",
            "öffnen_button_anzeigen": "Öffnen-Button anzeigen",
            "blendet_den_button_zum_öffnen_": "Blendet den Button zum Öffnen im neuen Tab ein/aus",
            "verhalten_bei_klick_auf_url_fe": "Verhalten bei Klick auf URL-Feld",
            "kopieren_standard": "Kopieren (Standard)",
            "in_neuem_tab_öffnen": "In neuem Tab öffnen",
            "keine_aktion": "Keine Aktion",
            "definiert_was_passiert_wenn_de": "Definiert was passiert, wenn der Nutzer direkt auf das Feld mit der neuen URL klickt.",
            "button_text_url_kopieren": "Button-Text \"URL kopieren\"",
            "button_text_in_neuem_tab_öffne": "Button-Text \"In neuem Tab öffnen\"",
            "popup_einstellungen": "PopUp-Einstellungen",
            "dialog_fenster_das_automatisch": "Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft",
            "popup_anzeige": "PopUp-Anzeige",
            "aktiv": "Aktiv",
            "inline": "Inline",
            "deaktiviert": "Deaktiviert",
            "beschreibung": "Beschreibung",
            "erklärt_dem_nutzer_die_situati": "Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte",
            "popup_button_text": "PopUp Button-Text",
            "text_für_den_button_der_das_po": "Text für den Button der das PopUp-Fenster öffnet",
            "alert_hintergrundfarbe": "Alert-Hintergrundfarbe",
            "gelb": "🟡 Gelb",
            "rot": "🔴 Rot",
            "orange": "🟠 Orange",
            "blau": "🔵 Blau",
            "grau": "⚫ Grau",
            "hauptinhalt_hintergrundfarbe": "Hauptinhalt-Hintergrundfarbe",
            "routing_fallback_verhalten": "Routing & Fallback-Verhalten",
            "konfiguration_des_verhaltens_b": "Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung",
            "ziel_domain_standard_neue_doma": "Ziel-Domain (Standard neue Domain)",
            "verwendet_für_partial_matches_": "Verwendet für Partial Matches und spezifische Regeln.",
            "fallback_strategie": "Fallback-Strategie",
            "einfacher_domain_austausch": "Einfacher Domain-Austausch",
            "standard_verhalten_ersetzt_die": "Standard-Verhalten: Ersetzt die alte Domain durch die neue \"Target Domain\". Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt.",
            "intelligente_such_weiterleitun": "Intelligente Such-Weiterleitung",
            "intelligenter_fallback_leitet_": "Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite.",
            "definiert_was_passiert_wenn_ke": "Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift.",
            "such_basis_url": "Such-Basis-URL",
            "beispiel_https_newapp_com_q": "Beispiel: https://newapp.com/?q=",
            "nicht_kodieren": "Nicht kodieren",
            "extraktions_regeln_regex": "Extraktions-Regeln (Regex)",
            "regex_pattern_extraction_optio": "Regex Pattern (Extraction - optional)",
            "path_matcher_prefix": "Path Matcher (Prefix)",
            "custom_search_base_url_optiona": "Custom Search Base URL (Optional)",
            "suchbegriff_nicht_kodieren_no_": "Suchbegriff nicht kodieren (No URL Encoding)",
            "regel_hinzufügen": "Regel hinzufügen",
            "beispiel_hinzufügen": "Beispiel hinzufügen",
            "definieren_sie_eine_liste_von_": "Definieren Sie eine Liste von Regeln. Die Regeln werden von oben nach unten geprüft.\n                                    Wenn Sie ein Regex-Pattern definieren, muss es eine Capture Group () enthalten.",
            "lassen_sie_das_feld_regex_patt": "Lassen Sie das Feld \"Regex Pattern\" leer, um automatisch das letzte Pfadsegment zu verwenden.",
            "wenn_keine_regel_greift_wird_a": "Wenn keine Regel greift, wird als Fallback ebenfalls das letzte Pfadsegment verwendet.",
            "fallback_info_nachrichten": "Fallback-Info-Nachrichten",
            "spezielle_hinweise_titel": "Spezielle Hinweise - Titel",
            "spezielle_hinweise_icon": "Spezielle Hinweise - Icon",
            "standard_info_text_beschreibun": "Standard Info Text (Beschreibung)",
            "angezeigt_wenn_eine_regel_matc": "Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat.",
            "smart_search_nachricht": "Smart Search Nachricht",
            "angezeigt_nur_wenn_intelligent": "Angezeigt NUR wenn \"Intelligente Such-Weiterleitung\" ausgelöst wird (keine Regel matched).",
            "visualisierung": "Visualisierung",
            "label_für_alte_url": "Label für alte URL",
            "label_für_neue_url": "Label für neue URL",
            "link_qualitätstacho_anzeigen": "Link-Qualitätstacho anzeigen",
            "text_für_hohe_übereinstimmung_": "Text für hohe Übereinstimmung (100%)",
            "text_für_mittlere_übereinstimm": "Text für mittlere Übereinstimmung (75%)",
            "text_für_geringe_übereinstimmu": "Text für geringe Übereinstimmung (50%)",
            "text_für_startseiten_treffer_1": "Text für Startseiten-Treffer (100%)",
            "text_für_keine_übereinstimmung": "Text für keine Übereinstimmung (0%)",
            "zusätzliche_informationen": "Zusätzliche Informationen",
            "wird_nur_angezeigt_wenn_mindes": "Wird nur angezeigt wenn mindestens ein Info-Punkt konfiguriert ist",
            "titel_der_sektion": "Titel der Sektion",
            "überschrift_für_den_bereich_mi": "Überschrift für den Bereich mit zusätzlichen Informationen",
            "icon_für_den_titel": "Icon für den Titel",
            "informations_punkte": "Informations-Punkte",
            "liste_von_stichpunkten_die_unt": "Liste von Stichpunkten die unter dem Info-Text angezeigt werden",
            "hinzufügen": "Hinzufügen",
            "bookmark": "🔖 Bookmark",
            "share": "📤 Share",
            "clock": "⏰ Clock",
            "check": "✅ Check",
            "star": "⭐ Star",
            "heart": "❤️ Heart",
            "bell": "🔔 Bell",
            "keine_info_punkte_vorhanden_kl": "Keine Info-Punkte vorhanden. Klicken Sie \"Hinzufügen\" um welche zu erstellen.",
            "footer": "Footer",
            "copyright_und_fußzeile_der_anw": "Copyright und Fußzeile der Anwendung",
            "copyright_text": "Copyright-Text",
            "link_erkennung_leistung": "Link-Erkennung & Leistung",
            "einstellungen_zur_erkennungslo": "Einstellungen zur Erkennungslogik und Systemleistung",
            "groß_kleinschreibung_beachten": "Groß-/Kleinschreibung beachten",
            "wenn_aktiviert_werden_regeln_n": "Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert.",
            "referrer_tracking_aktivieren": "Referrer Tracking aktivieren",
            "erfasst_die_herkunfts_url_refe": "Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen.",
            "tracking_cache_aktivieren_ram": "Tracking-Cache aktivieren (RAM)",
            "speichert_statistik_daten_im_a": "Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten.",
            "max_statistik_einträge": "Max. Statistik-Einträge",
            "begrenzt_die_anzahl_der_gespei": "Begrenzt die Anzahl der gespeicherten Statistik-Einträge in der tracking.json. Älteste Einträge werden bei Überschreitung gelöscht. (0 = Unbegrenzt)",
            "lassen_sie_den_tracking_cache_": "Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (&lt; 512MB) oder Sie haben extrem viele Tracking-Daten (&gt; 1 Mio. Einträge).",
            "automatische_weiterleitung": "Automatische Weiterleitung",
            "globale_einstellungen_für_auto": "Globale Einstellungen für automatische Weiterleitungen",
            "automatische_weiterleitung_akt": "Automatische Weiterleitung aktivieren",
            "wenn_aktiviert_werden_alle_ben": "Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen.",
            "hinweis_feedback_umfrage_wird_": "Hinweis: Feedback-Umfrage wird deaktiviert, da keine Interaktion stattfindet (Auto-Redirect wird als Feedback geloggt).",
            "admin_zugriff": "Admin-Zugriff:",
            "bei_aktivierter_automatischer_": "Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter",
            "admin_true": "?admin=true",
            "erreichen": "erreichen.",
            "benutzer_feedback_umfrage": "Benutzer-Feedback-Umfrage",
            "erfassen_sie_feedback_von_nutz": "Erfassen Sie Feedback von Nutzern zur Qualität der Weiterleitung",
            "feedback_umfrage_aktivieren": "Feedback-Umfrage aktivieren",
            "zeigt_ein_popup_an_wenn_nutzer": "Zeigt ein Popup an, wenn Nutzer auf \"Kopieren\" oder \"Öffnen\" klicken, um zu fragen, ob der Link funktioniert hat.",
            "trend_anzeige": "Trend-Anzeige",
            "konfiguration_für_den_redirect": "Konfiguration für den \"Redirect Satisfaction Trend\"",
            "zeitraum_tage": "Zeitraum (Tage)",
            "nur_feedback_ok_nok_anzeigen": "Nur Feedback (OK/NOK) anzeigen",
            "berechnet_den_score_ausschließ": "Berechnet den Score ausschließlich basierend auf Benutzer-Feedback, ignoriert automatische Match-Qualität.",
            "umfrage_titel": "Umfrage Titel",
            "umfrage_frage": "Umfrage Frage",
            "erfolgsmeldung": "Erfolgsmeldung",
            "button_ja_ok": "Button Ja (OK)",
            "text_auf_dem_button_für_positi": "Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)",
            "button_nein_nok": "Button Nein (NOK)",
            "text_auf_dem_button_für_negati": "Text auf dem Button für negative Rückmeldung (Standard: Nein)",
            "such_vorschlag_bei_nein_aktivi": "Such-Vorschlag bei \"Nein\" aktivieren",
            "zeigt_dem_nutzer_einen_link_zu": "Zeigt dem Nutzer einen Link zur intelligenten Suche an, wenn die Bewertung negativ ausfällt. (Erfordert aktive \"Intelligente Such-Weiterleitung\")",
            "nur_verfügbar_wenn_intelligent": "* Nur verfügbar wenn \"Intelligente Such-Weiterleitung\" als Fallback-Strategie gewählt ist.",
            "vorschlag_titel": "Vorschlag Titel",
            "vorschlag_beschreibung": "Vorschlag Beschreibung",
            "vorschlag_frage": "Vorschlag Frage",
            "kommentar_funktion_bei_nein_ak": "Kommentar-Funktion bei \"Nein\" aktivieren",
            "fragt_den_nutzer_nach_der_korr": "Fragt den Nutzer nach der korrekten URL, wenn die Bewertung negativ ausfällt (oder nachdem die Suche erfolglos war).",
            "kommentar_titel": "Kommentar Titel",
            "kommentar_beschreibung": "Kommentar Beschreibung",
            "platzhalter": "Platzhalter",
            "button_text": "Button Text",
            "speichern_sie_ihre_änderungen_": "Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.",
            "url_transformationsregeln": "URL-Transformationsregeln",
            "verwalten_sie_url_transformati": "Verwalten Sie URL-Transformations-Regeln für die Migration.",
            "löschen_1": "löschen",
            "konfigurationsvalidierung": "Konfigurationsvalidierung",
            "neue_regel": "Neue Regel",
            "suche": "Suche...",
            "seite": "Seite",
            "von": "von",
            "lade_regeln": "Lade Regeln...",
            "keine_regeln_für": "Keine Regeln für \"",
            "gefunden": "\" gefunden.",
            "versuchen_sie_einen_anderen_su": "Versuchen Sie einen anderen Suchbegriff oder erstellen Sie eine neue Regel.",
            "erste": "Erste",
            "vorherige": "Vorherige",
            "zeige": "Zeige",
            "nächste": "Nächste",
            "letzte": "Letzte",
            "overall": "Overall",
            "alle_einträge": "Alle Einträge",
            "letzte_24h": "Letzte 24h",
            "letzte_7_tage": "Letzte 7 Tage",
            "alle_zeit": "Alle Zeit",
            "nur_mit_regeln": "Nur mit Regeln",
            "nur_ohne_regeln": "Nur ohne Regeln",
            "alle_qualitäten": "Alle Qualitäten",
            "100_exakt": "100% (Exakt)",
            "75_fast_exakt": "75% (Fast exakt)",
            "50_teilweise": "50% (Teilweise)",
            "0_kein_treffer": "0% (Kein Treffer)",
            "alle_feedbacks": "Alle Feedbacks",
            "ok": "👍 OK",
            "nok": "👎 NOK",
            "auto": "⚡ Auto",
            "api": "🤖 API",
            "kein_feedback": "Kein Feedback",
            "gesamte_weiterleitungen": "Gesamte Weiterleitungen",
            "heute": "Heute",
            "exakte_trefferquote": "Exakte Trefferquote",
            "redirect_satisfaction_trend": "Redirect Satisfaction Trend",
            "entwicklung_der_qualität_und_n": "Entwicklung der Qualität und Nutzerzufriedenheit über die letzten",
            "tage": "Tage.",
            "täglich": "Täglich",
            "wöchentlich": "Wöchentlich",
            "monatlich": "Monatlich",
            "lade_trend": "Lade Trend...",
            "link_quality": "Link Quality",
            "qualitätsverteilung_der_link_m": "Qualitätsverteilung der Link-Matches",
            "lade_statistiken": "Lade Statistiken...",
            "exakter_treffer_100": "Exakter Treffer (100%)",
            "hoher_treffer_75": "Hoher Treffer (75%)",
            "mittlerer_treffer_50": "Mittlerer Treffer (50%)",
            "kein_treffer_0": "Kein Treffer (0%)",
            "nutzer_feedback": "Nutzer-Feedback",
            "rückmeldungen_zu_weiterleitung": "Rückmeldungen zu Weiterleitungen",
            "auto_redirect": "Auto-Redirect",
            "top_urls": "Top URLs",
            "lade_urls": "Lade URLs...",
            "keine_url_aufrufe_vorhanden": "Keine URL-Aufrufe vorhanden.",
            "url_pfad": "URL-Pfad",
            "aufrufe": "Aufrufe",
            "anteil": "Anteil",
            "top_referrer": "Top Referrer",
            "lade_referrer": "Lade Referrer...",
            "keine_referrer_daten_vorhanden": "Keine Referrer-Daten vorhanden.",
            "domain": "Domain",
            "anzahl": "Anzahl",
            "alle_tracking_einträge": "Alle Tracking-Einträge",
            "lade_einträge": "Lade Einträge...",
            "standard_import_export_excel_c": "Standard Import / Export (Excel, CSV)",
            "benutzerfreundlicher_import_un": "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV.\n                        Mit Vorschau-Funktion vor dem Import.",
            "regeln_importieren": "Regeln Importieren",
            "laden_sie_eine_excel_oder_csv_": "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:",
            "matcher": "Matcher",
            "pflicht_z_b_alte_seite": "(Pflicht) - z.B. /alte-seite",
            "target_url": "Target URL",
            "pflicht_z_b_https_neue_seite_d": "(Pflicht) - z.B. https://neue-seite.de",
            "type": "Type",
            "pflicht_partial_wildcard_oder_": "(Pflicht) - 'partial', 'wildcard' oder 'domain'",
            "info": "Info",
            "optional_beschreibung": "(Optional) - Beschreibung",
            "auto_redirect_1": "Auto Redirect",
            "optional_true_false": "(Optional) - 'true'/'false'",
            "discard_query_params": "Discard Query Params",
            "keep_query_params": "Keep Query Params",
            "static_query_params": "Static Query Params",
            "optional_json_array": "(Optional) - JSON Array",
            "search_replace": "Search Replace",
            "id": "ID",
            "optional_nur_für_updates_beste": "(Optional) - Nur für Updates bestehender Regeln",
            "musterdatei_excel": "Musterdatei (Excel)",
            "musterdatei_csv": "Musterdatei (CSV)",
            "analysiere_datei": "Analysiere Datei...",
            "klicken_zum_auswählen": "Klicken zum Auswählen",
            "oder_datei_hierher_ziehen": "oder Datei hierher ziehen",
            "excel_xlsx_oder_csv": "Excel (.xlsx) oder CSV",
            "urls_automatisch_kodieren": "URLs automatisch kodieren",
            "sonderzeichen_in_urls_automati": "Sonderzeichen in URLs automatisch konvertieren (encodeURI)",
            "regeln_exportieren": "Regeln Exportieren",
            "exportieren_sie_alle_regeln_zu": "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup.\n                                Die Dateien können später wieder importiert werden.",
            "herunterladen_excel": "Herunterladen (Excel)",
            "herunterladen_csv": "Herunterladen (CSV)",
            "erweiterter_regel_import_expor": "Erweiterter Regel-Import/Export",
            "für_fortgeschrittene_benutzer_": "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau.",
            "regel_rohdaten_json": "Regel-Rohdaten (JSON)",
            "herunterladen_json": "Herunterladen (JSON)",
            "importieren_json": "Importieren (JSON)",
            "musterdatei_json": "Musterdatei (JSON)",
            "warnung_1": "Warnung:",
            "keine_vorschau_überschreibt_be": "Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort.",
            "system_statistiken": "System & Statistiken",
            "verwaltung_von_systemeinstellu": "Verwaltung von Systemeinstellungen und Statistiken.",
            "system_einstellungen": "System-Einstellungen",
            "exportieren_sie_die_komplette_": "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen.",
            "exportieren_sie_die_tracking_l": "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse.",
            "gefahrenzone": "Gefahrenzone!",
            "cache_wartung": "Cache Wartung",
            "nur_bei_problemen_mit_der_rege": "Nur bei Problemen mit der Regelerkennung notwendig.",
            "sicherheit": "Sicherheit",
            "blockierte_ips_anzeigen_und_ve": "Blockierte IPs anzeigen und verwalten",
            "liste_der_blockierten_ips_eins": "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren.",
            "destruktive_aktionen": "Destruktive Aktionen",
            "alle_regeln_löschen": "Alle Regeln löschen",
            "löscht_alle_vorhandenen_weiter": "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich.",
            "alle_statistiken_löschen": "Alle Statistiken löschen",
            "löscht_alle_erfassten_tracking": "Löscht alle erfassten Tracking-Daten unwiderruflich.",
            "blockierte_ips_löschen": "Blockierte IPs löschen",
            "löscht_alle_blockierten_ip_adr": "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff.",
            "import_vorschau": "Import Vorschau",
            "überprüfen_sie_die_zu_importie": "Überprüfen Sie die zu importierenden Regeln.",
            "neu": "Neu:",
            "update": "Update:",
            "ungültig": "Ungültig:",
            "filter_löschen": "Filter löschen",
            "gesamt": "(Gesamt:",
            "mehr_laden_100": "Mehr laden (+100)",
            "url_pfad_matcher": "URL-Pfad Matcher",
            "ziel_url_optional": "Ziel-URL (optional)",
            "redirect_typ": "Redirect-Typ",
            "teilweise": "Teilweise",
            "nur_die_pfadsegmente_ab_dem_ma": "Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.",
            "vollständig": "Vollständig",
            "alte_links_werden_komplett_auf": "Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.",
            "domain_ersatz": "Domain-Ersatz",
            "ersetzt_nur_die_domain_host_de": "Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Wenn eine Ziel-URL angegeben ist, wird deren Domain verwendet.",
            "der_matcher_kann_hier_auch_ein": "Der Matcher kann hier auch eine Domain sein (z.B. \"www.alteseite.ch\"). Bei Verwendung eines Pfad-Matchers (\"/news\") mit diesem Typ wird nur die Domain ersetzt, während der Pfad erhalten bleibt.",
            "info_text_markdown": "Info-Text (Markdown)",
            "suchen_ersetzen": "Suchen & Ersetzen",
            "ersetzen_sie_teile_der_url_pfa": "Ersetzen Sie Teile der URL (Pfad oder Parameter) vor der Weiterleitung.",
            "suchen": "Suchen",
            "ersetzen": "Ersetzen",
            "aa": "Aa",
            "ersetzung_hinzufügen": "Ersetzung hinzufügen",
            "statische_parameter_hinzufügen": "Statische Parameter hinzufügen",
            "definieren_sie_parameter_die_i": "Definieren Sie Parameter, die immer an die Ziel-URL angehängt werden (z.B. ?source=migration).",
            "key": "Key",
            "value": "Value",
            "raw": "Raw",
            "parameter_hinzufügen": "Parameter hinzufügen",
            "alle_link_parameter_entfernen": "Alle Link-Parameter entfernen",
            "wenn_aktiviert_werden_alle_que": "Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten).",
            "alle_link_parameter_beibehalte": "Alle Link-Parameter beibehalten",
            "wenn_aktiviert_werden_die_ursp": "Wenn aktiviert, werden die ursprünglichen Query-Parameter 1:1 an die Ziel-URL angehängt.\n                      Deaktivieren Sie dies, um spezifische Parameter auszuwählen oder umzubenennen.",
            "parameter_beibehalten_umbenenn": "Parameter beibehalten / umbenennen (Regex)",
            "definieren_sie_ausnahmen_für_p": "Definieren Sie Ausnahmen für Parameter, die trotz Aktivierung erhalten bleiben sollen. Die Reihenfolge bestimmt die Position im neuen Query-String.",
            "parameter_key_regex": "Parameter Key (Regex)",
            "value_matcher_optional_regex": "Value Matcher (Optional Regex)",
            "neuer_name_optional": "Neuer Name (Optional)",
            "beispiel_file_hinzufügen": "Beispiel (File) hinzufügen",
            "automatische_weiterleitung_für": "Automatische Weiterleitung für diese Regel",
            "wenn_aktiviert_werden_benutzer": "Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet.",
            "warnung_da_die_feedback_umfrag": "Warnung: Da die Feedback-Umfrage global aktiviert ist, erhält der Nutzer bei diesem Auto-Redirect keine Möglichkeit Feedback zu geben.",
            "wichtiger_hinweis": "Wichtiger Hinweis",
            "bestätigung_für_die_aktivierun": "Bestätigung für die Aktivierung der automatischen Weiterleitung",
            "sie_sind_dabei_die_automatisch": "Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet.",
            "wichtiger_hinweis_1": "Wichtiger Hinweis:",
            "bei_aktivierter_automatischer__1": "Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter",
            "beispiel": "Beispiel:",
            "ich_habe_verstanden": "Ich habe verstanden",
            "blockierte_ips_löschen_1": "Blockierte IPs löschen?",
            "dies_löscht_alle_derzeit_block": "Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden.",
            "diese_aktion_hebt_den_brute_fo": "Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf.",
            "backup_herunterladen_excel": "Backup herunterladen (Excel)",
            "bestätigung_erforderlich": "Bestätigung erforderlich",
            "blockierte_ips_verwalten": "Blockierte IPs verwalten",
            "hier_können_sie_aktuell_blocki": "Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten.",
            "blockieren": "Blockieren",
            "ip_adresse": "IP-Adresse",
            "fehlversuche": "Fehlversuche",
            "blockiert_bis": "Blockiert bis",
            "aktionen": "Aktionen",
            "lade": "Lade...",
            "keine_blockierten_ip_adressen": "Keine blockierten IP-Adressen.",
            "alle_statistiken_löschen_1": "Alle Statistiken löschen?",
            "dies_löscht_alle_erfassten_tra": "Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "wir_empfehlen_dringend_vor_dem": "Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.",
            "backup_herunterladen_csv": "Backup herunterladen (CSV)",
            "validierungswarnung": "Validierungswarnung",
            "möchten_sie_die_regel_trotz_de": "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?",
            "regeln_löschen": "Regeln löschen",
            "sind_sie_sicher_dass_sie_die_a": "Sind Sie sicher, dass Sie die ausgewählten",
            "löschen_möchten_diese_aktion_k": "löschen möchten?\n              Diese Aktion kann nicht rückgängig gemacht werden.",
            "hinweis": "Hinweis:",
            "es_werden_nur_die_auf_der_aktu": "Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht.",
            "validierungsfehler": "Validierungsfehler",
            "die_einstellungen_konnten_aufg": "Die Einstellungen konnten aufgrund folgender Fehler nicht gespeichert werden:",
            "verstanden": "Verstanden",
            "statistik_limitierung_ändern": "Statistik-Limitierung ändern?",
            "sie_ändern_das_limit_für_stati": "Sie ändern das Limit für Statistik-Einträge von",
            "auf": "auf",
            "wenn_aktuell_mehr_als": "Wenn aktuell mehr als",
            "einträge_vorhanden_sind_aktuel": "Einträge vorhanden sind (aktuell:",
            "werden_die_ältesten_einträge_b": "), werden die ältesten Einträge beim\n              Speichern",
            "unwiderruflich_gelöscht": "unwiderruflich gelöscht",
            "verstanden_speichern": "Verstanden & Speichern",
            "validierung_neu_laden": "Validierung neu laden?",
            "sie_haben_eine_regel_geändert_": "Sie haben eine Regel geändert. Möchten Sie die Konfigurationsvalidierung mit den neuen Einstellungen neu laden?",
            "nein": "Nein",
            "ja_neu_laden": "Ja, neu laden",
            "alle_regeln_löschen_1": "Alle Regeln löschen?",
            "dies_löscht_alle_vorhandenen_r": "Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "backup_herunterladen_json": "Backup herunterladen (JSON)",
            "administrator_passwort_eingebe": "Administrator-Passwort eingeben",
            "smart_redirect_service": "Smart Redirect Service",
            "ffffff": "#ffffff",
            "url_veraltet_aktualisierung_er": "URL veraltet - Aktualisierung erforderlich",
            "du_verwendest_einen_alten_link": "Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen.",
            "zeige_mir_die_neue_url": "Zeige mir die neue URL",
            "https_thisisthenewurl_com": "https://thisisthenewurl.com/",
            "https_newapp_com_q": "https://newapp.com/?q=",
            "file": "[?&]file=([^&]+)",
            "teams_regex": "/teams (Regex)",
            "fügt_eine_beispiel_regex_hinzu": "Fügt eine Beispiel-Regex hinzu",
            "proudly_brewed_with_generative": "Proudly brewed with Generative AI.",
            "war_die_neue_url_korrekt": "War die neue URL korrekt?",
            "dein_feedback_hilft_uns_die_we": "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
            "vielen_dank_für_deine_rückmeld": "Vielen Dank für deine Rückmeldung.",
            "ja_ok": "Ja, OK",
            "regeln_durchsuchen": "Regeln durchsuchen...",
            "regeln_durchsuchen_1": "Regeln durchsuchen",
            "einträge_suchen": "Einträge suchen...",
            "statistiken_durchsuchen": "Statistiken durchsuchen",
            "regel_filter": "Regel-Filter",
            "qualität": "Qualität",
            "feedback": "Feedback",
            "news_beitrag": "/news-beitrag",
            "nachrichtenbeiträge_wurden_mig": "Nachrichtenbeiträge wurden migriert...",
            "alte_seite": "/alte-seite",
            "neue_seite_leer_löschen": "/neue-seite (leer = löschen)",
            "source": "source",
            "migration": "migration",
            "nicht_kodieren_no_url_encoding": "Nicht kodieren (No URL Encoding)",
            "nach_oben": "Nach oben",
            "nach_unten": "Nach unten",
            "file_1": "file",
            "f": "f",
            "tippen_sie_delete_zur_bestätig": "Tippen Sie \"DELETE\" zur Bestätigung",
            "ip_adresse_z_b_192_168_1_1": "IP-Adresse (z.B. 192.168.1.1)",
            "erfolgreich_angemeldet": "Erfolgreich angemeldet",
            "willkommen_im_administrator_be": "Willkommen im Administrator-Bereich.",
            "anmeldung_fehlgeschlagen": "Anmeldung fehlgeschlagen",
            "regel_erstellt": "Regel erstellt",
            "die_url_regel_wurde_erfolgreic": "Die URL-Regel wurde erfolgreich erstellt.",
            "authentifizierung_erforderlich": "Authentifizierung erforderlich",
            "bitte_melden_sie_sich_erneut_a": "Bitte melden Sie sich erneut an.",
            "regel_aktualisiert": "Regel aktualisiert",
            "die_url_regel_wurde_erfolgreic_1": "Die URL-Regel wurde erfolgreich aktualisiert.",
            "regel_gelöscht": "Regel gelöscht",
            "1_regel_wurde_erfolgreich_gelö": "1 Regel wurde erfolgreich gelöscht.",
            "fehler_1": "Fehler",
            "die_regel_konnte_nicht_gelösch": "Die Regel konnte nicht gelöscht werden.",
            "alle_statistiken_gelöscht": "Alle Statistiken gelöscht",
            "alle_tracking_daten_wurden_erf": "Alle Tracking-Daten wurden erfolgreich gelöscht.",
            "blockierte_ips_gelöscht": "Blockierte IPs gelöscht",
            "alle_blockierten_ip_adressen_w": "Alle blockierten IP-Adressen wurden erfolgreich gelöscht.",
            "ip_blockiert": "IP blockiert",
            "die_ip_adresse_wurde_erfolgrei": "Die IP-Adresse wurde erfolgreich blockiert.",
            "ip_entsperrt": "IP entsperrt",
            "die_ip_adresse_wurde_erfolgrei_1": "Die IP-Adresse wurde erfolgreich entsperrt.",
            "teilweise_gelöscht": "Teilweise gelöscht",
            "regeln_gelöscht": "Regeln gelöscht",
            "fehler_beim_löschen": "Fehler beim Löschen",
            "fehler_beim_speichern": "Fehler beim Speichern",
            "import_erfolgreich": "Import erfolgreich",
            "die_einstellungen_wurden_erfol": "Die Einstellungen wurden erfolgreich importiert.",
            "import_fehlgeschlagen": "Import fehlgeschlagen",
            "die_einstellungen_konnten_nich": "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
            "die_url_regel_wurde_trotz_warn": "Die URL-Regel wurde trotz Warnung erfolgreich erstellt.",
            "die_regel_konnte_auch_mit_forc": "Die Regel konnte auch mit Force-Option nicht erstellt werden.",
            "die_url_regel_wurde_trotz_warn_1": "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert.",
            "die_regel_konnte_auch_mit_forc_1": "Die Regel konnte auch mit Force-Option nicht aktualisiert werden.",
            "keine_gültigen_regeln_ausgewäh": "Keine gültigen Regeln ausgewählt",
            "keine_der_ausgewählten_regeln_": "Keine der ausgewählten Regeln befinden sich auf der aktuellen Seite.",
            "warnung_ungültige_auswahl_erka": "Warnung: Ungültige Auswahl erkannt",
            "sicherheitsfehler": "Sicherheitsfehler",
            "export_erfolgreich": "Export erfolgreich",
            "export_fehlgeschlagen": "Export fehlgeschlagen",
            "die_daten_konnten_nicht_export": "Die Daten konnten nicht exportiert werden.",
            "einstellungen_gespeichert": "Einstellungen gespeichert",
            "die_allgemeinen_einstellungen_": "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert.",
            "erfolgreich_abgemeldet": "Erfolgreich abgemeldet",
            "sie_wurden_erfolgreich_abgemel": "Sie wurden erfolgreich abgemeldet.",
            "abmeldung_fehlgeschlagen": "Abmeldung fehlgeschlagen",
            "vorschau_fehlgeschlagen": "Vorschau fehlgeschlagen",
            "import_mit_validierungsfehlern": "Import mit Validierungsfehlern",
            "datei_zu_groß": "Datei zu groß",
            "die_import_datei_ist_zu_groß_b": "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei).",
            "cache_neu_aufgebaut": "Cache neu aufgebaut",
            "der_regel_cache_wurde_erfolgre": "Der Regel-Cache wurde erfolgreich neu erstellt.",
            "fehler_beim_cache_neuaufbau": "Fehler beim Cache-Neuaufbau",
            "alle_regeln_gelöscht": "Alle Regeln gelöscht",
            "alle_url_regeln_wurden_erfolgr": "Alle URL-Regeln wurden erfolgreich gelöscht.",
            "import_fehler": "Import Fehler",
            "konnte_die_vollständigen_daten": "Konnte die vollständigen Daten für den Import nicht laden.",
            "dateifehler": "Dateifehler",
            "die_import_datei_konnte_nicht_": "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
            "die_datei_darf_maximal_5mb_gro": "Die Datei darf maximal 5MB groß sein.",
            "logo_hochgeladen": "Logo hochgeladen",
            "das_header_logo_wurde_erfolgre": "Das Header-Logo wurde erfolgreich aktualisiert.",
            "fehler_beim_hochladen": "Fehler beim Hochladen",
            "das_logo_konnte_nicht_hochgela": "Das Logo konnte nicht hochgeladen werden.",
            "logo_entfernt": "Logo entfernt",
            "das_header_logo_wurde_erfolgre_1": "Das Header-Logo wurde erfolgreich entfernt.",
            "das_logo_konnte_nicht_entfernt": "Das Logo konnte nicht entfernt werden.",
            "die_globalen_regeln_wurden_erf": "Die globalen Regeln wurden erfolgreich aktualisiert.",
            "url_wird_analysiert": "URL wird analysiert...",
            "klicken_zum_kopieren": "Klicken zum Kopieren",
            "url_erfolgreich_in_die_zwische": "URL erfolgreich in die Zwischenablage kopiert!",
            "v": "v",
            "überspringen": "Überspringen",
            "neue_url_in_neuem_tab_öffnen": "Neue URL in neuem Tab öffnen",
            "kopieren_fehlgeschlagen": "Kopieren fehlgeschlagen",
            "bitte_kopieren_sie_die_url_man": "Bitte kopieren Sie die URL manuell.",
            "404_page_not_found": "404 Page Not Found",
            "did_you_forget_to_add_the_page": "Did you forget to add the page to the router?",
            "globale_regeln": "Globale Regeln",
            "diese_regeln_werden_auf_alle_w": "Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).\n                    Spezifische Regeln überschreiben diese globalen Einstellungen.",
            "globales_suchen_ersetzen": "Globales Suchen & Ersetzen",
            "ersetzen_sie_text_in_der_ziel_": "Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.",
            "reihenfolge_global_hier_rarr_r": "Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.",
            "globale_statische_parameter": "Globale Statische Parameter",
            "parameter_die_immer_angehängt_": "Parameter, die immer angehängt werden (z.B. ?source=migration).",
            "wenn_eine_regel_denselben_para": "Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.",
            "globale_parameter_übernahme_wh": "Globale Parameter-Übernahme (Whitelist)",
            "parameter_die_bei_aktivierter_": "Parameter, die bei aktivierter \"Parameter entfernen\" Option (in einer Regel) trotzdem behalten werden.",
            "wird_zusätzlich_zu_den_regel_s": "Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.",
            "key_pattern_regex": "Key Pattern (Regex)",
            "value_pattern_opt": "Value Pattern (Opt.)",
            "neuer_name_opt": "Neuer Name (Opt.)",
            "beispiel_file": "Beispiel (file)",
            "alte_pfade": "/alte-pfade",
            "neue_pfade": "/neue-pfade",
            "utm_source": "utm_source",
            "migration_tool": "migration_tool",
            "nicht_kodieren_raw": "Nicht kodieren (Raw)",
            "id_lang": "id|lang",
            "new_id": "new_id",
            "query_parameters": "Query Parameters",
            "mode": "Mode:",
            "kept_params_exceptions": "Kept Params (Exceptions):",
            "rarr": "&rarr;",
            "static_params_appended": "Static Params (Appended):",
            "search_replace_1": "Search & Replace",
            "case_sensitive": "Case Sensitive",
            "keine_suchen_ersetzen_regeln": "Keine Suchen & Ersetzen Regeln.",
            "info_beschreibung": "Info / Beschreibung",
            "status": "Status",
            "ziel_url": "Ziel-URL",
            "typ": "Typ",
            "auto_1": "Auto",
            "erstellt_am": "Erstellt am",
            "das_auswählen_und_löschen_mehr": "Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.",
            "params_entfernen": "Params Entfernen",
            "params_behalten": "Params Behalten",
            "regel_löschen": "Regel löschen",
            "sind_sie_sicher_dass_sie_diese": "Sind Sie sicher, dass Sie diese Regel löschen möchten?\n                      Diese Aktion kann nicht rückgängig gemacht werden.",
            "ziel_url_1": "Ziel-URL:",
            "automatisch_generiert": "Automatisch generiert",
            "info_text": "Info-Text:",
            "erstellt": "Erstellt:",
            "bearbeiten": "Bearbeiten",
            "regel_bearbeiten": "Regel bearbeiten",
            "expand_all": "Expand All",
            "collapse_all": "Collapse All",
            "erstellt_1": "Erstellt",
            "action": "Action",
            "on": "On",
            "sind_sie_sicher": "Sind Sie sicher?",
            "parameter_konfiguration": "Parameter Konfiguration",
            "handling_mode": "Handling Mode:",
            "ausnahmen_kept": "Ausnahmen (Kept):",
            "statische_parameter": "Statische Parameter:",
            "keine": "Keine.",
            "alle_regeln_auf_dieser_seite_a": "Alle Regeln auf dieser Seite auswählen/abwählen",
            "nicht_genügend_daten_für_trend": "Nicht genügend Daten für Trendanzeige",
            "match_quality": "Match Quality",
            "feedback_inkl_auto": "Feedback (inkl. Auto)",
            "match": "Match:",
            "score": "Score:",
            "total": "Total:",
            "ok_1": "(OK:",
            "auto_2": ", Auto:",
            "nok_1": ", NOK:",
            "spalten_anpassen": "Spalten anpassen",
            "spalten_auswählen": "Spalten auswählen",
            "zeitstempel": "Zeitstempel",
            "alte_url": "Alte URL",
            "neue_url": "Neue URL",
            "pfad": "Pfad",
            "referrer": "Referrer",
            "regel": "Regel",
            "n_a": "N/A",
            "smart_search": "Smart Search",
            "domain_redirect": "Domain Redirect",
            "regel_nicht_mehr_vorhanden": "Regel nicht mehr vorhanden",
            "gelöscht": "Gelöscht",
            "api_1": "API",
            "vorschlag": "Vorschlag:",
            "intelligente_suche_fallback": "Intelligente Suche (Fallback)",
            "standard_domain_weiterleitung_": "Standard Domain-Weiterleitung (Fallback)",
            "api_call": "API Call",
            "übersetzungen_für_die_anwendun": "Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.",
            "speichern": "Speichern",
            "schlüssel_key": "Schlüssel (Key)",
            "wert_value": "Wert (Value)",
            "sprache_auswählen": "Sprache auswählen",
            "neuer_schlüssel": "Neuer Schlüssel...",
            "wert": "Wert...",
            "erfolg": "Erfolg",
            "übersetzungen_gespeichert": "Übersetzungen gespeichert.",
            "konnte_übersetzungen_nicht_spe": "Konnte Übersetzungen nicht speichern.",
            "old": "Old:",
            "new": "New:",
            "ergebnis_analyse": "Ergebnis-Analyse",
            "original": "Original:",
            "smart_search_fallback": "Smart Search Fallback:",
            "weiterleitung_zur_suche_da_kei": "Weiterleitung zur Suche, da keine Regel passte.",
            "angewandte_regel": "Angewandte Regel",
            "id_1": "ID:",
            "matcher_1": "Matcher:",
            "ziel": "Ziel:",
            "typ_1": "Typ:",
            "parameter_werden_verworfen": "Parameter werden verworfen",
            "keine_spezifische_regel_gefund": "Keine spezifische Regel gefunden (Fallback).",
            "angewandte_globale_regeln": "Angewandte Globale Regeln",
            "keine_globalen_regeln_angewend": "Keine globalen Regeln angewendet",
            "verarbeitungsschritte": "Verarbeitungsschritte",
            "testen_sie_ihre_regeln_mit_ein": "Testen Sie Ihre Regeln mit einer Liste von URLs. Importieren Sie eine CSV/Excel-Datei oder fügen Sie URLs ein.",
            "text_einfügen": "Text einfügen",
            "datei_hochladen": "Datei hochladen",
            "urls_einfügen_durch_komma_semi": "URLs einfügen (durch Komma, Semikolon oder neue Zeile getrennt)",
            "leerzeichen_nach_trennzeichen_": "Leerzeichen nach Trennzeichen werden automatisch entfernt.",
            "unterstützt_csv_xlsx_xls_nur_e": "Unterstützt CSV, XLSX, XLS (nur erste Spalte wird verwendet)",
            "ausgewählt": "Ausgewählt",
            "hinweis_1": "Hinweis",
            "verarbeite_urls": "Verarbeite URLs...",
            "ergebnisse": "Ergebnisse",
            "neu_berechnen": "Neu berechnen",
            "csv_export": "CSV Export",
            "neue_suche": "Neue Suche",
            "url_transformation": "URL Transformation",
            "rule_tag": "Rule Tag",
            "validierung_starten": "Validierung starten",
            "https_example_com_a_10_https_e": "https://example.com/a&#10;https://example.com/b",
            "alle_ausklappen": "Alle ausklappen",
            "alle_einklappen": "Alle einklappen",
            "keine_daten_zum_aktualisieren": "Keine Daten zum Aktualisieren",
            "bitte_starten_sie_den_prozess_": "Bitte starten Sie den Prozess neu.",
            "close": "Close",
            "bitte_geben_sie_das_administra_1": "Bitte geben Sie das Administrator-Passwort ein:",
            "passwort_eingeben": "Passwort eingeben",
            "link_qualität": "Link-Qualität:"
      },
      "fr": {
            "incorrect_password_please_try_": "Mot de passe incorrect. Veuillez réessayer.",
            "please_enter_the_administrator": "Veuillez saisir le mot de passe administrateur.",
            "enter_password": "Entrez le mot de passe",
            "incorrect_password": "Mot de passe incorrect",
            "password": "mot de passe",
            "enter_administrator_password": "Entrez le mot de passe administrateur",
            "administrator_login": "Connexion administrateur",
            "welcome_to_the_admin_area": "Bienvenue dans la zone d'administration.",
            "open_administrator_area": "Ouvrir la zone administrateur",
            "loading_app": "",
            "admin_area": "",
            "lang": "Lang",
            "showing": "Showing",
            "of": "of",
            "entries": "entries",
            "performance": "Performance",
            "memory": "Memory:",
            "performance_monitor": "Performance Monitor",
            "overview": "Overview",
            "loading": "Loading",
            "memory_1": "Memory",
            "issues_detected": "Issues Detected:",
            "dom": "DOM:",
            "load": "Load:",
            "heap": "Heap:",
            "dom_ready": "DOM Ready:",
            "load_complete": "Load Complete:",
            "first_paint": "First Paint:",
            "dns_lookup": "DNS Lookup:",
            "tcp_connect": "TCP Connect:",
            "server_response": "Server Response:",
            "resources": "Resources:",
            "slow_resources": "Slow Resources:",
            "js_size": "JS Size:",
            "css_size": "CSS Size:",
            "loading_performance_data": "Loading performance data...",
            "used_heap": "Used Heap:",
            "total_heap": "Total Heap:",
            "heap_limit": "Heap Limit:",
            "usage": "Usage:",
            "memory_data_not_available": "Memory data not available",
            "administrator_anmeldung": "Administrator-Anmeldung",
            "bitte_geben_sie_das_administra": "Bitte geben Sie das Administrator-Passwort ein.",
            "passwort": "Passwort",
            "abbrechen": "Abbrechen",
            "überprüfe_authentifizierung": "Überprüfe Authentifizierung...",
            "administrator_bereich": "Administrator-Bereich",
            "admin": "Admin",
            "schließen": "Schließen",
            "allgemein": "Allgemein",
            "regeln": "Regeln",
            "global": "Global",
            "statistiken": "Statistiken",
            "system_daten": "System & Daten",
            "sprachen": "Sprachen",
            "allgemeine_einstellungen": "Allgemeine Einstellungen",
            "hier_können_sie_alle_texte_der": "Hier können Sie alle Texte der Anwendung anpassen.",
            "bitte_melden_sie_sich_an_auth": "Bitte melden Sie sich an... (Auth:",
            "lade_einstellungen_auth": "Lade Einstellungen... (Auth:",
            "loading_1": ", Loading:",
            "header_einstellungen": "Header-Einstellungen",
            "anpassung_des_oberen_bereichs_": "Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt",
            "titel": "Titel",
            "wird_als_haupttitel_im_header_": "Wird als Haupttitel im Header der Anwendung angezeigt",
            "icon": "Icon",
            "kein_icon": "🚫 Kein Icon",
            "pfeil_wechsel": "🔄 Pfeil Wechsel",
            "warnung": "⚠️ Warnung",
            "fehler": "❌ Fehler",
            "alert": "⭕ Alert",
            "ℹ_info": "ℹ️ Info",
            "lesezeichen": "🔖 Lesezeichen",
            "teilen": "📤 Teilen",
            "zeit": "⏰ Zeit",
            "häkchen": "✅ Häkchen",
            "stern": "⭐ Stern",
            "herz": "❤️ Herz",
            "glocke": "🔔 Glocke",
            "hintergrundfarbe": "Hintergrundfarbe",
            "logo_hochladen": "Logo hochladen",
            "empfehlung": "Empfehlung:",
            "png_mit_transparentem_hintergr": "PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)",
            "funktion": "Funktion:",
            "wenn_ein_logo_hochgeladen_wird": "Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt.",
            "aktuelles_logo": "Aktuelles Logo:",
            "löschen": "Löschen",
            "logo_aktiv_wird_anstelle_des_i": "Logo aktiv - wird anstelle des Icons angezeigt",
            "interaktionen": "Interaktionen",
            "steuern_sie_die_interaktionsmö": "Steuern Sie die Interaktionsmöglichkeiten auf der Migrationsseite",
            "kopier_button_anzeigen": "Kopier-Button anzeigen",
            "blendet_den_button_zum_kopiere": "Blendet den Button zum Kopieren der URL ein/aus",
            "öffnen_button_anzeigen": "Öffnen-Button anzeigen",
            "blendet_den_button_zum_öffnen_": "Blendet den Button zum Öffnen im neuen Tab ein/aus",
            "verhalten_bei_klick_auf_url_fe": "Verhalten bei Klick auf URL-Feld",
            "kopieren_standard": "Kopieren (Standard)",
            "in_neuem_tab_öffnen": "In neuem Tab öffnen",
            "keine_aktion": "Keine Aktion",
            "definiert_was_passiert_wenn_de": "Definiert was passiert, wenn der Nutzer direkt auf das Feld mit der neuen URL klickt.",
            "button_text_url_kopieren": "Button-Text \"URL kopieren\"",
            "button_text_in_neuem_tab_öffne": "Button-Text \"In neuem Tab öffnen\"",
            "popup_einstellungen": "PopUp-Einstellungen",
            "dialog_fenster_das_automatisch": "Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft",
            "popup_anzeige": "PopUp-Anzeige",
            "aktiv": "Aktiv",
            "inline": "Inline",
            "deaktiviert": "Deaktiviert",
            "beschreibung": "Beschreibung",
            "erklärt_dem_nutzer_die_situati": "Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte",
            "popup_button_text": "PopUp Button-Text",
            "text_für_den_button_der_das_po": "Text für den Button der das PopUp-Fenster öffnet",
            "alert_hintergrundfarbe": "Alert-Hintergrundfarbe",
            "gelb": "🟡 Gelb",
            "rot": "🔴 Rot",
            "orange": "🟠 Orange",
            "blau": "🔵 Blau",
            "grau": "⚫ Grau",
            "hauptinhalt_hintergrundfarbe": "Hauptinhalt-Hintergrundfarbe",
            "routing_fallback_verhalten": "Routing & Fallback-Verhalten",
            "konfiguration_des_verhaltens_b": "Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung",
            "ziel_domain_standard_neue_doma": "Ziel-Domain (Standard neue Domain)",
            "verwendet_für_partial_matches_": "Verwendet für Partial Matches und spezifische Regeln.",
            "fallback_strategie": "Fallback-Strategie",
            "einfacher_domain_austausch": "Einfacher Domain-Austausch",
            "standard_verhalten_ersetzt_die": "Standard-Verhalten: Ersetzt die alte Domain durch die neue \"Target Domain\". Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt.",
            "intelligente_such_weiterleitun": "Intelligente Such-Weiterleitung",
            "intelligenter_fallback_leitet_": "Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite.",
            "definiert_was_passiert_wenn_ke": "Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift.",
            "such_basis_url": "Such-Basis-URL",
            "beispiel_https_newapp_com_q": "Beispiel: https://newapp.com/?q=",
            "nicht_kodieren": "Nicht kodieren",
            "extraktions_regeln_regex": "Extraktions-Regeln (Regex)",
            "regex_pattern_extraction_optio": "Regex Pattern (Extraction - optional)",
            "path_matcher_prefix": "Path Matcher (Prefix)",
            "custom_search_base_url_optiona": "Custom Search Base URL (Optional)",
            "suchbegriff_nicht_kodieren_no_": "Suchbegriff nicht kodieren (No URL Encoding)",
            "regel_hinzufügen": "Regel hinzufügen",
            "beispiel_hinzufügen": "Beispiel hinzufügen",
            "definieren_sie_eine_liste_von_": "Definieren Sie eine Liste von Regeln. Die Regeln werden von oben nach unten geprüft.\n                                    Wenn Sie ein Regex-Pattern definieren, muss es eine Capture Group () enthalten.",
            "lassen_sie_das_feld_regex_patt": "Lassen Sie das Feld \"Regex Pattern\" leer, um automatisch das letzte Pfadsegment zu verwenden.",
            "wenn_keine_regel_greift_wird_a": "Wenn keine Regel greift, wird als Fallback ebenfalls das letzte Pfadsegment verwendet.",
            "fallback_info_nachrichten": "Fallback-Info-Nachrichten",
            "spezielle_hinweise_titel": "Spezielle Hinweise - Titel",
            "spezielle_hinweise_icon": "Spezielle Hinweise - Icon",
            "standard_info_text_beschreibun": "Standard Info Text (Beschreibung)",
            "angezeigt_wenn_eine_regel_matc": "Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat.",
            "smart_search_nachricht": "Smart Search Nachricht",
            "angezeigt_nur_wenn_intelligent": "Angezeigt NUR wenn \"Intelligente Such-Weiterleitung\" ausgelöst wird (keine Regel matched).",
            "visualisierung": "Visualisierung",
            "label_für_alte_url": "Label für alte URL",
            "label_für_neue_url": "Label für neue URL",
            "link_qualitätstacho_anzeigen": "Link-Qualitätstacho anzeigen",
            "text_für_hohe_übereinstimmung_": "Text für hohe Übereinstimmung (100%)",
            "text_für_mittlere_übereinstimm": "Text für mittlere Übereinstimmung (75%)",
            "text_für_geringe_übereinstimmu": "Text für geringe Übereinstimmung (50%)",
            "text_für_startseiten_treffer_1": "Text für Startseiten-Treffer (100%)",
            "text_für_keine_übereinstimmung": "Text für keine Übereinstimmung (0%)",
            "zusätzliche_informationen": "Zusätzliche Informationen",
            "wird_nur_angezeigt_wenn_mindes": "Wird nur angezeigt wenn mindestens ein Info-Punkt konfiguriert ist",
            "titel_der_sektion": "Titel der Sektion",
            "überschrift_für_den_bereich_mi": "Überschrift für den Bereich mit zusätzlichen Informationen",
            "icon_für_den_titel": "Icon für den Titel",
            "informations_punkte": "Informations-Punkte",
            "liste_von_stichpunkten_die_unt": "Liste von Stichpunkten die unter dem Info-Text angezeigt werden",
            "hinzufügen": "Hinzufügen",
            "bookmark": "🔖 Bookmark",
            "share": "📤 Share",
            "clock": "⏰ Clock",
            "check": "✅ Check",
            "star": "⭐ Star",
            "heart": "❤️ Heart",
            "bell": "🔔 Bell",
            "keine_info_punkte_vorhanden_kl": "Keine Info-Punkte vorhanden. Klicken Sie \"Hinzufügen\" um welche zu erstellen.",
            "footer": "Footer",
            "copyright_und_fußzeile_der_anw": "Copyright und Fußzeile der Anwendung",
            "copyright_text": "Copyright-Text",
            "link_erkennung_leistung": "Link-Erkennung & Leistung",
            "einstellungen_zur_erkennungslo": "Einstellungen zur Erkennungslogik und Systemleistung",
            "groß_kleinschreibung_beachten": "Groß-/Kleinschreibung beachten",
            "wenn_aktiviert_werden_regeln_n": "Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert.",
            "referrer_tracking_aktivieren": "Referrer Tracking aktivieren",
            "erfasst_die_herkunfts_url_refe": "Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen.",
            "tracking_cache_aktivieren_ram": "Tracking-Cache aktivieren (RAM)",
            "speichert_statistik_daten_im_a": "Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten.",
            "max_statistik_einträge": "Max. Statistik-Einträge",
            "begrenzt_die_anzahl_der_gespei": "Begrenzt die Anzahl der gespeicherten Statistik-Einträge in der tracking.json. Älteste Einträge werden bei Überschreitung gelöscht. (0 = Unbegrenzt)",
            "lassen_sie_den_tracking_cache_": "Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (&lt; 512MB) oder Sie haben extrem viele Tracking-Daten (&gt; 1 Mio. Einträge).",
            "automatische_weiterleitung": "Automatische Weiterleitung",
            "globale_einstellungen_für_auto": "Globale Einstellungen für automatische Weiterleitungen",
            "automatische_weiterleitung_akt": "Automatische Weiterleitung aktivieren",
            "wenn_aktiviert_werden_alle_ben": "Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen.",
            "hinweis_feedback_umfrage_wird_": "Hinweis: Feedback-Umfrage wird deaktiviert, da keine Interaktion stattfindet (Auto-Redirect wird als Feedback geloggt).",
            "admin_zugriff": "Admin-Zugriff:",
            "bei_aktivierter_automatischer_": "Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter",
            "admin_true": "?admin=true",
            "erreichen": "erreichen.",
            "benutzer_feedback_umfrage": "Benutzer-Feedback-Umfrage",
            "erfassen_sie_feedback_von_nutz": "Erfassen Sie Feedback von Nutzern zur Qualität der Weiterleitung",
            "feedback_umfrage_aktivieren": "Feedback-Umfrage aktivieren",
            "zeigt_ein_popup_an_wenn_nutzer": "Zeigt ein Popup an, wenn Nutzer auf \"Kopieren\" oder \"Öffnen\" klicken, um zu fragen, ob der Link funktioniert hat.",
            "trend_anzeige": "Trend-Anzeige",
            "konfiguration_für_den_redirect": "Konfiguration für den \"Redirect Satisfaction Trend\"",
            "zeitraum_tage": "Zeitraum (Tage)",
            "nur_feedback_ok_nok_anzeigen": "Nur Feedback (OK/NOK) anzeigen",
            "berechnet_den_score_ausschließ": "Berechnet den Score ausschließlich basierend auf Benutzer-Feedback, ignoriert automatische Match-Qualität.",
            "umfrage_titel": "Umfrage Titel",
            "umfrage_frage": "Umfrage Frage",
            "erfolgsmeldung": "Erfolgsmeldung",
            "button_ja_ok": "Button Ja (OK)",
            "text_auf_dem_button_für_positi": "Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)",
            "button_nein_nok": "Button Nein (NOK)",
            "text_auf_dem_button_für_negati": "Text auf dem Button für negative Rückmeldung (Standard: Nein)",
            "such_vorschlag_bei_nein_aktivi": "Such-Vorschlag bei \"Nein\" aktivieren",
            "zeigt_dem_nutzer_einen_link_zu": "Zeigt dem Nutzer einen Link zur intelligenten Suche an, wenn die Bewertung negativ ausfällt. (Erfordert aktive \"Intelligente Such-Weiterleitung\")",
            "nur_verfügbar_wenn_intelligent": "* Nur verfügbar wenn \"Intelligente Such-Weiterleitung\" als Fallback-Strategie gewählt ist.",
            "vorschlag_titel": "Vorschlag Titel",
            "vorschlag_beschreibung": "Vorschlag Beschreibung",
            "vorschlag_frage": "Vorschlag Frage",
            "kommentar_funktion_bei_nein_ak": "Kommentar-Funktion bei \"Nein\" aktivieren",
            "fragt_den_nutzer_nach_der_korr": "Fragt den Nutzer nach der korrekten URL, wenn die Bewertung negativ ausfällt (oder nachdem die Suche erfolglos war).",
            "kommentar_titel": "Kommentar Titel",
            "kommentar_beschreibung": "Kommentar Beschreibung",
            "platzhalter": "Platzhalter",
            "button_text": "Button Text",
            "speichern_sie_ihre_änderungen_": "Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.",
            "url_transformationsregeln": "URL-Transformationsregeln",
            "verwalten_sie_url_transformati": "Verwalten Sie URL-Transformations-Regeln für die Migration.",
            "löschen_1": "löschen",
            "konfigurationsvalidierung": "Konfigurationsvalidierung",
            "neue_regel": "Neue Regel",
            "suche": "Suche...",
            "seite": "Seite",
            "von": "von",
            "lade_regeln": "Lade Regeln...",
            "keine_regeln_für": "Keine Regeln für \"",
            "gefunden": "\" gefunden.",
            "versuchen_sie_einen_anderen_su": "Versuchen Sie einen anderen Suchbegriff oder erstellen Sie eine neue Regel.",
            "erste": "Erste",
            "vorherige": "Vorherige",
            "zeige": "Zeige",
            "nächste": "Nächste",
            "letzte": "Letzte",
            "overall": "Overall",
            "alle_einträge": "Alle Einträge",
            "letzte_24h": "Letzte 24h",
            "letzte_7_tage": "Letzte 7 Tage",
            "alle_zeit": "Alle Zeit",
            "nur_mit_regeln": "Nur mit Regeln",
            "nur_ohne_regeln": "Nur ohne Regeln",
            "alle_qualitäten": "Alle Qualitäten",
            "100_exakt": "100% (Exakt)",
            "75_fast_exakt": "75% (Fast exakt)",
            "50_teilweise": "50% (Teilweise)",
            "0_kein_treffer": "0% (Kein Treffer)",
            "alle_feedbacks": "Alle Feedbacks",
            "ok": "👍 OK",
            "nok": "👎 NOK",
            "auto": "⚡ Auto",
            "api": "🤖 API",
            "kein_feedback": "Kein Feedback",
            "gesamte_weiterleitungen": "Gesamte Weiterleitungen",
            "heute": "Heute",
            "exakte_trefferquote": "Exakte Trefferquote",
            "redirect_satisfaction_trend": "Redirect Satisfaction Trend",
            "entwicklung_der_qualität_und_n": "Entwicklung der Qualität und Nutzerzufriedenheit über die letzten",
            "tage": "Tage.",
            "täglich": "Täglich",
            "wöchentlich": "Wöchentlich",
            "monatlich": "Monatlich",
            "lade_trend": "Lade Trend...",
            "link_quality": "Link Quality",
            "qualitätsverteilung_der_link_m": "Qualitätsverteilung der Link-Matches",
            "lade_statistiken": "Lade Statistiken...",
            "exakter_treffer_100": "Exakter Treffer (100%)",
            "hoher_treffer_75": "Hoher Treffer (75%)",
            "mittlerer_treffer_50": "Mittlerer Treffer (50%)",
            "kein_treffer_0": "Kein Treffer (0%)",
            "nutzer_feedback": "Nutzer-Feedback",
            "rückmeldungen_zu_weiterleitung": "Rückmeldungen zu Weiterleitungen",
            "auto_redirect": "Auto-Redirect",
            "top_urls": "Top URLs",
            "lade_urls": "Lade URLs...",
            "keine_url_aufrufe_vorhanden": "Keine URL-Aufrufe vorhanden.",
            "url_pfad": "URL-Pfad",
            "aufrufe": "Aufrufe",
            "anteil": "Anteil",
            "top_referrer": "Top Referrer",
            "lade_referrer": "Lade Referrer...",
            "keine_referrer_daten_vorhanden": "Keine Referrer-Daten vorhanden.",
            "domain": "Domain",
            "anzahl": "Anzahl",
            "alle_tracking_einträge": "Alle Tracking-Einträge",
            "lade_einträge": "Lade Einträge...",
            "standard_import_export_excel_c": "Standard Import / Export (Excel, CSV)",
            "benutzerfreundlicher_import_un": "Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV.\n                        Mit Vorschau-Funktion vor dem Import.",
            "regeln_importieren": "Regeln Importieren",
            "laden_sie_eine_excel_oder_csv_": "Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:",
            "matcher": "Matcher",
            "pflicht_z_b_alte_seite": "(Pflicht) - z.B. /alte-seite",
            "target_url": "Target URL",
            "pflicht_z_b_https_neue_seite_d": "(Pflicht) - z.B. https://neue-seite.de",
            "type": "Type",
            "pflicht_partial_wildcard_oder_": "(Pflicht) - 'partial', 'wildcard' oder 'domain'",
            "info": "Info",
            "optional_beschreibung": "(Optional) - Beschreibung",
            "auto_redirect_1": "Auto Redirect",
            "optional_true_false": "(Optional) - 'true'/'false'",
            "discard_query_params": "Discard Query Params",
            "keep_query_params": "Keep Query Params",
            "static_query_params": "Static Query Params",
            "optional_json_array": "(Optional) - JSON Array",
            "search_replace": "Search Replace",
            "id": "ID",
            "optional_nur_für_updates_beste": "(Optional) - Nur für Updates bestehender Regeln",
            "musterdatei_excel": "Musterdatei (Excel)",
            "musterdatei_csv": "Musterdatei (CSV)",
            "analysiere_datei": "Analysiere Datei...",
            "klicken_zum_auswählen": "Klicken zum Auswählen",
            "oder_datei_hierher_ziehen": "oder Datei hierher ziehen",
            "excel_xlsx_oder_csv": "Excel (.xlsx) oder CSV",
            "urls_automatisch_kodieren": "URLs automatisch kodieren",
            "sonderzeichen_in_urls_automati": "Sonderzeichen in URLs automatisch konvertieren (encodeURI)",
            "regeln_exportieren": "Regeln Exportieren",
            "exportieren_sie_alle_regeln_zu": "Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup.\n                                Die Dateien können später wieder importiert werden.",
            "herunterladen_excel": "Herunterladen (Excel)",
            "herunterladen_csv": "Herunterladen (CSV)",
            "erweiterter_regel_import_expor": "Erweiterter Regel-Import/Export",
            "für_fortgeschrittene_benutzer_": "Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau.",
            "regel_rohdaten_json": "Regel-Rohdaten (JSON)",
            "herunterladen_json": "Herunterladen (JSON)",
            "importieren_json": "Importieren (JSON)",
            "musterdatei_json": "Musterdatei (JSON)",
            "warnung_1": "Warnung:",
            "keine_vorschau_überschreibt_be": "Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort.",
            "system_statistiken": "System & Statistiken",
            "verwaltung_von_systemeinstellu": "Verwaltung von Systemeinstellungen und Statistiken.",
            "system_einstellungen": "System-Einstellungen",
            "exportieren_sie_die_komplette_": "Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen.",
            "exportieren_sie_die_tracking_l": "Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse.",
            "gefahrenzone": "Gefahrenzone!",
            "cache_wartung": "Cache Wartung",
            "nur_bei_problemen_mit_der_rege": "Nur bei Problemen mit der Regelerkennung notwendig.",
            "sicherheit": "Sicherheit",
            "blockierte_ips_anzeigen_und_ve": "Blockierte IPs anzeigen und verwalten",
            "liste_der_blockierten_ips_eins": "Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren.",
            "destruktive_aktionen": "Destruktive Aktionen",
            "alle_regeln_löschen": "Alle Regeln löschen",
            "löscht_alle_vorhandenen_weiter": "Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich.",
            "alle_statistiken_löschen": "Alle Statistiken löschen",
            "löscht_alle_erfassten_tracking": "Löscht alle erfassten Tracking-Daten unwiderruflich.",
            "blockierte_ips_löschen": "Blockierte IPs löschen",
            "löscht_alle_blockierten_ip_adr": "Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff.",
            "import_vorschau": "Import Vorschau",
            "überprüfen_sie_die_zu_importie": "Überprüfen Sie die zu importierenden Regeln.",
            "neu": "Neu:",
            "update": "Update:",
            "ungültig": "Ungültig:",
            "filter_löschen": "Filter löschen",
            "gesamt": "(Gesamt:",
            "mehr_laden_100": "Mehr laden (+100)",
            "url_pfad_matcher": "URL-Pfad Matcher",
            "ziel_url_optional": "Ziel-URL (optional)",
            "redirect_typ": "Redirect-Typ",
            "teilweise": "Teilweise",
            "nur_die_pfadsegmente_ab_dem_ma": "Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.",
            "vollständig": "Vollständig",
            "alte_links_werden_komplett_auf": "Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.",
            "domain_ersatz": "Domain-Ersatz",
            "ersetzt_nur_die_domain_host_de": "Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Wenn eine Ziel-URL angegeben ist, wird deren Domain verwendet.",
            "der_matcher_kann_hier_auch_ein": "Der Matcher kann hier auch eine Domain sein (z.B. \"www.alteseite.ch\"). Bei Verwendung eines Pfad-Matchers (\"/news\") mit diesem Typ wird nur die Domain ersetzt, während der Pfad erhalten bleibt.",
            "info_text_markdown": "Info-Text (Markdown)",
            "suchen_ersetzen": "Suchen & Ersetzen",
            "ersetzen_sie_teile_der_url_pfa": "Ersetzen Sie Teile der URL (Pfad oder Parameter) vor der Weiterleitung.",
            "suchen": "Suchen",
            "ersetzen": "Ersetzen",
            "aa": "Aa",
            "ersetzung_hinzufügen": "Ersetzung hinzufügen",
            "statische_parameter_hinzufügen": "Statische Parameter hinzufügen",
            "definieren_sie_parameter_die_i": "Definieren Sie Parameter, die immer an die Ziel-URL angehängt werden (z.B. ?source=migration).",
            "key": "Key",
            "value": "Value",
            "raw": "Raw",
            "parameter_hinzufügen": "Parameter hinzufügen",
            "alle_link_parameter_entfernen": "Alle Link-Parameter entfernen",
            "wenn_aktiviert_werden_alle_que": "Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten).",
            "alle_link_parameter_beibehalte": "Alle Link-Parameter beibehalten",
            "wenn_aktiviert_werden_die_ursp": "Wenn aktiviert, werden die ursprünglichen Query-Parameter 1:1 an die Ziel-URL angehängt.\n                      Deaktivieren Sie dies, um spezifische Parameter auszuwählen oder umzubenennen.",
            "parameter_beibehalten_umbenenn": "Parameter beibehalten / umbenennen (Regex)",
            "definieren_sie_ausnahmen_für_p": "Definieren Sie Ausnahmen für Parameter, die trotz Aktivierung erhalten bleiben sollen. Die Reihenfolge bestimmt die Position im neuen Query-String.",
            "parameter_key_regex": "Parameter Key (Regex)",
            "value_matcher_optional_regex": "Value Matcher (Optional Regex)",
            "neuer_name_optional": "Neuer Name (Optional)",
            "beispiel_file_hinzufügen": "Beispiel (File) hinzufügen",
            "automatische_weiterleitung_für": "Automatische Weiterleitung für diese Regel",
            "wenn_aktiviert_werden_benutzer": "Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet.",
            "warnung_da_die_feedback_umfrag": "Warnung: Da die Feedback-Umfrage global aktiviert ist, erhält der Nutzer bei diesem Auto-Redirect keine Möglichkeit Feedback zu geben.",
            "wichtiger_hinweis": "Wichtiger Hinweis",
            "bestätigung_für_die_aktivierun": "Bestätigung für die Aktivierung der automatischen Weiterleitung",
            "sie_sind_dabei_die_automatisch": "Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet.",
            "wichtiger_hinweis_1": "Wichtiger Hinweis:",
            "bei_aktivierter_automatischer__1": "Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter",
            "beispiel": "Beispiel:",
            "ich_habe_verstanden": "Ich habe verstanden",
            "blockierte_ips_löschen_1": "Blockierte IPs löschen?",
            "dies_löscht_alle_derzeit_block": "Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden.",
            "diese_aktion_hebt_den_brute_fo": "Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf.",
            "backup_herunterladen_excel": "Backup herunterladen (Excel)",
            "bestätigung_erforderlich": "Bestätigung erforderlich",
            "blockierte_ips_verwalten": "Blockierte IPs verwalten",
            "hier_können_sie_aktuell_blocki": "Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten.",
            "blockieren": "Blockieren",
            "ip_adresse": "IP-Adresse",
            "fehlversuche": "Fehlversuche",
            "blockiert_bis": "Blockiert bis",
            "aktionen": "Aktionen",
            "lade": "Lade...",
            "keine_blockierten_ip_adressen": "Keine blockierten IP-Adressen.",
            "alle_statistiken_löschen_1": "Alle Statistiken löschen?",
            "dies_löscht_alle_erfassten_tra": "Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "wir_empfehlen_dringend_vor_dem": "Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.",
            "backup_herunterladen_csv": "Backup herunterladen (CSV)",
            "validierungswarnung": "Validierungswarnung",
            "möchten_sie_die_regel_trotz_de": "Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?",
            "regeln_löschen": "Regeln löschen",
            "sind_sie_sicher_dass_sie_die_a": "Sind Sie sicher, dass Sie die ausgewählten",
            "löschen_möchten_diese_aktion_k": "löschen möchten?\n              Diese Aktion kann nicht rückgängig gemacht werden.",
            "hinweis": "Hinweis:",
            "es_werden_nur_die_auf_der_aktu": "Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht.",
            "validierungsfehler": "Validierungsfehler",
            "die_einstellungen_konnten_aufg": "Die Einstellungen konnten aufgrund folgender Fehler nicht gespeichert werden:",
            "verstanden": "Verstanden",
            "statistik_limitierung_ändern": "Statistik-Limitierung ändern?",
            "sie_ändern_das_limit_für_stati": "Sie ändern das Limit für Statistik-Einträge von",
            "auf": "auf",
            "wenn_aktuell_mehr_als": "Wenn aktuell mehr als",
            "einträge_vorhanden_sind_aktuel": "Einträge vorhanden sind (aktuell:",
            "werden_die_ältesten_einträge_b": "), werden die ältesten Einträge beim\n              Speichern",
            "unwiderruflich_gelöscht": "unwiderruflich gelöscht",
            "verstanden_speichern": "Verstanden & Speichern",
            "validierung_neu_laden": "Validierung neu laden?",
            "sie_haben_eine_regel_geändert_": "Sie haben eine Regel geändert. Möchten Sie die Konfigurationsvalidierung mit den neuen Einstellungen neu laden?",
            "nein": "Nein",
            "ja_neu_laden": "Ja, neu laden",
            "alle_regeln_löschen_1": "Alle Regeln löschen?",
            "dies_löscht_alle_vorhandenen_r": "Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.",
            "backup_herunterladen_json": "Backup herunterladen (JSON)",
            "administrator_passwort_eingebe": "Administrator-Passwort eingeben",
            "smart_redirect_service": "Smart Redirect Service",
            "ffffff": "#ffffff",
            "url_veraltet_aktualisierung_er": "URL veraltet - Aktualisierung erforderlich",
            "du_verwendest_einen_alten_link": "Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen.",
            "zeige_mir_die_neue_url": "Zeige mir die neue URL",
            "https_thisisthenewurl_com": "https://thisisthenewurl.com/",
            "https_newapp_com_q": "https://newapp.com/?q=",
            "file": "[?&]file=([^&]+)",
            "teams_regex": "/teams (Regex)",
            "fügt_eine_beispiel_regex_hinzu": "Fügt eine Beispiel-Regex hinzu",
            "proudly_brewed_with_generative": "Proudly brewed with Generative AI.",
            "war_die_neue_url_korrekt": "War die neue URL korrekt?",
            "dein_feedback_hilft_uns_die_we": "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
            "vielen_dank_für_deine_rückmeld": "Vielen Dank für deine Rückmeldung.",
            "ja_ok": "Ja, OK",
            "regeln_durchsuchen": "Regeln durchsuchen...",
            "regeln_durchsuchen_1": "Regeln durchsuchen",
            "einträge_suchen": "Einträge suchen...",
            "statistiken_durchsuchen": "Statistiken durchsuchen",
            "regel_filter": "Regel-Filter",
            "qualität": "Qualität",
            "feedback": "Feedback",
            "news_beitrag": "/news-beitrag",
            "nachrichtenbeiträge_wurden_mig": "Nachrichtenbeiträge wurden migriert...",
            "alte_seite": "/alte-seite",
            "neue_seite_leer_löschen": "/neue-seite (leer = löschen)",
            "source": "source",
            "migration": "migration",
            "nicht_kodieren_no_url_encoding": "Nicht kodieren (No URL Encoding)",
            "nach_oben": "Nach oben",
            "nach_unten": "Nach unten",
            "file_1": "file",
            "f": "f",
            "tippen_sie_delete_zur_bestätig": "Tippen Sie \"DELETE\" zur Bestätigung",
            "ip_adresse_z_b_192_168_1_1": "IP-Adresse (z.B. 192.168.1.1)",
            "erfolgreich_angemeldet": "Erfolgreich angemeldet",
            "willkommen_im_administrator_be": "Willkommen im Administrator-Bereich.",
            "anmeldung_fehlgeschlagen": "Anmeldung fehlgeschlagen",
            "regel_erstellt": "Regel erstellt",
            "die_url_regel_wurde_erfolgreic": "Die URL-Regel wurde erfolgreich erstellt.",
            "authentifizierung_erforderlich": "Authentifizierung erforderlich",
            "bitte_melden_sie_sich_erneut_a": "Bitte melden Sie sich erneut an.",
            "regel_aktualisiert": "Regel aktualisiert",
            "die_url_regel_wurde_erfolgreic_1": "Die URL-Regel wurde erfolgreich aktualisiert.",
            "regel_gelöscht": "Regel gelöscht",
            "1_regel_wurde_erfolgreich_gelö": "1 Regel wurde erfolgreich gelöscht.",
            "fehler_1": "Fehler",
            "die_regel_konnte_nicht_gelösch": "Die Regel konnte nicht gelöscht werden.",
            "alle_statistiken_gelöscht": "Alle Statistiken gelöscht",
            "alle_tracking_daten_wurden_erf": "Alle Tracking-Daten wurden erfolgreich gelöscht.",
            "blockierte_ips_gelöscht": "Blockierte IPs gelöscht",
            "alle_blockierten_ip_adressen_w": "Alle blockierten IP-Adressen wurden erfolgreich gelöscht.",
            "ip_blockiert": "IP blockiert",
            "die_ip_adresse_wurde_erfolgrei": "Die IP-Adresse wurde erfolgreich blockiert.",
            "ip_entsperrt": "IP entsperrt",
            "die_ip_adresse_wurde_erfolgrei_1": "Die IP-Adresse wurde erfolgreich entsperrt.",
            "teilweise_gelöscht": "Teilweise gelöscht",
            "regeln_gelöscht": "Regeln gelöscht",
            "fehler_beim_löschen": "Fehler beim Löschen",
            "fehler_beim_speichern": "Fehler beim Speichern",
            "import_erfolgreich": "Import erfolgreich",
            "die_einstellungen_wurden_erfol": "Die Einstellungen wurden erfolgreich importiert.",
            "import_fehlgeschlagen": "Import fehlgeschlagen",
            "die_einstellungen_konnten_nich": "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
            "die_url_regel_wurde_trotz_warn": "Die URL-Regel wurde trotz Warnung erfolgreich erstellt.",
            "die_regel_konnte_auch_mit_forc": "Die Regel konnte auch mit Force-Option nicht erstellt werden.",
            "die_url_regel_wurde_trotz_warn_1": "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert.",
            "die_regel_konnte_auch_mit_forc_1": "Die Regel konnte auch mit Force-Option nicht aktualisiert werden.",
            "keine_gültigen_regeln_ausgewäh": "Keine gültigen Regeln ausgewählt",
            "keine_der_ausgewählten_regeln_": "Keine der ausgewählten Regeln befinden sich auf der aktuellen Seite.",
            "warnung_ungültige_auswahl_erka": "Warnung: Ungültige Auswahl erkannt",
            "sicherheitsfehler": "Sicherheitsfehler",
            "export_erfolgreich": "Export erfolgreich",
            "export_fehlgeschlagen": "Export fehlgeschlagen",
            "die_daten_konnten_nicht_export": "Die Daten konnten nicht exportiert werden.",
            "einstellungen_gespeichert": "Einstellungen gespeichert",
            "die_allgemeinen_einstellungen_": "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert.",
            "erfolgreich_abgemeldet": "Erfolgreich abgemeldet",
            "sie_wurden_erfolgreich_abgemel": "Sie wurden erfolgreich abgemeldet.",
            "abmeldung_fehlgeschlagen": "Abmeldung fehlgeschlagen",
            "vorschau_fehlgeschlagen": "Vorschau fehlgeschlagen",
            "import_mit_validierungsfehlern": "Import mit Validierungsfehlern",
            "datei_zu_groß": "Datei zu groß",
            "die_import_datei_ist_zu_groß_b": "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei).",
            "cache_neu_aufgebaut": "Cache neu aufgebaut",
            "der_regel_cache_wurde_erfolgre": "Der Regel-Cache wurde erfolgreich neu erstellt.",
            "fehler_beim_cache_neuaufbau": "Fehler beim Cache-Neuaufbau",
            "alle_regeln_gelöscht": "Alle Regeln gelöscht",
            "alle_url_regeln_wurden_erfolgr": "Alle URL-Regeln wurden erfolgreich gelöscht.",
            "import_fehler": "Import Fehler",
            "konnte_die_vollständigen_daten": "Konnte die vollständigen Daten für den Import nicht laden.",
            "dateifehler": "Dateifehler",
            "die_import_datei_konnte_nicht_": "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
            "die_datei_darf_maximal_5mb_gro": "Die Datei darf maximal 5MB groß sein.",
            "logo_hochgeladen": "Logo hochgeladen",
            "das_header_logo_wurde_erfolgre": "Das Header-Logo wurde erfolgreich aktualisiert.",
            "fehler_beim_hochladen": "Fehler beim Hochladen",
            "das_logo_konnte_nicht_hochgela": "Das Logo konnte nicht hochgeladen werden.",
            "logo_entfernt": "Logo entfernt",
            "das_header_logo_wurde_erfolgre_1": "Das Header-Logo wurde erfolgreich entfernt.",
            "das_logo_konnte_nicht_entfernt": "Das Logo konnte nicht entfernt werden.",
            "die_globalen_regeln_wurden_erf": "Die globalen Regeln wurden erfolgreich aktualisiert.",
            "url_wird_analysiert": "URL wird analysiert...",
            "klicken_zum_kopieren": "Klicken zum Kopieren",
            "url_erfolgreich_in_die_zwische": "URL erfolgreich in die Zwischenablage kopiert!",
            "v": "v",
            "überspringen": "Überspringen",
            "neue_url_in_neuem_tab_öffnen": "Neue URL in neuem Tab öffnen",
            "kopieren_fehlgeschlagen": "Kopieren fehlgeschlagen",
            "bitte_kopieren_sie_die_url_man": "Bitte kopieren Sie die URL manuell.",
            "404_page_not_found": "404 Page Not Found",
            "did_you_forget_to_add_the_page": "Did you forget to add the page to the router?",
            "globale_regeln": "Globale Regeln",
            "diese_regeln_werden_auf_alle_w": "Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).\n                    Spezifische Regeln überschreiben diese globalen Einstellungen.",
            "globales_suchen_ersetzen": "Globales Suchen & Ersetzen",
            "ersetzen_sie_text_in_der_ziel_": "Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.",
            "reihenfolge_global_hier_rarr_r": "Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.",
            "globale_statische_parameter": "Globale Statische Parameter",
            "parameter_die_immer_angehängt_": "Parameter, die immer angehängt werden (z.B. ?source=migration).",
            "wenn_eine_regel_denselben_para": "Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.",
            "globale_parameter_übernahme_wh": "Globale Parameter-Übernahme (Whitelist)",
            "parameter_die_bei_aktivierter_": "Parameter, die bei aktivierter \"Parameter entfernen\" Option (in einer Regel) trotzdem behalten werden.",
            "wird_zusätzlich_zu_den_regel_s": "Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.",
            "key_pattern_regex": "Key Pattern (Regex)",
            "value_pattern_opt": "Value Pattern (Opt.)",
            "neuer_name_opt": "Neuer Name (Opt.)",
            "beispiel_file": "Beispiel (file)",
            "alte_pfade": "/alte-pfade",
            "neue_pfade": "/neue-pfade",
            "utm_source": "utm_source",
            "migration_tool": "migration_tool",
            "nicht_kodieren_raw": "Nicht kodieren (Raw)",
            "id_lang": "id|lang",
            "new_id": "new_id",
            "query_parameters": "Query Parameters",
            "mode": "Mode:",
            "kept_params_exceptions": "Kept Params (Exceptions):",
            "rarr": "&rarr;",
            "static_params_appended": "Static Params (Appended):",
            "search_replace_1": "Search & Replace",
            "case_sensitive": "Case Sensitive",
            "keine_suchen_ersetzen_regeln": "Keine Suchen & Ersetzen Regeln.",
            "info_beschreibung": "Info / Beschreibung",
            "status": "Status",
            "ziel_url": "Ziel-URL",
            "typ": "Typ",
            "auto_1": "Auto",
            "erstellt_am": "Erstellt am",
            "das_auswählen_und_löschen_mehr": "Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.",
            "params_entfernen": "Params Entfernen",
            "params_behalten": "Params Behalten",
            "regel_löschen": "Regel löschen",
            "sind_sie_sicher_dass_sie_diese": "Sind Sie sicher, dass Sie diese Regel löschen möchten?\n                      Diese Aktion kann nicht rückgängig gemacht werden.",
            "ziel_url_1": "Ziel-URL:",
            "automatisch_generiert": "Automatisch generiert",
            "info_text": "Info-Text:",
            "erstellt": "Erstellt:",
            "bearbeiten": "Bearbeiten",
            "regel_bearbeiten": "Regel bearbeiten",
            "expand_all": "Expand All",
            "collapse_all": "Collapse All",
            "erstellt_1": "Erstellt",
            "action": "Action",
            "on": "On",
            "sind_sie_sicher": "Sind Sie sicher?",
            "parameter_konfiguration": "Parameter Konfiguration",
            "handling_mode": "Handling Mode:",
            "ausnahmen_kept": "Ausnahmen (Kept):",
            "statische_parameter": "Statische Parameter:",
            "keine": "Keine.",
            "alle_regeln_auf_dieser_seite_a": "Alle Regeln auf dieser Seite auswählen/abwählen",
            "nicht_genügend_daten_für_trend": "Nicht genügend Daten für Trendanzeige",
            "match_quality": "Match Quality",
            "feedback_inkl_auto": "Feedback (inkl. Auto)",
            "match": "Match:",
            "score": "Score:",
            "total": "Total:",
            "ok_1": "(OK:",
            "auto_2": ", Auto:",
            "nok_1": ", NOK:",
            "spalten_anpassen": "Spalten anpassen",
            "spalten_auswählen": "Spalten auswählen",
            "zeitstempel": "Zeitstempel",
            "alte_url": "Alte URL",
            "neue_url": "Neue URL",
            "pfad": "Pfad",
            "referrer": "Referrer",
            "regel": "Regel",
            "n_a": "N/A",
            "smart_search": "Smart Search",
            "domain_redirect": "Domain Redirect",
            "regel_nicht_mehr_vorhanden": "Regel nicht mehr vorhanden",
            "gelöscht": "Gelöscht",
            "api_1": "API",
            "vorschlag": "Vorschlag:",
            "intelligente_suche_fallback": "Intelligente Suche (Fallback)",
            "standard_domain_weiterleitung_": "Standard Domain-Weiterleitung (Fallback)",
            "api_call": "API Call",
            "übersetzungen_für_die_anwendun": "Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.",
            "speichern": "Speichern",
            "schlüssel_key": "Schlüssel (Key)",
            "wert_value": "Wert (Value)",
            "sprache_auswählen": "Sprache auswählen",
            "neuer_schlüssel": "Neuer Schlüssel...",
            "wert": "Wert...",
            "erfolg": "Erfolg",
            "übersetzungen_gespeichert": "Übersetzungen gespeichert.",
            "konnte_übersetzungen_nicht_spe": "Konnte Übersetzungen nicht speichern.",
            "old": "Old:",
            "new": "New:",
            "ergebnis_analyse": "Ergebnis-Analyse",
            "original": "Original:",
            "smart_search_fallback": "Smart Search Fallback:",
            "weiterleitung_zur_suche_da_kei": "Weiterleitung zur Suche, da keine Regel passte.",
            "angewandte_regel": "Angewandte Regel",
            "id_1": "ID:",
            "matcher_1": "Matcher:",
            "ziel": "Ziel:",
            "typ_1": "Typ:",
            "parameter_werden_verworfen": "Parameter werden verworfen",
            "keine_spezifische_regel_gefund": "Keine spezifische Regel gefunden (Fallback).",
            "angewandte_globale_regeln": "Angewandte Globale Regeln",
            "keine_globalen_regeln_angewend": "Keine globalen Regeln angewendet",
            "verarbeitungsschritte": "Verarbeitungsschritte",
            "testen_sie_ihre_regeln_mit_ein": "Testen Sie Ihre Regeln mit einer Liste von URLs. Importieren Sie eine CSV/Excel-Datei oder fügen Sie URLs ein.",
            "text_einfügen": "Text einfügen",
            "datei_hochladen": "Datei hochladen",
            "urls_einfügen_durch_komma_semi": "URLs einfügen (durch Komma, Semikolon oder neue Zeile getrennt)",
            "leerzeichen_nach_trennzeichen_": "Leerzeichen nach Trennzeichen werden automatisch entfernt.",
            "unterstützt_csv_xlsx_xls_nur_e": "Unterstützt CSV, XLSX, XLS (nur erste Spalte wird verwendet)",
            "ausgewählt": "Ausgewählt",
            "hinweis_1": "Hinweis",
            "verarbeite_urls": "Verarbeite URLs...",
            "ergebnisse": "Ergebnisse",
            "neu_berechnen": "Neu berechnen",
            "csv_export": "CSV Export",
            "neue_suche": "Neue Suche",
            "url_transformation": "URL Transformation",
            "rule_tag": "Rule Tag",
            "validierung_starten": "Validierung starten",
            "https_example_com_a_10_https_e": "https://example.com/a&#10;https://example.com/b",
            "alle_ausklappen": "Alle ausklappen",
            "alle_einklappen": "Alle einklappen",
            "keine_daten_zum_aktualisieren": "Keine Daten zum Aktualisieren",
            "bitte_starten_sie_den_prozess_": "Bitte starten Sie den Prozess neu.",
            "close": "Close",
            "bitte_geben_sie_das_administra_1": "Bitte geben Sie das Administrator-Passwort ein:",
            "passwort_eingeben": "Passwort eingeben",
            "link_qualität": "Link-Qualität:"
      }
};

    for (const [lang, data] of Object.entries(defaultTranslations)) {
      const normalizedLanguageCode = assertValidLanguageCode(lang);
      const existing = await TranslationModel.findByPk(normalizedLanguageCode);

      if (!existing) {
        await TranslationModel.create({ lang: normalizedLanguageCode, data });
        continue;
      }

      const existingData = existing.get('data') as Record<string, string>;
      const mergedData = mergeTranslationDictionaries(data, existingData);

      if (Object.keys(mergedData).length !== Object.keys(existingData).length) {
        await existing.update({ data: mergedData });
      }
    }
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
        await this.initTranslations();
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
      console.log('Migrating settings.json to DB...');
      const data = await fs.readFile(settingsFile, 'utf8');
      const settings = JSON.parse(data);
      if (settings && settings.id) {
         const existing = await GeneralSettingsModel.findOne();
         if (!existing) {
             await GeneralSettingsModel.create({
                id: settings.id,
                data: settings
             } as any);
         }
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


    whereClause.path = {
      [Op.notIn]: ['/', '/?admin=true', '/?logout=true']
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
      whereClause[Op.or] = [
         { ruleId: { [Op.not]: null } },
         { ruleIds: { [Op.not]: null, [Op.not]: '[]' } }
      ];
    } else if (ruleFilter === 'no_rule') {
      whereClause.ruleId = null;
      whereClause[Op.or] = [
         { ruleIds: null },
         { ruleIds: '[]' }
      ];
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
