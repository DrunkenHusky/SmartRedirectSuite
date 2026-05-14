import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { DEFAULT_LANGUAGE } from '@shared/i18n';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    load: 'currentOnly',

    // Translation keys are explicit application identifiers and may contain punctuation.
    nsSeparator: false,
    keySeparator: false,

    backend: {
      loadPath: '/api/translations/{{lng}}',
    },

    detection: {
      order: ['cookie', 'navigator', 'localStorage', 'htmlTag', 'path', 'subdomain'],
      caches: ['cookie'],
      lookupCookie: 'i18next',
      cookieMinutes: 10080,
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: true,
    },
  });

export default i18n;
