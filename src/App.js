// App.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './Context/AuthContext';
import Login    from './pages/Login';
import Register from './pages/Register';
import Home     from './pages/Home';
import AdminLayout from './Components/AdminLayout';
import { I18nThemeProvider } from './Context/I18nThemeContext';

const AdminDashboard      = lazy(() => import('./Components/AdminDashboard'));
const AdminUserReport     = lazy(() => import('./Components/UserReport'));
const AdminAdmins         = lazy(() => import('./Components/Admin/AdminAdmins'));
const AdminRoleManagement = lazy(() => import('./Components/Admin/AdminRoleManagement'));
const AdminAuditLogs      = lazy(() => import('./Components/Admin/AdminAuditLogs'));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
    }}>
      <div style={{
        width: 60, height: 60,
        border: '4px solid rgba(255,255,255,0.3)',
        borderTop: '4px solid white',
        borderRadius: '50%', animation: 'spin 1s linear infinite',
      }} />
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────
// Every guard returns null while authLoading=true so we NEVER redirect
// before auth state is resolved. This prevents the infinite-loop warning.

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, authLoading, user } = useAuth();
  if (authLoading) return null;
  if (!isAuthenticated) return children;
  return <Navigate to={user?.isAdmin ? '/admin/dashboard' : '/'} replace />;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  if (authLoading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, authLoading, user } = useAuth();
  if (authLoading) return null;                              // wait for hydration
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin)   return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/"         element={<PrivateRoute><Home /></PrivateRoute>} />

      {/* AdminLayout has NO auth guards — AdminRoute above is the only guard */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index            element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users"     element={<AdminUserReport />} />
        <Route path="admins"    element={<AdminAdmins />} />
        <Route path="roles"     element={<AdminRoleManagement />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        {/* No wildcard <Navigate> here — it caused the loop by matching */}
        {/* /admin/dashboard itself and re-redirecting endlessly.         */}
      </Route>

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