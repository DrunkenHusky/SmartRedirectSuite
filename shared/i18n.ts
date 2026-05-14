export const DEFAULT_LANGUAGE = "en";

export const BUILT_IN_LANGUAGES = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "it", nativeName: "Italiano", englishName: "Italian" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "fr", nativeName: "Français", englishName: "French" },
] as const;

export type BuiltInLanguageCode = (typeof BUILT_IN_LANGUAGES)[number]["code"];

export type LanguageOption = {
  code: string;
  nativeName: string;
  englishName: string;
  isBuiltIn: boolean;
};

const BUILT_IN_LANGUAGE_MAP = new Map(
  BUILT_IN_LANGUAGES.map((language) => [language.code, language]),
);

const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/;

export function normalizeLanguageCode(languageCode: string): string {
  return languageCode.trim().replace(/_/g, "-").toLowerCase();
}

export function isValidLanguageCode(languageCode: string): boolean {
  return LANGUAGE_CODE_PATTERN.test(normalizeLanguageCode(languageCode));
}

export function assertValidLanguageCode(languageCode: string): string {
  const normalizedLanguageCode = normalizeLanguageCode(languageCode);

  if (!isValidLanguageCode(normalizedLanguageCode)) {
    throw new Error(
      "Language code must use a BCP 47 style value such as en, de, fr-ca, or pt-br.",
    );
  }

  return normalizedLanguageCode;
}

export function createLanguageOption(languageCode: string): LanguageOption {
  const normalizedLanguageCode = assertValidLanguageCode(languageCode);
  const builtInLanguage = BUILT_IN_LANGUAGE_MAP.get(normalizedLanguageCode);

  if (builtInLanguage) {
    return {
      code: builtInLanguage.code,
      nativeName: builtInLanguage.nativeName,
      englishName: builtInLanguage.englishName,
      isBuiltIn: true,
    };
  }

  const displayCode = normalizedLanguageCode.toUpperCase();

  return {
    code: normalizedLanguageCode,
    nativeName: displayCode,
    englishName: displayCode,
    isBuiltIn: false,
  };
}

export function createLanguageOptions(languageCodes: string[]): LanguageOption[] {
  const languageCodeSet = new Set<string>([
    ...BUILT_IN_LANGUAGES.map((language) => language.code),
    ...languageCodes.map(normalizeLanguageCode).filter(isValidLanguageCode),
  ]);

  return Array.from(languageCodeSet)
    .map(createLanguageOption)
    .sort((leftLanguage, rightLanguage) => {
      if (leftLanguage.code === DEFAULT_LANGUAGE) return -1;
      if (rightLanguage.code === DEFAULT_LANGUAGE) return 1;

      if (leftLanguage.isBuiltIn !== rightLanguage.isBuiltIn) {
        return leftLanguage.isBuiltIn ? -1 : 1;
      }

      return leftLanguage.englishName.localeCompare(rightLanguage.englishName);
    });
}

export function sanitizeTranslationPayload(
  translationData: unknown,
): Record<string, string> {
  if (!translationData || typeof translationData !== "object" || Array.isArray(translationData)) {
    throw new Error("Translation payload must be an object of string keys and string values.");
  }

  return Object.entries(translationData).reduce<Record<string, string>>(
    (sanitizedTranslations, [rawKey, rawValue]) => {
      const translationKey = rawKey.trim();

      if (!translationKey) {
        return sanitizedTranslations;
      }

      if (typeof rawValue !== "string") {
        throw new Error(`Translation value for key '${translationKey}' must be a string.`);
      }

      sanitizedTranslations[translationKey] = rawValue;
      return sanitizedTranslations;
    },
    {},
  );
}

export function mergeTranslationDictionaries(
  baseTranslations: Record<string, string>,
  customTranslations: Record<string, string>,
): Record<string, string> {
  return {
    ...baseTranslations,
    ...customTranslations,
  };
}
