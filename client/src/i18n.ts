import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    // fallback language if translation missing
    supportedLngs: ['en', 'de', 'it', 'es', 'fr'],

    // allow keys to be phrases having :, ., etc.
    nsSeparator: false,
    keySeparator: false,

    backend: {
      loadPath: '/api/translations/{{lng}}',
    },

    detection: {
      order: ['cookie', 'navigator', 'localStorage', 'htmlTag', 'path', 'subdomain'],
      caches: ['cookie'],
      cookieMinutes: 10080, // 7 days
    },

    interpolation: {
      escapeValue: false, // react already safes from xss
    },

    react: {
      useSuspense: true,
    }
  });

export default i18n;
