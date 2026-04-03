// src/Context/ThemeModeContext.js
//
// Owns: dark / light mode toggle, persists to localStorage, writes
// data-theme on <html> so CSS variables resolve correctly.
//
// Usage:
//   const { darkMode, setDarkMode } = useThemeMode();

import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeModeContext = createContext(null);

export const ThemeModeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("adminDarkMode") === "true"
  );

  useEffect(() => {
    localStorage.setItem("adminDarkMode", darkMode);
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  return (
    <ThemeModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useThemeMode = () => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside <ThemeModeProvider>");
  return ctx;
};