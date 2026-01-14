import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "de", // Default to German if no other language is detected or set
    debug: process.env.NODE_ENV === "development",

    backend: {
      loadPath: "/api/translations/{{lng}}",
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already safeguards against XSS
    },

    react: {
      useSuspense: false // Handle loading states manually if needed
    }
  });

export default i18n;
