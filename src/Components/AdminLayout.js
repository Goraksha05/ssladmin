import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";
import AdminRewardDashboard from "./AdminRewardDashboard";
import AdminRewardUndoPanel from "./AdminRewardUndoPanel";
import ClaimDashboard from "./ClaimDashboard";
import AdminUserReport from "./UserReport";
import Logo from "./XLogo/Logo";

const AdminLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(() => 
    window.innerWidth >= 768 ? true : localStorage.getItem("adminSidebarOpen") === "true"
  );
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("adminDarkMode") === "true");
  const [activeTab, setActiveTab] = useState("rewards");

  useEffect(() => {
    localStorage.setItem("adminSidebarOpen", sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem("adminDarkMode", darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/unauthorized" replace />;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { id: "rewards", icon: "📊", label: "Reward Dashboard" },
    { id: "undo", icon: "↩️", label: "Undo Rewards" },
    { id: "claims", icon: "🎁", label: "Claim Monitor" },
    { id: "users-report", icon: "👥", label: "Users Report" },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case "rewards":
        return <AdminRewardDashboard />;
      case "undo":
        return <AdminRewardUndoPanel />;
      case "claims":
        return <ClaimDashboard />;
      case "users-report":
        return <AdminUserReport />;
      default:
        return <AdminRewardDashboard />;
    }
  };

  return (
    <>
      <div className="admin-layout">
        {/* Header */}
        <header className="admin-header">
          <div className="header-left">
            <button 
              className="menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
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
              <span className="user-badge">Admin</span>
            </div>
            <button 
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </header>

        <div className="admin-body">
          {/* Sidebar */}
          <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Overlay for mobile */}
          {sidebarOpen && window.innerWidth < 768 && (
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Main Content */}
          <main className="admin-content">
            {renderActiveTab()}
          </main>
        </div>
      </div>

      <style>{`
        :root {
          --bg-primary: #ffffff;
          --bg-secondary: #f8f9fa;
          --bg-tertiary: #e9ecef;
          --text-primary: #1a1a1a;
          --text-secondary: #6c757d;
          --border-color: #dee2e6;
          --accent: #2563eb;
          --accent-hover: #1d4ed8;
          --success: #10b981;
          --danger: #ef4444;
          --warning: #f59e0b;
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          --sidebar-width: 260px;
        }

        [data-theme='dark'] {
          --bg-primary: #1a1a1a;
          --bg-secondary: #2d2d2d;
          --bg-tertiary: #3d3d3d;
          --text-primary: #ffffff;
          --text-secondary: #a0a0a0;
          --border-color: #404040;
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .admin-layout {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }

        /* Header */
        .admin-header {
          height: 64px;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .menu-toggle {
          display: none;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.5rem;
          transition: background 0.2s;
        }

        .menu-toggle:hover {
          background: var(--bg-secondary);
        }

        @media (max-width: 768px) {
          .menu-toggle {
            display: block;
          }
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand h1 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-info {
          display: none;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }

        @media (min-width: 768px) {
          .user-info {
            display: flex;
          }
        }

        .user-email {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .user-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          border-radius: 9999px;
          font-weight: 600;
        }

        .theme-toggle {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.5rem;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .theme-toggle:hover {
          background: var(--bg-tertiary);
          transform: scale(1.05);
        }

        .logout-btn {
          background: var(--danger);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logout-btn:hover {
          background: #dc2626;
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        /* Body */
        .admin-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        /* Sidebar */
        .admin-sidebar {
          width: var(--sidebar-width);
          background: var(--bg-primary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease;
        }

        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed;
            left: 0;
            top: 64px;
            bottom: 0;
            z-index: 90;
            transform: translateX(-100%);
          }

          .admin-sidebar.open {
            transform: translateX(0);
            box-shadow: var(--shadow-lg);
          }
        }

        .sidebar-nav {
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: none;
          border: none;
          border-radius: 0.75rem;
          color: var(--text-secondary);
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }

        .nav-item:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
          transform: translateX(4px);
        }

        .nav-item.active {
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: white;
          box-shadow: var(--shadow-md);
        }

        .nav-item.active:hover {
          transform: translateX(0);
        }

        .nav-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .nav-label {
          flex: 1;
        }

        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 80;
          animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Main Content */
        .admin-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .admin-content {
            padding: 1rem;
          }
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: var(--bg-secondary);
        }

        ::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: var(--text-secondary);
        }
      `}</style>
    </>
  );
};

export default AdminLayout;
