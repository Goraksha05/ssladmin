// src/Context/I18nThemeContext.js

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

// Translation files
import en from "../translations/en.json";
import hi from "../translations/hi.json";
import mr from "../translations/mr.json";
import kn from "../translations/kn.json";
import ta from "../translations/ta.json";
import ml from "../translations/ml.json";
import ja from "../translations/ja.json";
import zh from "../translations/zh.json";
import ar from "../translations/ar.json";
import fr from "../translations/fr.json";
import de from "../translations/de.json";
import es from "../translations/es.json";

// Language metadata
export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧", rtl: false },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳", rtl: false },
  { code: "mr", label: "मराठी", flag: "🇮🇳", rtl: false },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳", rtl: false },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳", rtl: false },
  { code: "ml", label: "മലയാളം", flag: "🇮🇳", rtl: false },
  { code: "ja", label: "日本語", flag: "🇯🇵", rtl: false },
  { code: "zh", label: "中文", flag: "🇨🇳", rtl: false },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
  { code: "fr", label: "Français", flag: "🇫🇷", rtl: false },
  { code: "de", label: "Deutsch", flag: "🇩🇪", rtl: false },
  { code: "es", label: "Español", flag: "🇪🇸", rtl: false }
];

// Translation registry
const TRANSLATIONS = {
  en,
  hi,
  mr,
  kn,
  ta,
  ml,
  ja,
  zh,
  ar,
  fr,
  de,
  es
};

const I18nThemeContext = createContext();

export const I18nThemeProvider = ({ children }) => {

  // Language
  const [lang, setLang] = useState(() =>
    localStorage.getItem("adminLang") || "en"
  );

  // Theme
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem("adminDarkMode") === "true"
  );

  // Persist settings
  useEffect(() => {
    localStorage.setItem("adminLang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("adminDarkMode", darkMode);
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  // RTL handling
  useEffect(() => {
    const current = LANGUAGES.find(l => l.code === lang);
    document.documentElement.dir = current?.rtl ? "rtl" : "ltr";
  }, [lang]);

  // Translation function
  const t = useMemo(() => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    const translate = (key, vars = {}) => {
      let str = dict[key] ?? key;

      Object.keys(vars).forEach(k => {
        str = str.replace(new RegExp(`{${k}}`, "g"), vars[k]);
      });

      return str;
    };

    return {
      ...dict,
      format: translate
    };

  }, [lang]);

  const value = {
    lang,
    setLang,
    darkMode,
    setDarkMode,
    t
  };

  return (
    <I18nThemeContext.Provider value={value}>
      {children}
    </I18nThemeContext.Provider>
  );
};

// Hook
export const useI18nTheme = () => {
  const ctx = useContext(I18nThemeContext);

  if (!ctx) {
    throw new Error("useI18nTheme must be used inside <I18nThemeProvider>");
  }

  return ctx;
};