import { randomUUID } from "crypto";
import type { ZodError } from "zod";
import { generalSettingsSchema, type GeneralSettings } from "./schema";

export const GENERAL_SETTING_CATEGORIES: Record<string, string> = {
  id: "metadata",
  updatedAt: "metadata",
  headerTitle: "header",
  headerIcon: "header",
  headerLogoUrl: "header",
  headerBackgroundColor: "header",
  popupMode: "display",
  mainTitle: "main_content",
  mainDescription: "main_content",
  mainBackgroundColor: "main_content",
  alertIcon: "alert",
  alertBackgroundColor: "alert",
  urlComparisonTitle: "url_comparison",
  urlComparisonIcon: "url_comparison",
  urlComparisonBackgroundColor: "url_comparison",
  oldUrlLabel: "url_comparison",
  newUrlLabel: "url_comparison",
  defaultNewDomain: "redirect_defaults",
  defaultRedirectMode: "redirect_defaults",
  defaultSearchUrl: "redirect_defaults",
  defaultSearchMessage: "redirect_defaults",
  defaultSearchSkipEncoding: "redirect_defaults",
  smartSearchRegex: "smart_search",
  smartSearchRules: "smart_search",
  enableCopyButton: "actions",
  enableOpenButton: "actions",
  newUrlClickBehavior: "actions",
  copyButtonText: "actions",
  openButtonText: "actions",
  showUrlButtonText: "actions",
  popupButtonText: "actions",
  specialHintsTitle: "special_hints",
  specialHintsDescription: "special_hints",
  specialHintsIcon: "special_hints",
  infoTitle: "additional_info",
  infoTitleIcon: "additional_info",
  infoItems: "additional_info",
  infoIcons: "additional_info",
  footerCopyright: "footer",
  caseSensitiveLinkDetection: "matching",
  encodeImportedUrls: "imports",
  autoRedirect: "redirect_defaults",
  showLinkQualityGauge: "quality",
  matchHighExplanation: "quality",
  matchMediumExplanation: "quality",
  matchLowExplanation: "quality",
  matchRootExplanation: "quality",
  matchNoneExplanation: "quality",
  enableTrackingCache: "tracking",
  maxStatsEntries: "tracking",
  enableReferrerTracking: "tracking",
  enableFeedbackSurvey: "feedback",
  feedbackSurveyTitle: "feedback",
  feedbackSurveyQuestion: "feedback",
  feedbackSuccessMessage: "feedback",
  feedbackButtonYes: "feedback",
  feedbackButtonNo: "feedback",
  enableFeedbackComment: "feedback",
  feedbackCommentTitle: "feedback",
  feedbackCommentDescription: "feedback",
  feedbackCommentPlaceholder: "feedback",
  feedbackCommentButton: "feedback",
  enableFeedbackSmartSearchFallback: "feedback",
  feedbackSmartSearchFallbackTitle: "feedback",
  feedbackSmartSearchFallbackDescription: "feedback",
  feedbackSmartSearchFallbackQuestion: "feedback",
  showSatisfactionTrend: "analytics",
  satisfactionTrendFeedbackOnly: "analytics",
  satisfactionTrendDays: "analytics",
  globalSearchAndReplace: "global_rules",
  globalStaticQueryParams: "global_rules",
  globalKeptQueryParams: "global_rules",
};

