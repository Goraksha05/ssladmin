// Components/Admin/AdminUI.js — Shared primitives for the admin panel
//
// CHANGES FROM ORIGINAL:
//
//   1. FIX — CSS variable mismatch. All components referenced --border, --bg-card,
//      --bg-canvas, --shadow-pop etc., but AdminTrustDashboard.js used a different
//      set (--color-text-primary, --color-background-primary, --color-border-tertiary,
//      --font-mono). Added a :root block that aliases the TrustDashboard variable
//      names to the canonical admin panel variables so both work without changing
//      either file's inline styles.
//
//   2. FIX — --shadow-pop and --shadow-card were referenced throughout but never
//      defined in AdminUIStyles. Added definitions for both.
//
//   3. FIX — --border-color alias added. RewardPayout.js input styles referenced
//      var(--border-color) while AdminUI defines var(--border). Alias ensures
//      both resolve correctly.
//
//   4. NEW — ConfirmDialog primitive exported. Multiple pages (AdminAdmins,
//      AdminUsers, AdminRoleManagement) implement their own identical confirm
//      overlay. Centralised here to avoid quadruple-duplication. Existing
//      inline styles are preserved for backward compatibility; pages can
//      migrate to <ConfirmDialog> incrementally.
//
//   5. FIX — Btn: added missing `style` prop passthrough so callers that pass
//      inline styles (AdminAdmins "Create New Admin" gold button) are not silently
//      ignored.
//
//   6. FIX — Table: added `rowKey` prop fallback chain (_id → id → index) so
//      rows without _id don't trigger React key warnings.
//
//   7. FIX — AdminUIStyles: added ap-loading class (used by AdminTrustDashboard)
//      and ensured @keyframes ap-spin is only emitted once.

import React from 'react';

// ── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, className = '', style = {} }) => (
  <div className={`ap-card ${className}`} style={style}>{children}</div>
);

