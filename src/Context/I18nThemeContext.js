// src/Context/I18nThemeContext.js
//
// MIGRATION SHIM — keeps all existing imports working while components
// migrate to the focused hooks:
//
//   useI18n()       from './I18nContext'
//   useThemeMode()  from './ThemeModeContext'
//
// The combined <I18nThemeProvider> and <useI18nTheme> hook below compose
// both providers / contexts so no existing call-site needs to change.
// Once every consumer has been updated you can delete this file.
// ── Combined provider (backward-compat) ───────────────────────────────────────
import React                         from "react";
import { I18nProvider, useI18n }     from "./I18nContext";
import { ThemeModeProvider, useThemeMode } from "./ThemeModeContext";

export { LANGUAGES }           from "./I18nContext";
export { I18nProvider }        from "./I18nContext";
export { useI18n }             from "./I18nContext";

export { ThemeModeProvider }   from "./ThemeModeContext";
export { useThemeMode }        from "./ThemeModeContext";


export const I18nThemeProvider = ({ children }) => (
  <ThemeModeProvider>
    <I18nProvider>
      {children}
    </I18nProvider>
  </ThemeModeProvider>
);

// Combined hook — matches original { lang, setLang, darkMode, setDarkMode, t }
export const useI18nTheme = () => {
  const { lang, setLang, t }       = useI18n();
  const { darkMode, setDarkMode }  = useThemeMode();
  return { lang, setLang, darkMode, setDarkMode, t };
};