export function createDefaultGeneralSettings(): GeneralSettings {
  return {
    id: randomUUID(),
    headerTitle: "URL Migration Tool",
    headerIcon: "ArrowRightLeft",
    headerBackgroundColor: "#ffffff",
    popupMode: "active",
    mainTitle: "Veralteter Link erkannt",
    mainDescription: "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten.",
    mainBackgroundColor: "#ffffff",
    alertIcon: "AlertTriangle",
    alertBackgroundColor: "yellow",
    urlComparisonTitle: "URL-Vergleich",
    urlComparisonIcon: "ArrowRightLeft",
    urlComparisonBackgroundColor: "#ffffff",
    oldUrlLabel: "Alte URL (veraltet)",
    newUrlLabel: "Neue URL (verwenden Sie diese)",
    defaultNewDomain: "https://thisisthenewurl.com/",
    defaultRedirectMode: "domain",
    defaultSearchUrl: null,
    defaultSearchMessage: "Keine direkte Übereinstimmung gefunden. Sie werden zur Suche weitergeleitet.",
    defaultSearchSkipEncoding: false,
    smartSearchRegex: null,
    smartSearchRules: [],
    enableCopyButton: true,
    enableOpenButton: true,
    newUrlClickBehavior: "copy",
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
    caseSensitiveLinkDetection: false,
    encodeImportedUrls: true,
    autoRedirect: false,
    showLinkQualityGauge: true,
    matchHighExplanation: "Die neue URL entspricht exakt der angeforderten Seite oder ist die Startseite. Höchste Qualität.",
    matchMediumExplanation: "Die URL wurde erkannt, weicht aber leicht ab (z.B. zusätzliche Parameter).",
    matchLowExplanation: "Es wurde nur ein Teil der URL erkannt und ersetzt (Partial Match).",
    matchRootExplanation: "Startseite erkannt. Direkte Weiterleitung auf die neue Domain.",
    matchNoneExplanation: "Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet.",
    enableTrackingCache: true,
    maxStatsEntries: 0,
    enableReferrerTracking: true,
    enableFeedbackSurvey: false,
    feedbackSurveyTitle: "War die neue URL korrekt?",
    feedbackSurveyQuestion: "Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern.",
    feedbackSuccessMessage: "Vielen Dank für deine Rückmeldung.",
    feedbackButtonYes: "Ja, OK",
    feedbackButtonNo: "Nein",
    enableFeedbackComment: false,
    feedbackCommentTitle: "Kennen Sie die korrekte URL?",
    feedbackCommentDescription: "Bitte geben Sie die korrekte URL hier ein, damit wir sie korrigieren können.",
    feedbackCommentPlaceholder: "https://...",
    feedbackCommentButton: "Absenden",
    enableFeedbackSmartSearchFallback: false,
    feedbackSmartSearchFallbackTitle: "Vorschlag: Suche verwenden",
    feedbackSmartSearchFallbackDescription: "Keine passende Weiterleitung gefunden. Versuchen Sie es mit der Suche.",
    feedbackSmartSearchFallbackQuestion: "Hat dieser Link funktioniert?",
    showSatisfactionTrend: true,
    satisfactionTrendFeedbackOnly: false,
    satisfactionTrendDays: 30,
    globalSearchAndReplace: [],
    globalStaticQueryParams: [],
    globalKeptQueryParams: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getGeneralSettingCategory(key: string): string {
  return GENERAL_SETTING_CATEGORIES[key] ?? "custom";
}

function buildGeneralSettingsCandidate(
  settings: Partial<GeneralSettings>,
  defaults: GeneralSettings,
  id: string,
): GeneralSettings {
  return {
    ...defaults,
    ...settings,
    id,
    smartSearchRules: settings.smartSearchRules ?? (
      settings.smartSearchRegex ? [{ pattern: settings.smartSearchRegex, order: 0 }] : defaults.smartSearchRules
    ),
    updatedAt: settings.updatedAt ?? defaults.updatedAt,
  };
}

function getInvalidGeneralSettingsKeys(error: ZodError): Set<string> {
  const invalidKeys = new Set<string>();

  for (const issue of error.issues) {
    const [key] = issue.path;
    if (typeof key === "string" && key in GENERAL_SETTING_CATEGORIES) {
      invalidKeys.add(key);
    }
  }

  if (invalidKeys.has("defaultSearchUrl")) {
    invalidKeys.add("defaultRedirectMode");
  }

  return invalidKeys;
}

export function normalizeGeneralSettings(settings: Partial<GeneralSettings>, id: string): GeneralSettings {
  const defaults = createDefaultGeneralSettings();
  const knownSettings = Object.fromEntries(
    Object.entries(settings).filter(([key]) => key in GENERAL_SETTING_CATEGORIES),
  ) as Partial<GeneralSettings>;
  const firstCandidate = buildGeneralSettingsCandidate(knownSettings, defaults, id);
  const firstResult = generalSettingsSchema.safeParse(firstCandidate);

  if (firstResult.success) {
    return firstResult.data;
  }

  const invalidKeys = getInvalidGeneralSettingsKeys(firstResult.error);
  const sanitizedSettings = Object.fromEntries(
    Object.entries(knownSettings).filter(([key]) => !invalidKeys.has(key)),
  ) as Partial<GeneralSettings>;
  const secondCandidate = buildGeneralSettingsCandidate(sanitizedSettings, defaults, id);

  return generalSettingsSchema.parse(secondCandidate);
}
