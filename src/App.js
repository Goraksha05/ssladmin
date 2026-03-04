// App.js
//
// FIX: Removed the pre-AuthProvider localStorage read that derived `isAdmin`
// before AuthProvider mounted. That read is always stale on hard refresh
// because it ran synchronously before any auth restore could happen, causing
// admin users to be routed to /login and regular users to see /admin routes.
//
// Auth-aware routing now lives inside PrivateRoot (which is a child of
// AuthProvider and therefore reads live context state).

import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './Context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import AdminLayout from './Components/AdminLayout';
import AdminDashboard from './Components/AdminDashboard';
import AdminUserReport from './Components/UserReport';
import { I18nThemeProvider } from "./Context/I18nThemeContext";

const queryClient = new QueryClient();

// ── Full-screen loading spinner ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(255,255,255,0.3)',
        borderTop: '4px solid white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
    </div>
  );
}

// ── Route guard components ────────────────────────────────────────────────────

/**
 * Redirects already-authenticated users away from public pages (login/register).
 * Admins go to /admin/dashboard, regular users go to /.
 */
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return children;
  return <Navigate to={user?.isAdmin ? '/admin/dashboard' : '/'} replace />;
}

/**
 * Requires authentication. Redirects to /login if not authenticated.
 */
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Requires admin role. Redirects non-admins to /admin/login, unauthenticated
 * users to /login.
 */
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/login" replace />;
  return children;
}

// ── Root routes (must be inside AuthProvider) ─────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

      {/* User home */}
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />

      {/* Admin — nested under AdminLayout */}
      <Route
        path="/admin"
        element={<AdminRoute><AdminLayout /></AdminRoute>}
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUserReport />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nThemeProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </Router>
        </AuthProvider>
      </I18nThemeProvider>
    </QueryClientProvider>
  );
}

export default App;