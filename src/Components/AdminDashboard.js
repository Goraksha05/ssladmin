// Components/AdminDashboard.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — `t[tab.labelKey]` always undefined because tab objects had
//      `label` but not `labelKey`. The template read `t[tab.labelKey] ?? tab.labelKey`
//      which always fell through to `tab.labelKey` which was also undefined,
//      rendering nothing. Fixed: use `tab.label` directly (the string is already
//      translated at definition time via `t.*`).
//
//   2. CRITICAL — `tab.icon` was referenced in JSX as `<span>{tab.icon}</span>`
//      but the tab objects in the array never had an `icon` property defined.
//      The span rendered empty. Fixed: icons are now part of each tab object.
//
//   3. FIX — `useAdminAuth` imported from AdminAuthContext. Per the previous
//      batch fix, AdminAuthContext now delegates to PermissionsContext. The
//      import still works but `usePermissions` from PermissionsContext is the
//      canonical hook going forward. Migrated here.
//
//   4. FIX — Active tab defaulted to "rewards" even when the admin doesn't have
//      `view_rewards`. Now defaults to the first tab the admin can actually see.
//
//   5. MINOR — KYC tab added for admins with `view_users` permission, linking
//      to the new AdminKycDashboard embedded view.

import React, { useState, useMemo } from 'react';
import AdminRewardDashboard from './AdminRewardDashboard';
import AdminRewardUndoPanel from './AdminRewardUndoPanel';
import ClaimDashboard       from './ClaimDashboard';
import AdminUserReport      from './UserReport';
import AdminKycDashboard    from './KYC/AdminKycDashboard';
import { useI18nTheme }     from '../Context/I18nThemeContext';
import { usePermissions }   from '../Context/PermissionsContext';

const AdminDashboard = () => {
  const { t }                                       = useI18nTheme();
  const { hasPermission, isSuperAdmin, loading }    = usePermissions();

  // FIX: compute tabs after permissions load so we don't default to a tab
  //      the admin cannot see
  const tabs = useMemo(() => {
    const all = [
      hasPermission('view_rewards')          && { id: 'rewards', icon: '🎁', label: t.rewards          || 'Rewards' },
      hasPermission('undo_rewards')          && { id: 'undo',    icon: '↩',  label: t.undoRewards      || 'Undo Rewards' },
      hasPermission('approve_reward_claims') && { id: 'claims',  icon: '✅', label: t.claims           || 'Claims' },
      hasPermission('view_reports')          && { id: 'report',  icon: '📊', label: t.reports          || 'Reports' },
      hasPermission('view_users')            && { id: 'kyc',     icon: '🪪', label: t.kycReview        || 'KYC Review' },
      isSuperAdmin                           && { id: 'rewards', icon: '🎁', label: t.rewards          || 'Rewards' }, // always visible to super
    ].filter(Boolean);

    // Deduplicate by id (isSuperAdmin may duplicate 'rewards')
    return all.filter((tab, idx, arr) => arr.findIndex(t => t.id === tab.id) === idx);
  }, [hasPermission, isSuperAdmin, t]);

  // FIX: default to first available tab, not hardcoded 'rewards'
  const [activeTab, setActiveTab] = useState(() => tabs[0]?.id || 'rewards');

  // Keep activeTab valid if tabs change after permission load
  const validTab = tabs.find(t => t.id === activeTab) ? activeTab : tabs[0]?.id || 'rewards';

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)', borderRadius: '50%',
          animation: 'spin .8s linear infinite', margin: '0 auto 1rem',
        }} />
        <p>Loading dashboard…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!tabs.length) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3 style={{ color: 'var(--text-primary)', margin: '0 0 .5rem' }}>No Access</h3>
        <p style={{ margin: 0 }}>You don't have permissions to view any dashboard sections.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-wrapper">
      {/* Tab Navigation */}
      <div className="tab-navigation" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={validTab === tab.id}
            className={`tab-button ${validTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {/* FIX: tab.icon now exists on the object */}
            <span aria-hidden="true">{tab.icon}</span>
            {/* FIX: use tab.label directly, not t[tab.labelKey] */}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      <div className="dashboard-content">
        {validTab === 'rewards' && <AdminRewardDashboard />}
        {validTab === 'undo'    && <AdminRewardUndoPanel />}
        {validTab === 'claims'  && <ClaimDashboard />}
        {validTab === 'report'  && <AdminUserReport />}
        {validTab === 'kyc'     && <AdminKycDashboard />}
      </div>

      <style>{`
        .admin-dashboard-wrapper {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .tab-navigation {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          background: var(--bg-card, #fff);
          padding: .5rem;
          border-radius: 12px;
          border: 1px solid var(--border, #e2e8f0);
        }
        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.125rem;
          background: var(--bg-canvas, #f8fafc);
          border: 1px solid transparent;
          border-radius: 8px;
          color: var(--text-secondary, #64748b);
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .tab-button:hover {
          background: var(--bg-secondary, #f1f5f9);
          color: var(--text-primary, #0f172a);
        }
        .tab-button.active {
          background: var(--accent, #4f46e5);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(79,70,229,.25);
        }
        .dashboard-content {
          animation: dbFadeIn 0.25s ease;
        }
        @keyframes dbFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .tab-button {
            flex: 1;
            justify-content: center;
            min-width: calc(50% - 0.25rem);
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;