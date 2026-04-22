// App.js — PRODUCTION READY

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSocketSync } from './WebSocket/useSocketSync';

import { AuthProvider, useAuth } from './Context/AuthContext';
import { AdminAuthProvider } from './Context/AdminAuthContext';
import { AdminKycProvider } from './Context/AdminKycContext';
import { PermissionsProvider } from './Context/PermissionsContext';
import { PayoutProvider } from './Context/PayoutContext';
import { PayoutNotificationProvider } from './Context/PayoutNotificationContext';
// import { NotificationProvider } from "./Context/NotificationContext";

// Split contexts — use the focused providers in the root
import { I18nProvider } from './Context/I18nContext';
import { ThemeModeProvider } from './Context/ThemeModeContext';
import AdminRouteGuard from './Components/AdminRouteGuard';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import KycVerification from './Components/KYC/KycVerification';

// Layout
import AdminLayout from './Components/AdminLayout';

// ── Lazy Admin Pages ──────────────────────────────────────────────────────────
const AdminDashboard              = lazy(() => import('./Components/AdminDashboard'));
const AdminUserReport             = lazy(() => import('./Components/UserReport'));
const AdminAdmins                 = lazy(() => import('./Components/Admin/AdminAdmins'));
const AdminRoleManagement         = lazy(() => import('./Components/Admin/AdminRoleManagement'));
const AdminAuditLogs              = lazy(() => import('./Components/Admin/AdminAuditLogs'));
const AdminOverview               = lazy(() => import('./Components/Admin/AdminOverview'));
const AdminRewards                = lazy(() => import('./Components/Admin/AdminRewards'));
const AdminContent                = lazy(() => import('./Components/Admin/AdminContent'));
const AdminFinancial              = lazy(() => import('./Components/Admin/AdminFinancial'));
const RewardPayout                = lazy(() => import('./Components/Admin/RewardPayout'));
const AdminLogs                   = lazy(() => import('./Components/Admin/AdminLogs'));
const AdminReports                = lazy(() => import('./Components/Admin/AdminReports'));
const AdminTrustDashboard         = lazy(() => import('./Components/Admin/AdminTrustDashboard'));
const AdminKycDashboard           = lazy(() => import('./Components/KYC/AdminKycDashboard'));
const AdminCreateUser             = lazy(() => import('./pages/AdminCreateUser'));
const AdminActivityReport         = lazy(() => import('./Components/Admin/AdminActivityReport'));
const WalletReport                = lazy(() => import('./Components/Admin/WalletReport'));

// ── Query Client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Page loader ───────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #e2e8f0',
        borderTopColor: '#4f46e5', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

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

function AdminGuard({ children }) {
  const { isAuthenticated, authLoading, user } = useAuth();
  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return null;
  if (user?.role !== 'super_admin') return <Navigate to="/admin/dashboard" replace />;
  return children;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

function AppRoutes() {
  useSocketSync();
  // FIX: PermissionsProvider is here — inside AuthProvider — so useAuth() is
  // available. Only one PermissionsProvider exists; the duplicate that was
  // previously also sitting in the App root has been removed.
  return (
    <PermissionsProvider>
      <PayoutNotificationProvider>
        <AdminKycProvider>
          <Routes>

            {/* ── Public ── */}
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

            {/* ── User ── */}
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/kyc" element={<PrivateRoute><KycVerification /></PrivateRoute>} />

                {/* ── Admin ── */}
                <Route
                  path="/admin"
                  element={
                    <AdminGuard>
                      <AdminAuthProvider>
                        <AdminLayout />
                      </AdminAuthProvider>
                    </AdminGuard>
                  }
                >
                      <Route index element={<Navigate to="dashboard" replace />} />

                      <Route path="dashboard" element={<AdminDashboard />} />

                      <Route path="analytics" element={
                        <AdminRouteGuard permission="view_analytics"><AdminOverview /></AdminRouteGuard>
                      } />
                      <Route path="users" element={
                        <AdminRouteGuard permission="view_users"><AdminUserReport /></AdminRouteGuard>
                      } />
                      <Route path="kyc" element={
                        <AdminRouteGuard permission="view_users"><AdminKycDashboard /></AdminRouteGuard>
                      } />
                      <Route path="rewards" element={
                        <AdminRouteGuard permission="view_rewards"><AdminRewards /></AdminRouteGuard>
                      } />
                      <Route path="activity-report" element={
                        <AdminRouteGuard permission="view_reports"><AdminActivityReport /></AdminRouteGuard>
                      } />
                      
                      {/* Wallet */}
                      <Route path="wallet-report" element={
                        <AdminRouteGuard permission="view_reports"><WalletReport /></AdminRouteGuard>
                      } />
                      
                      <Route path="reports" element={
                        <AdminRouteGuard permission="view_reports"><AdminReports /></AdminRouteGuard>
                      } />
                      <Route path="financial" element={
                        <AdminRouteGuard permission="view_financial_reports"><AdminFinancial /></AdminRouteGuard>
                      } />
                      <Route path="payouts" element={
                        <AdminRouteGuard permission="manage_payouts">
                          <PayoutProvider><RewardPayout /></PayoutProvider>
                        </AdminRouteGuard>
                      } />
                      <Route path="posts" element={
                        <AdminRouteGuard permission="moderate_posts"><AdminContent /></AdminRouteGuard>
                      } />
                      <Route path="audit-logs" element={
                        <AdminRouteGuard permission="view_audit_logs"><AdminAuditLogs /></AdminRouteGuard>
                      } />
                      <Route path="admins" element={
                        <AdminRouteGuard permission="manage_admins"><AdminAdmins /></AdminRouteGuard>
                      } />
                      <Route path="logs" element={<AdminLogs />} />
                      <Route path="trust" element={<AdminTrustDashboard />} />

                      {/* ── Super Admin only ── */}
                      <Route path="create-admin" element={<SuperAdminRoute><AdminCreateUser /></SuperAdminRoute>} />
                      <Route path="roles" element={<SuperAdminRoute><AdminRoleManagement /></SuperAdminRoute>} />
                  </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />


          </Routes>
        </AdminKycProvider>
      </PayoutNotificationProvider>
    </PermissionsProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────
// Provider order (outer → inner):
//   QueryClientProvider     — React Query cache, no auth dependency
//   ThemeModeProvider       — writes data-theme on <html>, no auth dependency
//   I18nProvider            — language + translations, no auth dependency
//   AuthProvider            — token + user object
//     AppRoutes
//       PermissionsProvider — needs useAuth(), lives inside AuthProvider
//         AdminKycProvider

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <I18nProvider>
          <AuthProvider>
            {/* <NotificationProvider> */}
              <Router>
                <Suspense fallback={<PageLoader />}>
                  <AppRoutes />
                </Suspense>
              </Router>
            {/* </NotificationProvider> */}
          </AuthProvider>
        </I18nProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}

export default App;