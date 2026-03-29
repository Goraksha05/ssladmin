// pages/Home.js
import React, { useState, Suspense, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { toast } from 'react-toastify';
import apiRequest from '../utils/apiRequest';
import Navbar from '../Components/Navbar';
import './Home.css';

const AdminDashboard   = React.lazy(() => import('../Components/AdminDashboard'));
const AdminRewardsPage = React.lazy(() => import('../Components/AdminRewardsPage'));
const ClaimDashboard   = React.lazy(() => import('../Components/ClaimDashboard'));
const AdminUserReport  = React.lazy(() => import('../Components/UserReport'));

// ── Spinner ───────────────────────────────────────────────────────────────────
function LargeSpinner() {
  return (
    <div className="spinner-container">
      <div className="loading-spinner">
        <div className="spinner-ring" />
        <div className="spinner-ring" />
        <div className="spinner-ring" />
        <span className="spinner-text">Loading…</span>
      </div>
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(err) { return { hasError: true, error: err }; }
  render() {
    if (this.state.hasError) return (
      <div className="error-container">
        <div className="error-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
            <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm2 30h-4v-4h4v4zm0-8h-4V14h4v12z" />
          </svg>
        </div>
        <h3>Component failed to load</h3>
        <p>{this.state.error?.message || 'An internal error occurred'}</p>
        <button className="btn-retry" onClick={() => this.setState({ hasError: false, error: null })}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'finance_admin',
    name: 'Finance Admin',
    icon: '💰',
    color: '#22c55e',
    desc: 'Financial reports, payouts & export access',
    perms: ['view_financial_reports', 'export_financial_reports', 'manage_payouts', 'view_reports', 'export_reports'],
  },
  {
    id: 'rewards_admin',
    name: 'Rewards Admin',
    icon: '🎁',
    color: '#f59e0b',
    desc: 'Manage reward slabs, claims & undo redemptions',
    perms: ['view_rewards', 'manage_rewards', 'undo_rewards', 'approve_reward_claims', 'reset_rewards'],
  },
  {
    id: 'moderator',
    name: 'Moderator',
    icon: '📝',
    color: '#3b82f6',
    desc: 'Approve, reject or delete user content',
    perms: ['moderate_posts', 'delete_posts', 'approve_posts', 'reject_posts', 'view_users'],
  },
  {
    id: 'user_manager',
    name: 'User Manager',
    icon: '👥',
    color: '#8b5cf6',
    desc: 'Ban, suspend users and reset rewards',
    perms: ['view_users', 'ban_users', 'suspend_users', 'reset_rewards'],
  },
  {
    id: 'analytics_admin',
    name: 'Analytics Admin',
    icon: '📈',
    color: '#06b6d4',
    desc: 'View & export analytics and reports',
    perms: ['view_analytics', 'view_reports', 'export_reports'],
  },
];

// const ROLE_MAP  = Object.fromEntries(ROLES.map(r => [r.id, r]));
// const NICE      = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── Admin Management Panel (promote existing users to admin) ──────────────────
// Note: This panel PROMOTES existing users. To CREATE a brand-new admin account
// from scratch, super_admin should use the "Create New Admin" button which
// navigates to /admin/create-admin (AdminCreateUser page).
function AdminManagementPanel() {
  const [admins,      setAdmins]      = useState([]);
  const [dbRoles,     setDbRoles]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [email,       setEmail]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [confirmId,   setConfirmId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ar, rr] = await Promise.all([
        apiRequest.get('/api/admin/admins').catch(() => ({ data: { admins: [] } })),
        apiRequest.get('/api/admin/roles').catch(() => ({ data: { roles: [] } })),
      ]);
      setAdmins(ar.data.admins || []);
      setDbRoles(rr.data.roles || []);
    } catch { toast.error('Failed to load admin data'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const effectiveRoles = ROLES.map(r => {
    const dbMatch = dbRoles.find(d => d.roleName === r.id);
    return { ...r, _id: dbMatch?._id ?? null };
  });

  const handlePromote = async () => {
    if (!email.trim()) { toast.warn('Enter an email address'); return; }
    if (!selectedRole) { toast.warn('Select a role'); return; }
    const roleObj = effectiveRoles.find(r => r.id === selectedRole);
    if (!roleObj) { toast.warn('Role not found in database — run migration first'); return; }

    setSaving(true);
    try {
      await apiRequest.post('/api/admin/admins', {
        email: email.trim(),
        roleId: roleObj._id ?? undefined,
      });
      toast.success(`${email} promoted as ${roleObj.name}`);
      setEmail('');
      setSelectedRole(null);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to promote user');
    } finally {
      setSaving(false);
    }
  };

  const handleDemote = async (admin) => {
    try {
      await apiRequest.delete(`/api/admin/admins/${admin._id}`);
      toast.success(`${admin.email} demoted`);
      setConfirmId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to demote');
    }
  };

  const getAdminRole = (admin) => {
    if (admin.role === 'super_admin') return null;
    const roleName = admin.adminRole?.roleName ?? null;
    return ROLES.find(r => r.id === roleName) ?? null;
  };

  return (
    <div className="admin-mgmt-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h2 className="panel-title">Admin Management</h2>
            <span className="super-badge-pill">⭐ Super Admin</span>
          </div>
          <p className="panel-subtitle">
            Promote existing users to admin with scoped role permissions,
            or use the <strong>Create New Admin</strong> button above to register a fresh account.
          </p>
        </div>
        {!showForm && (
          <button className="btn-promote" onClick={() => setShowForm(true)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Promote Existing User
          </button>
        )}
      </div>

      {/* Promote form */}
      {showForm && (
        <div className="promote-form-card">
          <div className="promote-form-title">Promote User to Admin</div>
          <div className="promote-form-row">
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@email.com"
              className="promote-email-input"
            />
            <div className="role-chip-row">
              {ROLES.map(r => (
                <button
                  key={r.id} type="button"
                  className={`role-chip${selectedRole === r.id ? ' role-chip-selected' : ''}`}
                  style={{ '--chip-color': r.color }}
                  onClick={() => setSelectedRole(selectedRole === r.id ? null : r.id)}
                >
                  {r.icon} {r.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-promote-submit"
                disabled={saving} onClick={handlePromote}>
                {saving ? 'Promoting…' : 'Promote'}
              </button>
              <button type="button" className="btn-cancel-promote"
                onClick={() => { setShowForm(false); setEmail(''); setSelectedRole(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin table */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading admins…</div>
      ) : admins.length === 0 ? (
        <div className="empty-admins">No admins found. Create one above.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Permissions</th><th>Last Active</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => {
                const isSuper = admin.role === 'super_admin';
                const role    = getAdminRole(admin);
                return (
                  <tr key={admin._id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{admin.name}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{admin.email}</span>
                    </td>
                    <td>
                      {isSuper ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', background: 'rgba(251,191,36,0.1)', padding: '3px 8px', borderRadius: 6 }}>⭐ Super Admin</span>
                      ) : role ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: role.color, background: `${role.color}12`, padding: '3px 8px', borderRadius: 6 }}>
                          {role.icon} {role.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#334155' }}>—</span>
                      )}
                    </td>
                    <td>
                      {isSuper ? (
                        <span style={{ fontSize: 12, color: '#475569' }}>All (*)</span>
                      ) : role ? (
                        <span style={{ fontSize: 12, color: '#475569' }}>{role.perms.length} permissions</span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#334155' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#334155', fontFamily: 'DM Mono, monospace' }}>
                        {admin.lastActive ? new Date(admin.lastActive).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td>
                      {isSuper ? (
                        <span style={{ fontSize: 11, color: '#334155' }}>Protected</span>
                      ) : confirmId === admin._id ? (
                        <div className="inline-confirm">
                          <span className="inline-confirm-text">Remove admin access?</span>
                          <button className="btn-danger-sm" onClick={() => handleDemote(admin)}>Demote</button>
                          <button className="btn-ghost-sm" onClick={() => setConfirmId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn-ghost-sm" onClick={() => setConfirmId(admin._id)}>Demote</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Home ─────────────────────────────────────────────────────────────────
function Home() {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin' || user?.isSuperAdmin;

  const reports = [
    {
      id: 'admin', name: 'Admin Control Panel',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>,
      desc: 'Reward dashboard, claim monitor & undo panel',
      color: '#4f46e5',
    },
    {
      id: 'rewards', name: 'Rewards Management',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>,
      desc: 'Configure slab rewards per plan type',
      color: '#f59e0b',
    },
    {
      id: 'claims', name: 'Claim Monitor',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" /></svg>,
      desc: 'Monitor and approve reward claim requests',
      color: '#10b981',
    },
    {
      id: 'users', name: 'User Analytics',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>,
      desc: 'Full user report with subscription & reward data',
      color: '#8b5cf6',
    },
    ...(isSuperAdmin ? [{
      id: 'manage_admins', name: 'Admin Management',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z" /></svg>,
      desc: 'Promote users, assign roles, manage permissions',
      color: '#fbbf24',
    }] : []),
  ];

  return (
    <div className="home-wrapper">
      <Navbar />
      <div className="home-container">

        {/* Welcome banner */}
        <div className="welcome-section">
          <div className="welcome-content">
            <h1 className="welcome-title">
              Welcome, <span>{user?.name || 'Admin'}</span>
            </h1>
            <p className="welcome-subtitle">
              {isSuperAdmin
                ? 'You have full system access. Create new admin accounts or promote existing users via Admin Management.'
                : 'Select a report below to access analytics and management tools.'}
            </p>
          </div>

          {/* ── Super Admin Quick Actions ─────────────────────────────────────
               "Create New Admin" button is shown HERE, after login, only to
               super_admin. It navigates to the protected /admin/create-admin
               route (AdminCreateUser page) which carries the JWT automatically.
               The old /register dual-mode approach has been removed entirely.
          ──────────────────────────────────────────────────────────────────── */}
          <div className="quick-stats">
            {isSuperAdmin && (
              <button
                className="btn-create-admin"
                onClick={() => navigate('/admin/create-admin')}
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           8,
                  padding:       '10px 18px',
                  background:    'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color:         '#1e293b',
                  border:        'none',
                  borderRadius:  10,
                  fontSize:      13,
                  fontWeight:    700,
                  cursor:        'pointer',
                  boxShadow:     '0 4px 14px rgba(251,191,36,0.35)',
                  transition:    'transform 0.15s, box-shadow 0.15s',
                  whiteSpace:    'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(251,191,36,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,191,36,0.35)'; }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Create New Admin
              </button>
            )}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Status</span>
                <span className="stat-value">Online</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Today</span>
                <span className="stat-value">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reports section */}
        <div className="reports-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Dashboard</h2>
              <p className="section-subtitle">Select a module to get started</p>
            </div>
            <button className="btn-full-admin" onClick={() => navigate('/admin')}>
              Full Admin Panel
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3l7 7-7 7-1.41-1.41L13.17 11H3V9h10.17l-4.58-4.59L10 3z" />
              </svg>
            </button>
          </div>

          <div className="report-grid">
            {reports.map((r, i) => (
              <button
                key={r.id}
                className={`report-card${selectedReport === r.id ? ' active' : ''}`}
                style={{ '--card-color': r.color, animationDelay: `${i * 0.05 + 0.05}s` }}
                onClick={() => setSelectedReport(r.id)}
              >
                <div className="report-card-header">
                  <div className="report-icon" style={{ background: `${r.color}18`, color: r.color }}>{r.icon}</div>
                  {selectedReport === r.id && <div className="active-badge">✓</div>}
                </div>
                <h3 className="report-title">{r.name}</h3>
                <p className="report-description">{r.desc}</p>
              </button>
            ))}
          </div>

          <div className="report-content">
            <ErrorBoundary>
              <Suspense fallback={<LargeSpinner />}>
                {selectedReport === null ? (
                  <div className="empty-state">
                    <div className="empty-icon">🗂️</div>
                    <h3>No module selected</h3>
                    <p>Choose a card above to load the dashboard</p>
                  </div>
                ) : selectedReport === 'admin'         ? <AdminDashboard />
                  : selectedReport === 'rewards'       ? <AdminRewardsPage />
                  : selectedReport === 'claims'        ? <ClaimDashboard />
                  : selectedReport === 'users'         ? <AdminUserReport />
                  : selectedReport === 'manage_admins' ? <AdminManagementPanel />
                  : null
                }
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;