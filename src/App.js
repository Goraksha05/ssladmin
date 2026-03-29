// App.js — PRODUCTION READY

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './Context/AuthContext';
import { AdminAuthProvider } from './Context/AdminAuthContext';
import { AdminKycProvider } from './Context/AdminKycContext';
import { PermissionsProvider } from './Context/PermissionsContext';
import { PayoutProvider } from './Context/PayoutContext';
import { I18nThemeProvider } from './Context/I18nThemeContext';
import AdminRouteGuard from './Components/AdminRouteGuard';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import KycVerification from './Components/KYC/KycVerification';

// Layout
import AdminLayout from './Components/AdminLayout';

// ── Lazy Admin Pages ──────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import('./Components/AdminDashboard'));
const AdminUserReport = lazy(() => import('./Components/UserReport'));
const AdminAdmins = lazy(() => import('./Components/Admin/AdminAdmins'));
const AdminRoleManagement = lazy(() => import('./Components/Admin/AdminRoleManagement'));
const AdminAuditLogs = lazy(() => import('./Components/Admin/AdminAuditLogs'));
const AdminOverview = lazy(() => import('./Components/Admin/AdminOverview'));
const AdminRewards = lazy(() => import('./Components/Admin/AdminRewards'));
const AdminContent = lazy(() => import('./Components/Admin/AdminContent'));
const AdminFinancial = lazy(() => import('./Components/Admin/AdminFinancial'));
const RewardPayout = lazy(() => import('./Components/Admin/RewardPayout'));
const AdminLogs = lazy(() => import('./Components/Admin/AdminLogs'));
const AdminReports = lazy(() => import('./Components/Admin/AdminReports'));
const AdminTrustDashboard = lazy(() => import('./Components/Admin/AdminTrustDashboard'));
// FIX: AdminKycDashboard now exists and is properly wired
const AdminKycDashboard = lazy(() => import('./Components/KYC/AdminKycDashboard'));
const AdminCreateUser = lazy(() => import('./pages/AdminCreateUser'));

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

// FIX: renamed from AdminRoute → AdminGuard to avoid collision with the imported
//      AdminRoute component from './Components/AdminRoute/AdminRoute'.
//      FIX: added authLoading guard to prevent flash redirect on hard reload.
function AdminGuard({ children }) {
  const { isAuthenticated, authLoading, user } = useAuth();
  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // FIX: redirect non-admins to home (not /unauthorized which doesn't exist)
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

// FIX: `user?.isSuperAdmin` does not exist. AuthContext sets `role` on the user
//      object. Super admin check must use `user?.role === 'super_admin'`.
function SuperAdminRoute({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return null;
  const isSuperAdmin = user?.role === 'super_admin';
  if (!isSuperAdmin) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    // FIX: PermissionsProvider is here (inside AuthProvider) so it can call
    //      useAuth() safely. KycProvider is also here for user-facing KYC page.
    <PermissionsProvider>
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
              // FIX: AdminGuard (was AdminRoute) now has the authLoading guard
              <AdminGuard>
                {/*
                  FIX: AdminAuthProvider lives here, inside AdminGuard, so it
                  only mounts when the user is confirmed to be an admin. This
                  prevents it from fetching /api/admin/me for non-admin users.
                  AdminLayout renders the sidebar + <Outlet /> for child routes.
                */}
                <AdminAuthProvider>
                  <AdminLayout />
                </AdminAuthProvider>
              </AdminGuard>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />

            {/* DASHBOARD — no permission guard; all admins can see the overview */}
            <Route path="dashboard" element={<AdminDashboard />} />

            {/* ANALYTICS */}
            <Route path="analytics" element={
              <AdminRouteGuard permission="view_analytics">
                <AdminOverview />
              </AdminRouteGuard>
            } />

            {/* USERS */}
            <Route path="users" element={
              <AdminRouteGuard permission="view_users">
                <AdminUserReport />
              </AdminRouteGuard>
            } />

            {/* KYC — FIX: properly wired to AdminKycDashboard with permission gate */}
            <Route path="kyc" element={
              <AdminRouteGuard permission="view_users">
                <AdminKycDashboard />
              </AdminRouteGuard>
            } />

            {/* REWARDS */}
            <Route path="rewards" element={
              <AdminRouteGuard permission="view_rewards">
                <AdminRewards />
              </AdminRouteGuard>
            } />

            {/* REPORTS */}
            <Route path="reports" element={
              <AdminRouteGuard permission="view_reports">
                <AdminReports />
              </AdminRouteGuard>
            } />

            {/* FINANCIAL — FIX: split into separate routes so they don't render as siblings */}
            <Route path="financial" element={
              <AdminRouteGuard permission="view_financial_reports">
                <AdminFinancial />
              </AdminRouteGuard>
            } />

            {/* PAYOUTS — separate from financial overview */}
            <Route path="payouts" element={
              <AdminRouteGuard permission="manage_payouts">
                <PayoutProvider>
                  <RewardPayout />
                </PayoutProvider>
              </AdminRouteGuard>
            } />

            {/* CONTENT MODERATION */}
            <Route path="posts" element={
              <AdminRouteGuard permission="moderate_posts">
                <AdminContent />
              </AdminRouteGuard>
            } />

            {/* AUDIT LOGS */}
            <Route path="audit-logs" element={
              <AdminRouteGuard permission="view_audit_logs">
                <AdminAuditLogs />
              </AdminRouteGuard>
            } />

            {/* ADMIN MANAGEMENT */}
            <Route path="admins" element={
              <AdminRouteGuard permission="manage_admins">
                <AdminAdmins />
              </AdminRouteGuard>
            } />

            {/* ACTIVITY LOGS — visible to all admins */}
            <Route path="logs" element={<AdminLogs />} />

            {/* TRUST & SAFETY */}
            <Route path="trust" element={<AdminTrustDashboard />} />

            {/* ── SUPER ADMIN ONLY ── */}
            <Route path="create-admin" element={
              <SuperAdminRoute><AdminCreateUser /></SuperAdminRoute>
            } />

            <Route path="roles" element={
              <SuperAdminRoute><AdminRoleManagement /></SuperAdminRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AdminKycProvider>
    </PermissionsProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <I18nThemeProvider>
            <Router>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </Router>
          </I18nThemeProvider>
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;