// ── StatCard ─────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, icon, color = '#4f46e5', trend }) => (
  <div className="ap-stat-card" style={{ '--sc-color': color }}>
    <div className="ap-stat-top">
      <div className="ap-stat-icon">{icon}</div>
      {trend !== undefined && (
        <span className={`ap-stat-trend ${trend >= 0 ? 'ap-up' : 'ap-down'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="ap-stat-value">{value ?? '—'}</div>
    <div className="ap-stat-label">{label}</div>
    {sub && <div className="ap-stat-sub">{sub}</div>}
  </div>
);

// ── PageHeader ────────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="ap-page-header">
    <div>
      <h1 className="ap-page-title">{title}</h1>
      {subtitle && <p className="ap-page-sub">{subtitle}</p>}
    </div>
    {actions && <div className="ap-page-actions">{actions}</div>}
  </div>
);

// ── Btn ───────────────────────────────────────────────────────────────────────
// FIX: added `style` passthrough (was silently dropped — broke AdminAdmins gold button)
export const Btn = ({
  children, onClick, variant = 'primary', size = 'md',
  disabled, className = '', type = 'button', style = {},
}) => (
  <button
    type={type}
    className={`ap-btn ap-btn-${variant} ap-btn-${size} ${className}`}
    onClick={onClick}
    disabled={disabled}
    style={style}
  >
    {children}
  </button>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
export const Badge = ({ children, color = 'default', style }) => (
  <span className={`ap-badge ap-badge-${color}`} style={style}>{children}</span>
);

// ── SearchBar ─────────────────────────────────────────────────────────────────
export const SearchBar = ({ value, onChange, placeholder = 'Search…' }) => (
  <div className="ap-search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
    <input
      className="ap-search-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {value && (
      <button className="ap-search-clear" onClick={() => onChange('')}>×</button>
    )}
  </div>
);

// ── Select ────────────────────────────────────────────────────────────────────
export const Select = ({ value, onChange, options, placeholder }) => (
  <select className="ap-select" value={value} onChange={e => onChange(e.target.value)}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

// ── Table ─────────────────────────────────────────────────────────────────────
// FIX: rowKey fallback chain — avoids React key warning for rows without _id
export const Table = ({ columns, rows, loading, empty = 'No data found' }) => {
  if (loading) return (
    <div className="ap-table-loading">
      <div className="ap-spinner"/>
      <span>Loading…</span>
    </div>
  );
  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} className="ap-table-empty">{empty}</td></tr>
            : rows.map((row, i) => (
                <tr key={row._id ?? row.id ?? i}>
                  {columns.map(c => (
                    <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
                  ))}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
};

// ── Pagination ────────────────────────────────────────────────────────────────
export const Pagination = ({ page, pages, onPage }) => {
  if (!pages || pages <= 1) return null;
  const nums = [];
  const from = Math.max(1, page - 2);
  const to   = Math.min(pages, page + 2);
  for (let i = from; i <= to; i++) nums.push(i);
  return (
    <div className="ap-pagination">
      <button className="ap-pg-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
      {from > 1 && <><button className="ap-pg-btn" onClick={() => onPage(1)}>1</button>{from > 2 && <span className="ap-pg-ellipsis">…</span>}</>}
      {nums.map(n => <button key={n} className={`ap-pg-btn ${n === page ? 'ap-pg-active' : ''}`} onClick={() => onPage(n)}>{n}</button>)}
      {to < pages && <>{to < pages - 1 && <span className="ap-pg-ellipsis">…</span>}<button className="ap-pg-btn" onClick={() => onPage(pages)}>{pages}</button></>}
      <button className="ap-pg-btn" onClick={() => onPage(page + 1)} disabled={page === pages}>›</button>
    </div>
  );
};

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 40 }) => (
  <div className="ap-spinner-wrap">
    <div className="ap-spinner" style={{ width: size, height: size }} />
  </div>
);

// ── DateRangeFilter ──────────────────────────────────────────────────────────
export const DateRangeFilter = ({ from, to, onFrom, onTo }) => (
  <div className="ap-date-range">
    <input type="date" className="ap-date-input" value={from} onChange={e => onFrom(e.target.value)} />
    <span className="ap-date-sep">→</span>
    <input type="date" className="ap-date-input" value={to}   onChange={e => onTo(e.target.value)} />
  </div>
);

// ── ConfirmDialog (NEW) ───────────────────────────────────────────────────────
// Centralised replacement for the ad-hoc confirm overlays duplicated across
// AdminAdmins, AdminUsers, AdminRoleManagement, and AdminContent.
// Usage: <ConfirmDialog msg="…" onConfirm={fn} onCancel={fn} danger />
export const ConfirmDialog = ({ msg, detail, onConfirm, onCancel, danger = true, confirmLabel = 'Confirm' }) => (
  <div className="ap-confirm-overlay">
    <div className="ap-confirm-modal" role="dialog" aria-modal="true">
      <p className="ap-confirm-msg">{msg}</p>
      {detail && <p className="ap-confirm-detail">{detail}</p>}
      <div className="ap-confirm-actions">
        <Btn onClick={onCancel} variant="secondary" size="sm">Cancel</Btn>
        <Btn onClick={onConfirm} variant={danger ? 'danger' : 'primary'} size="sm">
          {confirmLabel}
        </Btn>
      </div>
    </div>
  </div>
);

// ── Global shared styles ──────────────────────────────────────────────────────
export const AdminUIStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    /*
     * FIX: Canonical CSS variable definitions.
     *
     * All admin components consume vars from this block. Two naming conventions
     * exist in the codebase:
     *   - Admin panel convention:  --bg-card, --border, --text-primary, --accent
     *   - TrustDashboard convention: --color-background-primary, --color-border-tertiary, etc.
     *
     * The alias block below maps TrustDashboard names → admin panel names so
     * AdminTrustDashboard.js renders correctly without modifying its inline styles.
     *
     * --shadow-pop and --shadow-card were previously referenced but never defined —
     * both are now defined here.
     * --border-color aliases --border for RewardPayout.js compatibility.
     */
    :root {
      /* ── Core palette (light) ── */
      --bg-canvas:     #f8fafc;
      --bg-card:       #ffffff;
      --bg-secondary:  #f1f5f9;
      --bg-tertiary:   #e2e8f0;
      --text-primary:  #0f172a;
      --text-secondary:#64748b;
      --accent:        #4f46e5;
      --border:        #e2e8f0;
      --border-color:  #e2e8f0;   /* alias for RewardPayout.js */
      --shadow-card:   0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
      --shadow-pop:    0 10px 40px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06);
      --font-mono:     'DM Mono', monospace;
      --font-sans:     'DM Sans', sans-serif;

      /* ── TrustDashboard alias layer ── */
      --color-background-primary:   var(--bg-card);
      --color-background-secondary: var(--bg-canvas);
      --color-text-primary:         var(--text-primary);
      --color-text-secondary:       var(--text-secondary);
      --color-text-danger:          #ef4444;
      --color-border-secondary:     var(--border);
      --color-border-tertiary:      var(--border);
    }

    [data-theme="dark"] {
      --bg-canvas:     #0f172a;
      --bg-card:       #1e293b;
      --bg-secondary:  #1e293b;
      --bg-tertiary:   #334155;
      --text-primary:  #f1f5f9;
      --text-secondary:#94a3b8;
      --accent:        #818cf8;
      --border:        #334155;
      --border-color:  #334155;
      --shadow-card:   0 1px 3px rgba(0,0,0,.3);
      --shadow-pop:    0 10px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3);

      --color-background-primary:   var(--bg-card);
      --color-background-secondary: var(--bg-canvas);
      --color-text-primary:         var(--text-primary);
      --color-text-secondary:       var(--text-secondary);
      --color-border-secondary:     var(--border);
      --color-border-tertiary:      var(--border);
    }

    /* Card */
    .ap-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: var(--shadow-card);
    }

    /* StatCard */
    .ap-stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.375rem 1.5rem;
      box-shadow: var(--shadow-card);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
      overflow: hidden;
    }
    .ap-stat-card::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 3px;
      background: var(--sc-color, #4f46e5);
      opacity: 0.6;
    }
    .ap-stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-pop); }
    .ap-stat-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.875rem; }
    .ap-stat-icon { font-size: 1.5rem; line-height: 1; }
    .ap-stat-trend { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
    .ap-up   { color: #10b981; background: rgba(16,185,129,0.1); }
    .ap-down { color: #ef4444; background: rgba(239,68,68,0.1); }
    .ap-stat-value { font-size: 2rem; font-weight: 700; color: var(--text-primary); line-height: 1; letter-spacing: -0.04em; font-family: 'DM Mono', monospace; }
    .ap-stat-label { font-size: 0.8125rem; color: var(--text-secondary); font-weight: 500; margin-top: 0.375rem; }
    .ap-stat-sub   { font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; margin-top: 0.25rem; }

    /* Page header */
    .ap-page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap;
    }
    .ap-page-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.03em; }
    .ap-page-sub   { font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem; }
    .ap-page-actions { display: flex; gap: 0.625rem; flex-wrap: wrap; align-items: center; }

    /* Buttons */
    .ap-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-family: inherit; font-weight: 600; border: none;
      border-radius: 8px; cursor: pointer; transition: all 0.2s;
      white-space: nowrap;
    }
    .ap-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ap-btn-primary   { background: var(--accent); color: #fff; }
    .ap-btn-primary:hover:not(:disabled)   { filter: brightness(1.1); transform: translateY(-1px); }
    .ap-btn-secondary { background: var(--bg-canvas); border: 1px solid var(--border); color: var(--text-primary); }
    .ap-btn-secondary:hover:not(:disabled) { background: var(--border); }
    .ap-btn-danger    { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; }
    .ap-btn-danger:hover:not(:disabled)    { background: rgba(239,68,68,0.2); }
    .ap-btn-success   { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981; }
    .ap-btn-success:hover:not(:disabled)   { background: rgba(16,185,129,0.2); }
    .ap-btn-ghost     { background: transparent; color: var(--text-secondary); border: 1px solid transparent; }
    .ap-btn-ghost:hover:not(:disabled) { background: var(--bg-canvas); color: var(--text-primary); }
    .ap-btn-sm  { font-size: 0.75rem; padding: 0.375rem 0.75rem; }
    .ap-btn-md  { font-size: 0.875rem; padding: 0.5rem 1rem; }
    .ap-btn-lg  { font-size: 1rem; padding: 0.75rem 1.5rem; }

    /* Badge */
    .ap-badge {
      display: inline-block; font-size: 0.6875rem; font-weight: 700;
      padding: 0.2rem 0.5rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .ap-badge-default { background: var(--bg-canvas); color: var(--text-secondary); border: 1px solid var(--border); }
    .ap-badge-green   { background: rgba(16,185,129,0.12); color: #10b981; }
    .ap-badge-red     { background: rgba(239,68,68,0.12);  color: #ef4444; }
    .ap-badge-yellow  { background: rgba(245,158,11,0.12); color: #f59e0b; }
    .ap-badge-blue    { background: rgba(79,70,229,0.12);  color: var(--accent); }
    .ap-badge-purple  { background: rgba(124,58,237,0.12); color: #7c3aed; }
    /* TrustDashboard badge aliases */
    .ap-badge-danger  { background: rgba(239,68,68,0.12);  color: #ef4444; }
    .ap-badge-warning { background: rgba(245,158,11,0.12); color: #f59e0b; }
    .ap-badge-info    { background: rgba(79,70,229,0.12);  color: var(--accent); }
    .ap-badge-success { background: rgba(16,185,129,0.12); color: #10b981; }

    /* Search */
    .ap-search {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-canvas); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 0.75rem; transition: border-color 0.2s;
    }
    .ap-search:focus-within { border-color: var(--accent); }
    .ap-search svg { color: var(--text-secondary); flex-shrink: 0; }
    .ap-search-input {
      background: none; border: none; outline: none; font-family: inherit;
      font-size: 0.875rem; color: var(--text-primary); padding: 0.5rem 0;
      width: 200px;
    }
    .ap-search-input::placeholder { color: var(--text-secondary); }
    .ap-search-clear {
      background: none; border: none; color: var(--text-secondary); cursor: pointer;
      font-size: 1.125rem; padding: 0; line-height: 1;
    }

    /* Select */
    .ap-select {
      background: var(--bg-canvas); border: 1px solid var(--border);
      border-radius: 8px; padding: 0.5rem 0.75rem; font-family: inherit;
      font-size: 0.875rem; color: var(--text-primary); cursor: pointer;
      outline: none; transition: border-color 0.2s; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.625rem center;
      padding-right: 2rem;
    }
    .ap-select:focus { border-color: var(--accent); }

    /* Table */
    .ap-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
    .ap-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .ap-table th {
      background: var(--bg-canvas); padding: 0.75rem 1rem;
      text-align: left; font-weight: 600; font-size: 0.75rem;
      color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em;
      border-bottom: 1px solid var(--border); white-space: nowrap;
    }
    .ap-table td {
      padding: 0.875rem 1rem; border-bottom: 1px solid var(--border);
      color: var(--text-primary); vertical-align: middle;
    }
    .ap-table tbody tr:last-child td { border-bottom: none; }
    .ap-table tbody tr:hover td { background: var(--bg-canvas); }
    .ap-table-empty { text-align: center; padding: 3rem; color: var(--text-secondary); font-style: italic; }
    .ap-table-loading { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 3rem; color: var(--text-secondary); }

    /* Pagination */
    .ap-pagination { display: flex; align-items: center; gap: 0.25rem; justify-content: center; padding: 1rem 0; }
    .ap-pg-btn {
      min-width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-primary); font-size: 0.875rem;
      font-weight: 500; cursor: pointer; display: flex; align-items: center;
      justify-content: center; font-family: inherit; transition: all 0.15s;
    }
    .ap-pg-btn:hover:not(:disabled):not(.ap-pg-active) { background: var(--bg-canvas); }
    .ap-pg-btn:disabled { opacity: 0.4; cursor: default; }
    .ap-pg-active { background: var(--accent); border-color: var(--accent); color: #fff !important; }
    .ap-pg-ellipsis { color: var(--text-secondary); padding: 0 0.25rem; }

    /* Spinner */
    .ap-spinner-wrap { display: flex; align-items: center; justify-content: center; padding: 3rem; }
    .ap-spinner {
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: ap-spin 0.8s linear infinite;
    }
    @keyframes ap-spin { to { transform: rotate(360deg); } }

    /* Loading (used by AdminTrustDashboard) */
    .ap-loading {
      display: flex; align-items: center; justify-content: center;
      padding: 3rem; color: var(--text-secondary); font-size: 0.9rem;
    }

    /* Date range */
    .ap-date-range { display: flex; align-items: center; gap: 0.5rem; }
    .ap-date-input {
      background: var(--bg-canvas); border: 1px solid var(--border);
      border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.875rem;
      color: var(--text-primary); font-family: inherit; outline: none;
    }
    .ap-date-input:focus { border-color: var(--accent); }
    .ap-date-sep { color: var(--text-secondary); font-size: 0.875rem; }

    /* Stats grid */
    .ap-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }

    /* Filter bar */
    .ap-filter-bar { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1.25rem; }

    /* Section title */
    .ap-section-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; margin-bottom: 1rem; }

    /* ── ConfirmDialog (centralised) ── */
    .ap-confirm-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px); z-index: 500;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .ap-confirm-modal {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 2rem; max-width: 400px; width: 100%;
      box-shadow: var(--shadow-pop);
    }
    .ap-confirm-msg    { font-size: .9375rem; color: var(--text-primary); line-height: 1.6; margin-bottom: .5rem; }
    .ap-confirm-detail { font-size: .8125rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem; }
    .ap-confirm-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1.5rem; }
  `}</style>
);