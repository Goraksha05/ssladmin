// Components/AdminLayout.js
//
// CHANGES FROM ORIGINAL:
//
//   1. FIX — window.innerWidth used inside render (SSR-unsafe + stale on resize).
//      The original used `window.innerWidth >= 768` directly in useState
//      initialiser and in the inline conditional for the mobile overlay. Both
//      are fine in a pure CRA/SPA context but the overlay condition
//      `{sidebarOpen && window.innerWidth < 768 && ...}` never re-evaluated on
//      resize. Fixed with a `useWindowWidth` hook that subscribes to the resize
//      event, and the sidebarOpen default is now also responsive.
//
//   2. FIX — AdminUIStyles not rendered in AdminLayoutInner. The layout shell
//      provides the :root CSS variable definitions via AdminUIStyles. Without
//      this, any admin page that does NOT render its own AdminUIStyles (e.g.,
//      a custom page added later) would have unstyled CSS variables. Adding
//      AdminUIStyles at the layout level means it runs once for the whole panel.
//
//   3. FIX — --shadow-pop was referenced by modal components nested under the
//      layout but the variable wasn't defined anywhere accessible. Now defined
//      in AdminUI.js :root block; the layout just needs AdminUIStyles present.
//
//   4. FIX — I18nThemeProvider wrapping: if this context doesn't exist yet it
//      would crash the entire admin panel. Wrapped in try-import pattern with
//      a fallback fragment. Note: if I18nThemeProvider is always available,
//      no change in behaviour.
//
//   5. MINOR — activeId computation: the `.find()` could return undefined when
//      the current path doesn't match any nav item (e.g., /admin/create-admin
//      while it's superOnly and the user is not super_admin). Added safe
//      fallback to empty string rather than 'dashboard' to avoid false highlights.

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { PermissionsProvider, usePermissions } from '../Context/PermissionsContext';
import Logo from './XLogo/Logo';
import { AdminUIStyles } from './Admin/AdminUI';
import './AdminLayout.css';

// Attempt to import I18nThemeProvider — graceful fallback if not yet created
let I18nThemeProvider;
try {
  I18nThemeProvider = require('../Context/I18nThemeContext').I18nThemeProvider;
} catch {
  I18nThemeProvider = ({ children }) => <>{children}</>;
}


// FIX: responsive window width hook — avoids stale window.innerWidth in render
function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

const AdminLayoutInner = () => {
  const { user, logout }                       = useAuth();
  const { hasPermission, isSuperAdmin, adminRoleName } = usePermissions();
  const navigate  = useNavigate();
  const location  = useLocation();
  const width     = useWindowWidth();
  const isMobile  = width < 768;

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    (typeof window !== 'undefined' ? window.innerWidth : 1024) >= 768
      ? true
      : localStorage.getItem('adminSidebarOpen') === 'true'
  );
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('adminDarkMode') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('adminSidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem('adminDarkMode', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const handleLogout = () => { logout(); navigate('/login'); };

  // ── Sidebar navigation items ──────────────────────────────────────────────
  const allNavItems = [
    { id: 'dashboard',    path: '/admin/dashboard',    icon: '📊', label: 'Dashboard' },
    { id: 'users',        path: '/admin/users',         icon: '👥', label: 'Users',      perm: 'view_users' },
    { id: 'rewards',      path: '/admin/rewards',       icon: '🎁', label: 'Rewards',    perm: 'view_rewards' },
    { id: 'posts',        path: '/admin/posts',         icon: '🛡️', label: 'Moderation', perm: 'moderate_posts' },
    { id: 'financial',    path: '/admin/financial',     icon: '💰', label: 'Financial',  perm: 'view_financial_reports' },
    { id: 'analytics',    path: '/admin/analytics',     icon: '📈', label: 'Analytics',  perm: 'view_analytics' },
    { id: 'audit',        path: '/admin/audit-logs',    icon: '📜', label: 'Audit Logs', perm: 'view_audit_logs' },
    { id: 'admins',       path: '/admin/admins',        icon: '👑', label: 'Admins',     perm: 'manage_admins' },
    { id: 'trust',        path: '/admin/trust',         icon: '🔍', label: 'Trust & Safety', perm: 'view_analytics' },
    {
      id: 'create-admin', path: '/admin/create-admin',  icon: '✦',  label: 'Create Admin',
      perm: null, superOnly: true, highlight: true,
    },
    {
      id: 'roles',        path: '/admin/roles',          icon: '🔑', label: 'Roles & Permissions',
      perm: null, superOnly: true,
    },
  ];

  const visibleNavItems = allNavItems.filter(item => {
    if (item.superOnly) return isSuperAdmin;
    if (item.perm)      return hasPermission(item.perm);
    return true;
  });

  // Match longest path prefix for accurate active highlight
  const activeId = visibleNavItems
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find(n => location.pathname.startsWith(n.path))?.id ?? '';

  const roleBadgeLabel = isSuperAdmin
    ? '⭐ Super Admin'
    : adminRoleName ? adminRoleName.replace(/_/g, ' ') : 'Admin';

  return (
    <div className="admin-layout">
      {/* Inject CSS variables once at layout level */}
      <AdminUIStyles />

      {/* ── Header ── */}
      <header className="admin-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="brand">
            <Logo />
            <h1>Admin Panel</h1>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
            <span className={`user-badge ${isSuperAdmin ? 'super-badge' : ''}`}>{roleBadgeLabel}</span>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(d => !d)}
            aria-label="Toggle theme"
          >
            {darkMode
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            }
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="logout-label">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="admin-body">
        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {visibleNavItems.map(item => (
              <button
                key={item.id}
                className={`nav-item${activeId === item.id ? ' active' : ''}${item.highlight ? ' nav-item-highlight' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setSidebarOpen(false);
                }}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.perm && (
                  <span className="perm-badge">{item.perm}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className={`role-chip ${isSuperAdmin ? 'role-chip-super' : ''}`}>
              {isSuperAdmin
                ? '⭐ Super Admin'
                : adminRoleName ? adminRoleName.replace(/_/g, ' ') : '🛡 Admin'
              }
            </div>
          </div>
        </aside>

        {/* FIX: mobile overlay now uses reactive `isMobile` instead of stale window.innerWidth */}
        {sidebarOpen && isMobile && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Outer wrapper: NO Navigate guards — App.js AdminRoute is the auth gate.
const AdminLayout = () => (
  <I18nThemeProvider>
    <PermissionsProvider>
      <AdminLayoutInner />
    </PermissionsProvider>
  </I18nThemeProvider>
);

export default AdminLayout;