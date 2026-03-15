// Components/AdminLayout.js
// IMPORTANT: This component has NO auth guards (<Navigate> redirects).
// Auth is handled entirely by <AdminRoute> in App.js.
// Having guards in both places caused "Maximum update depth exceeded" because
// both fired simultaneously before AuthContext finished hydrating.

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { PermissionsProvider, usePermissions } from '../Context/PermissionsContext';
import Logo from './XLogo/Logo';
import { I18nThemeProvider } from '../Context/I18nThemeContext';

const AdminLayoutInner = () => {
  const { user, logout }                         = useAuth();
  const { hasPermission, isSuperAdmin, adminRoleName } = usePermissions();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    window.innerWidth >= 768 ? true : localStorage.getItem('adminSidebarOpen') === 'true'
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

  const handleLogout = () => { logout(); navigate('/login'); };

  const allNavItems = [
    { id: 'dashboard', path: '/admin/dashboard',  icon: '📊', label: 'Reward Dashboard',   perm: null },
    { id: 'users',     path: '/admin/users',       icon: '👥', label: 'Users Report',        perm: 'view_users' },
    { id: 'rewards',   path: '/admin/rewards',     icon: '🎁', label: 'Rewards',             perm: 'view_rewards' },
    { id: 'posts',     path: '/admin/posts',       icon: '📝', label: 'Moderation',          perm: 'moderate_posts' },
    { id: 'financial', path: '/admin/financial',   icon: '💰', label: 'Financial',           perm: 'view_financial_reports' },
    { id: 'analytics', path: '/admin/analytics',   icon: '📈', label: 'Analytics',           perm: 'view_analytics' },
    { id: 'audit',     path: '/admin/audit-logs',  icon: '🔍', label: 'Audit Logs',          perm: 'view_audit_logs' },
    { id: 'admins',    path: '/admin/admins',      icon: '🛡️', label: 'Admin Management',   perm: 'manage_admins' },
    { id: 'roles',     path: '/admin/roles',       icon: '🔑', label: 'Roles & Permissions', perm: null, superOnly: true },
  ];

  const visibleNavItems = allNavItems.filter(item => {
    if (item.superOnly) return isSuperAdmin;
    if (item.perm)      return hasPermission(item.perm);
    return true;
  });

  const activeId =
    visibleNavItems.find(n => location.pathname.startsWith(n.path))?.id ?? 'dashboard';

  const roleBadgeLabel = isSuperAdmin
    ? '⭐ Super Admin'
    : adminRoleName ? adminRoleName.replace(/_/g, ' ') : 'Admin';

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="header-left">
          <button className="menu-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
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
          <button className="theme-toggle" onClick={() => setDarkMode(d => !d)} aria-label="Toggle theme">
            {darkMode
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="admin-body">
        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {visibleNavItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeId === item.id ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className={`role-chip ${isSuperAdmin ? 'role-chip-super' : ''}`}>
              {isSuperAdmin ? '⭐ Super Admin' : adminRoleName ? adminRoleName.replace(/_/g, ' ') : '🛡 Admin'}
            </div>
          </div>
        </aside>

        {sidebarOpen && window.innerWidth < 768 && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        :root{--bg-primary:#fff;--bg-secondary:#f8f9fa;--bg-tertiary:#e9ecef;--bg-card:#fff;--bg-canvas:#f1f5f9;--text-primary:#1a1a1a;--text-secondary:#6c757d;--border:#dee2e6;--accent:#4f46e5;--danger:#ef4444;--shadow-md:0 4px 6px -1px rgba(0,0,0,.1);--shadow-lg:0 10px 15px -3px rgba(0,0,0,.1);--shadow-card:0 1px 3px rgba(0,0,0,.06);--sidebar-width:260px}
        [data-theme=dark]{--bg-primary:#18181b;--bg-secondary:#1f1f23;--bg-tertiary:#2a2a30;--bg-card:#1f1f23;--bg-canvas:#2a2a30;--text-primary:#f4f4f5;--text-secondary:#a1a1aa;--border:#3f3f46}
        *{margin:0;padding:0;box-sizing:border-box}
        .admin-layout{height:100vh;display:flex;flex-direction:column;background:var(--bg-secondary);color:var(--text-primary);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}
        .admin-header{height:64px;background:var(--bg-primary);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;position:sticky;top:0;z-index:100}
        .header-left{display:flex;align-items:center;gap:1rem}
        .menu-toggle{display:none;background:none;border:none;color:var(--text-primary);cursor:pointer;padding:.5rem;border-radius:.5rem}
        @media(max-width:768px){.menu-toggle{display:block}}
        .brand{display:flex;align-items:center;gap:.75rem}
        .brand h1{font-size:1.25rem;font-weight:700;color:var(--text-primary)}
        .header-right{display:flex;align-items:center;gap:1rem}
        .user-info{display:none;flex-direction:column;align-items:flex-end;gap:.25rem}
        @media(min-width:768px){.user-info{display:flex}}
        .user-email{font-size:.875rem;color:var(--text-secondary)}
        .user-badge{font-size:.7rem;padding:.15rem .5rem;background:linear-gradient(135deg,var(--accent),#7c3aed);color:#fff;border-radius:9999px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
        .super-badge{background:linear-gradient(135deg,#f59e0b,#ef4444)!important}
        .theme-toggle{background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);cursor:pointer;padding:.5rem;border-radius:.5rem;display:flex;align-items:center}
        .logout-btn{background:var(--danger);color:#fff;border:none;padding:.5rem 1rem;border-radius:.5rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:.5rem;font-size:.875rem}
        .logout-btn:hover{background:#dc2626}
        .admin-body{flex:1;display:flex;overflow:hidden;position:relative}
        .admin-sidebar{width:var(--sidebar-width);background:var(--bg-primary);border-right:1px solid var(--border);display:flex;flex-direction:column;transition:transform .3s ease}
        @media(max-width:768px){.admin-sidebar{position:fixed;left:0;top:64px;bottom:0;z-index:90;transform:translateX(-100%)}.admin-sidebar.open{transform:translateX(0);box-shadow:var(--shadow-lg)}}
        .sidebar-nav{padding:1.25rem 1rem;display:flex;flex-direction:column;gap:.375rem;flex:1;overflow-y:auto}
        .nav-item{display:flex;align-items:center;gap:.75rem;padding:.8125rem 1rem;background:none;border:none;border-radius:.75rem;color:var(--text-secondary);font-size:.875rem;font-weight:500;cursor:pointer;transition:all .2s;text-align:left;width:100%}
        .nav-item:hover{background:var(--bg-secondary);color:var(--text-primary);transform:translateX(4px)}
        .nav-item.active{background:linear-gradient(135deg,var(--accent),#7c3aed);color:#fff;box-shadow:var(--shadow-md)}
        .nav-item.active:hover{transform:none}
        .nav-icon{font-size:1.125rem;flex-shrink:0;width:1.5rem;text-align:center}
        .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:80}
        .sidebar-footer{padding:1rem;border-top:1px solid var(--border)}
        .role-chip{font-size:.75rem;font-weight:700;color:var(--text-secondary);background:var(--bg-canvas);border:1px solid var(--border);border-radius:8px;padding:.4rem .75rem;text-align:center;text-transform:uppercase;letter-spacing:.05em}
        .role-chip-super{background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.12));border-color:rgba(245,158,11,.3);color:#f59e0b}
        .admin-content{flex:1;overflow-y:auto;padding:2rem;animation:slideUp .3s ease}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:768px){.admin-content{padding:1rem}}
      `}</style>
    </div>
  );
};

// Outer wrapper: NO Navigate guards here — App.js AdminRoute is the only guard.
const AdminLayout = () => (
  <I18nThemeProvider>
    <PermissionsProvider>
      <AdminLayoutInner />
    </PermissionsProvider>
  </I18nThemeProvider>
);

export default AdminLayout;