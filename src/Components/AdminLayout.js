// Components/AdminLayout.js
//
// CHANGES FROM PREVIOUS VERSION:
//
//   1. SPLIT CONTEXTS — useI18nTheme() replaced with focused hooks.
//      useThemeMode() import also removed — AdminToolbar owns the toggle now.
//
//   2. Inline theme-toggle button replaced with <AdminToolbar />.
//      AdminToolbar provides both the language picker and the dark/light
//      toggle, reading directly from I18nContext and ThemeModeContext.
//      The duplicate SVG toggle code and setDarkMode call are gone.
//
//   3. All other fixes (useWindowWidth, AdminUIStyles, isMobile reactive
//      overlay, activeId safe fallback, no I18nThemeProvider re-wrap) retained.

import React, { useState, useEffect } from 'react';
import { toast } from "react-toastify";
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { PermissionsProvider, usePermissions } from '../Context/PermissionsContext';
import Logo from './XLogo/Logo';
import { AdminUIStyles } from './Admin/AdminUI';
import AdminToolbar from './AdminToolbar';
import './AdminLayout.css';
import { PayoutNotificationCenter } from './PayoutNotificationCenter';

// FIX: responsive window-width hook — avoids stale window.innerWidth in render
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
  const { user, logout } = useAuth();
  const { hasPermission, isSuperAdmin, adminRoleName } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const width = useWindowWidth();
  const isMobile = width < 768;

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    (typeof window !== 'undefined' ? window.innerWidth : 1024) >= 768
      ? true
      : localStorage.getItem('adminSidebarOpen') === 'true'
  );

  // 🔥 GLOBAL NOTIFICATION HANDLER
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.id || e.detail?.message;
      toast.info(e.detail?.message || "New notification", { toastId: id });
    };

    window.addEventListener("app:notification", handler);
    return () => window.removeEventListener("app:notification", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('adminSidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const handleLogout = () => { logout(); navigate('/login'); };

  // ── Sidebar navigation items ──────────────────────────────────────────────
  const allNavItems = [
    { id: 'dashboard', path: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'users', path: '/admin/users', icon: '👥', label: 'Users' },
    { id: 'activity-report', path: '/admin/activity-report', icon: '📋', label: 'Activity Report' },
    { id: 'posts', path: '/admin/posts', icon: '🛡️', label: 'Moderation' },
    { id: 'financial', path: '/admin/financial', icon: '💰', label: 'Financial' },
    { id: 'analytics', path: '/admin/analytics', icon: '📈', label: 'Analytics' },
    { id: 'audit', path: '/admin/audit-logs', icon: '📜', label: 'Audit Logs' },
    { id: 'admins', path: '/admin/admins', icon: '👑', label: 'Admins', },
    { id: 'trust', path: '/admin/trust', icon: '🔍', label: 'Trust & Safety' },
    { id: 'create-admin', path: '/admin/create-admin', icon: '✦', label: 'Create Admin', superOnly: true, highlight: true },
    { id: 'roles', path: '/admin/roles', icon: '🔑', label: 'Roles & Permissions', superOnly: true },
  ];

  const visibleNavItems = allNavItems.filter(item => {
    if (item.superOnly) return isSuperAdmin;
    if (item.perm) return hasPermission(item.perm);
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
          {/* AdminToolbar: language picker + theme toggle (replaces inline theme button) */}
          <AdminToolbar />
          <PayoutNotificationCenter />
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
                {item.perm && <span className="perm-badge">{item.perm}</span>}
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

        {/* FIX: mobile overlay uses reactive `isMobile` instead of stale window.innerWidth */}
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

// FIX: No longer wraps in <I18nThemeProvider> — both context providers are
// already mounted at the App root. Wrapping here again would create an isolated
// second instance and break dark-mode / language state persistence.
const AdminLayout = () => (
  <PermissionsProvider>
    <AdminLayoutInner />
  </PermissionsProvider>
);

export default AdminLayout;