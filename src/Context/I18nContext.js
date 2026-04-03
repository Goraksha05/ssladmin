// src/Context/I18nContext.js
//
// Owns: language selection, translation lookup, RTL direction.
// Theme/dark-mode has been extracted to ThemeModeContext.js.
//
// Usage:
//   const { lang, setLang, t } = useI18n();

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

// ── Language metadata ─────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: "en", label: "English",    flag: "🇬🇧", rtl: false },
  { code: "hi", label: "हिन्दी",      flag: "🇮🇳", rtl: false },
  { code: "mr", label: "मराठी",       flag: "🇮🇳", rtl: false },
  { code: "kn", label: "ಕನ್ನಡ",       flag: "🇮🇳", rtl: false },
  { code: "ta", label: "தமிழ்",       flag: "🇮🇳", rtl: false },
  { code: "ml", label: "മലയാളം",      flag: "🇮🇳", rtl: false },
  { code: "ja", label: "日本語",       flag: "🇯🇵", rtl: false },
  { code: "zh", label: "中文",         flag: "🇨🇳", rtl: false },
  { code: "ar", label: "العربية",     flag: "🇸🇦", rtl: true  },
  { code: "fr", label: "Français",    flag: "🇫🇷", rtl: false },
  { code: "de", label: "Deutsch",     flag: "🇩🇪", rtl: false },
  { code: "es", label: "Español",     flag: "🇪🇸", rtl: false },
];

// ── Translation registry ──────────────────────────────────────────────────────
const TRANSLATIONS = { en, hi, mr, kn, ta, ml, ja, zh, ar, fr, de, es };

// ── Context ───────────────────────────────────────────────────────────────────
const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(
    () => localStorage.getItem("adminLang") || "en"
  );

  // Persist language choice
  useEffect(() => {
    localStorage.setItem("adminLang", lang);
  }, [lang]);

  // Apply RTL direction to <html>
  useEffect(() => {
    const current = LANGUAGES.find(l => l.code === lang);
    document.documentElement.dir = current?.rtl ? "rtl" : "ltr";
  }, [lang]);

  // Build translation helper — memoised so consumers only re-render on lang change
  const t = useMemo(() => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    const format = (key, vars = {}) => {
      let str = dict[key] ?? key;
      Object.keys(vars).forEach(k => {
        str = str.replace(new RegExp(`{${k}}`, "g"), vars[k]);
      });
      return str;
    };

    // Spread all keys so callers can do `t.someKey` as well as `t.format("key", vars)`
    return { ...dict, format };
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
};