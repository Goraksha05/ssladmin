// Components/AdminToolbar.js
// Reusable language-picker + dark/light toggle toolbar.
// Drop this into any admin component header — no props needed.

import React, { useState, useRef, useEffect } from 'react';
import { useI18nTheme, LANGUAGES } from '../Context/I18nThemeContext';
// import NotificationBell from "../Components/Notification/NotificationBell";
// import NotificationDropdown from "../Components/Notification/NotificationDropdown";

const AdminToolbar = () => {
  const { lang, setLang, darkMode, setDarkMode, t } = useI18nTheme();
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <>
      <div className="admin-toolbar">
        {/* Language picker */}
        <div className="lang-picker" ref={dropRef}>
          <button
            className="lang-trigger"
            onClick={() => setOpen(o => !o)}
            aria-label={t.language}
            title={t.language}
          >
            <span className="lang-flag">{currentLang.flag}</span>
            <span className="lang-label">{currentLang.label}</span>
            <svg
              className={`lang-chevron ${open ? 'open' : ''}`}
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="lang-dropdown">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  className={`lang-option ${l.code === lang ? 'selected' : ''}`}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                >
                  <span className="lang-flag">{l.flag}</span>
                  <span className="lang-name">{l.label}</span>
                  {l.code === lang && (
                    <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* <div className="relative">
          <NotificationBell onClick={() => setOpen(!open)} />
          {open && <NotificationDropdown />}
        </div> */}

        {/* Theme toggle */}
        <button
          className="theme-btn"
          onClick={() => setDarkMode(d => !d)}
          aria-label={darkMode ? t.lightMode : t.darkMode}
          title={darkMode ? t.lightMode : t.darkMode}
        >
          {darkMode ? (
            /* Sun icon — clicking switches to light */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            /* Moon icon — clicking switches to dark */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span className="theme-label">{darkMode ? t.lightMode : t.darkMode}</span>
        </button>
      </div>

      <style>{`
        .admin-toolbar {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex-shrink: 0;
        }

        /* ── Language picker ── */
        .lang-picker {
          position: relative;
        }

        .lang-trigger {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.875rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .lang-trigger:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent);
        }

        .lang-flag {
          font-size: 1.1rem;
          line-height: 1;
        }

        .lang-label {
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lang-chevron {
          transition: transform 0.2s;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .lang-chevron.open {
          transform: rotate(180deg);
        }

        .lang-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          box-shadow: var(--shadow-lg);
          z-index: 1000;
          min-width: 180px;
          max-height: 320px;
          overflow-y: auto;
          padding: 0.375rem;
          animation: dropIn 0.15s ease;
        }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .lang-dropdown::-webkit-scrollbar { width: 6px; }
        .lang-dropdown::-webkit-scrollbar-track { background: transparent; }
        .lang-dropdown::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

        .lang-option {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: none;
          border: none;
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }

        .lang-option:hover {
          background: var(--bg-secondary);
        }

        .lang-option.selected {
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          color: var(--accent);
          font-weight: 600;
        }

        .lang-name {
          flex: 1;
        }

        .check-icon {
          color: var(--accent);
          flex-shrink: 0;
        }

        /* ── Theme button ── */
        .theme-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.875rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .theme-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent);
        }

        .theme-label {
          display: none;
        }

        @media (min-width: 560px) {
          .theme-label { display: inline; }
        }

        @media (max-width: 400px) {
          .lang-label { display: none; }
        }
      `}</style>
    </>
  );
};

export default AdminToolbar;