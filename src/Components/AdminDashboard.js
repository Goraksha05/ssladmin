// Components/AdminDashboard.js
//
// CHANGES FROM PREVIOUS VERSION:
//
//   1. useI18nTheme() → useI18n(). This component never used darkMode or
//      setDarkMode, so it only needs the translation hook. Importing the
//      combined hook would still work (thanks to the shim), but using the
//      focused hook is cleaner and avoids an unnecessary context subscription.
//
//   All other fixes (tab.label, tab.icon, permission-aware default tab,
//   KYC tab, deduplicated tabs, loading/empty states) are retained unchanged.

import React, { useState, useMemo } from 'react';
import AdminRewardDashboard from './AdminRewardDashboard';
import AdminRewardUndoPanel from './AdminRewardUndoPanel';
import ClaimDashboard       from './ClaimDashboard';
import AdminUserReport      from './UserReport';
import AdminKycDashboard    from './KYC/AdminKycDashboard';
import { useI18n }          from '../Context/I18nContext';
import { usePermissions }   from '../Context/PermissionsContext';

const AdminDashboard = () => {
  const { t }                                    = useI18n();
  const { hasPermission, isSuperAdmin, loading } = usePermissions();

  // Build tabs after permissions load so we don't default to a tab the admin
  // cannot see
  const tabs = useMemo(() => {
    const all = [
      hasPermission('view_rewards')          && { id: 'rewards', icon: '🎁', label: t.rewards          || 'Rewards' },
      hasPermission('undo_rewards')          && { id: 'undo',    icon: '↩',  label: t.undoRewards      || 'Undo Rewards' },
      hasPermission('approve_reward_claims') && { id: 'claims',  icon: '✅', label: t.claims           || 'Claims' },
      hasPermission('view_reports')          && { id: 'report',  icon: '📊', label: t.reports          || 'Reports' },
      hasPermission('view_users')            && { id: 'kyc',     icon: '🪪', label: t.kycReview        || 'KYC Review' },
      // Super admins always see rewards
      isSuperAdmin                           && { id: 'rewards', icon: '🎁', label: t.rewards          || 'Rewards' },
    ].filter(Boolean);

    // Deduplicate by id
    return all.filter((tab, idx, arr) => arr.findIndex(x => x.id === tab.id) === idx);
  }, [hasPermission, isSuperAdmin, t]);

  // Default to first available tab
  const [activeTab, setActiveTab] = useState(() => tabs[0]?.id || 'rewards');

  // Keep activeTab valid if tabs change after permission load
  const validTab = tabs.find(x => x.id === activeTab) ? activeTab : tabs[0]?.id || 'rewards';

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
            <span aria-hidden="true">{tab.icon}</span>
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