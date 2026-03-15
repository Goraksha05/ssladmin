// Components/Admin/AdminUsers.js — User Management
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import {
  PageHeader, Card, Btn, Badge, SearchBar, Select,
  Table, Pagination, Spinner, AdminUIStyles,
} from './AdminUI';

const PLAN_OPTIONS = [
  { value: '', label: 'All Plans' },
  { value: 'Basic',    label: 'Basic' },
  { value: 'Silver',   label: 'Silver' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Gold',     label: 'Gold' },
  { value: 'Premium',  label: 'Premium' },
];

const STATUS_OPTIONS = [
  { value: '',         label: 'All Statuses' },
  { value: 'active',   label: 'Active Sub' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'banned',   label: 'Banned' },
];

const SORT_OPTIONS = [
  { value: 'date',         label: 'Join Date' },
  { value: 'lastActive',   label: 'Last Active' },
  { value: 'name',         label: 'Name' },
  { value: 'totalReferralToken', label: 'Referrals' },
];

// ── Confirm dialog ─────────────────────────────────────────────────────────
const ConfirmModal = ({ msg, onConfirm, onCancel }) => (
  <div className="um-overlay">
    <div className="um-modal">
      <p className="um-modal-msg">{msg}</p>
      <div className="um-modal-actions">
        <Btn onClick={onCancel}  variant="secondary" size="sm">Cancel</Btn>
        <Btn onClick={onConfirm} variant="danger"    size="sm">Confirm</Btn>
      </div>
    </div>
  </div>
);

// ── User Detail Drawer ──────────────────────────────────────────────────────
const UserDrawer = ({ userId, onClose }) => {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest.get(`/api/admin/users/${userId}`)
      .then(r => setDetail(r.data))
      .catch(() => toast.error('Failed to load user details'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="um-drawer">
      <div className="um-drawer-header">
        <span>User Details</span>
        <button className="um-drawer-close" onClick={onClose}>✕</button>
      </div>
      <Spinner />
    </div>
  );

  if (!detail) return null;
  const { user, postCount, rewardClaims, referralCount } = detail;

  const rows = [
    ['Name',         user.name],
    ['Email',        user.email],
    ['Username',     user.username],
    ['Phone',        user.phone],
    ['Role',         user.role],
    ['Plan',         user.subscription?.plan || 'None'],
    ['Sub Active',   user.subscription?.active ? 'Yes' : 'No'],
    ['Sub Expires',  user.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString() : 'N/A'],
    ['Last Active',  user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'N/A'],
    ['Joined',       new Date(user.date).toLocaleDateString()],
    ['Posts',        postCount],
    ['Referrals Made', referralCount],
    ['Referral Tokens', user.totalReferralToken ?? 0],
    ['Bank Details', user.bankDetails?.accountNumber ? '✓ Provided' : '✗ Not set'],
    ['Banned',       user.banned ? 'Yes' : 'No'],
  ];

  return (
    <div className="um-drawer">
      <div className="um-drawer-header">
        <div className="um-drawer-title">
          <div className="um-drawer-avatar">{(user.name?.[0] || 'U').toUpperCase()}</div>
          <div>
            <div className="um-drawer-name">{user.name}</div>
            <div className="um-drawer-email">{user.email}</div>
          </div>
        </div>
        <button className="um-drawer-close" onClick={onClose}>✕</button>
      </div>
      <div className="um-drawer-body">
        <div className="um-detail-grid">
          {rows.map(([k, v]) => (
            <div key={k} className="um-detail-row">
              <span className="um-detail-key">{k}</span>
              <span className="um-detail-val">{v ?? '—'}</span>
            </div>
          ))}
        </div>

        {rewardClaims?.length > 0 && (
          <>
            <div className="um-drawer-section">Recent Reward Claims</div>
            <div className="um-claims-list">
              {rewardClaims.slice(0, 10).map((c, i) => (
                <div key={i} className="um-claim-row">
                  <span className="um-claim-type">{c.type}</span>
                  <span className="um-claim-milestone">{c.milestone}</span>
                  <span className="um-claim-date">{new Date(c.claimedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const AdminUsers = () => {
  const navigate = useNavigate();

  const [users,      setUsers]      = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [plan,       setPlan]       = useState('');
  const [status,     setStatus]     = useState('');
  const [sortBy,     setSortBy]     = useState('date');
  const [sortOrder,  setSortOrder]  = useState('desc');
  const [page,       setPage]       = useState(1);
  const [confirm,    setConfirm]    = useState(null); // { msg, onConfirm }
  const [drawerUser, setDrawerUser] = useState(null);

  const searchTimer = useRef(null);

  const fetchUsers = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 20,
        ...(search && { search }),
        ...(plan   && { plan }),
        ...(status && { status }),
        sortBy, sortOrder,
      });
      const res = await apiRequest.get(`/api/admin/users?${params}`);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, plan, status, sortBy, sortOrder, page]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchUsers(1); }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search, plan, status, sortBy, sortOrder]);

  useEffect(() => { fetchUsers(page); }, [page]);

  const doAction = async (userId, action, label) => {
    setConfirm({
      msg: `${label} this user?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiRequest.patch(`/api/admin/users/${userId}/status`, { action });
          toast.success(`User ${action}d`);
          fetchUsers(page);
        } catch { toast.error(`Failed to ${action} user`); }
      },
    });
  };

  const doDelete = (userId) => {
    setConfirm({
      msg: 'Permanently delete this user? This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiRequest.delete(`/api/admin/users/${userId}`);
          toast.success('User deleted');
          fetchUsers(page);
        } catch { toast.error('Failed to delete user'); }
      },
    });
  };

  const doResetRewards = (userId) => {
    setConfirm({
      msg: 'Reset all rewards for this user?',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiRequest.post(`/api/admin/users/${userId}/reset-rewards`);
          toast.success('Rewards reset');
        } catch { toast.error('Failed to reset rewards'); }
      },
    });
  };

  const columns = [
    {
      key: 'name', label: 'User',
      render: u => (
        <div className="um-user-cell">
          <div className="um-avatar">{(u.name?.[0] || 'U').toUpperCase()}</div>
          <div>
            <div className="um-name">{u.name}</div>
            <div className="um-email">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'subscription', label: 'Plan',
      render: u => u.subscription?.plan
        ? <Badge color="blue">{u.subscription.plan}</Badge>
        : <Badge color="default">None</Badge>,
    },
    {
      key: 'subscriptionActive', label: 'Sub',
      render: u => u.subscription?.active
        ? <Badge color="green">Active</Badge>
        : <Badge color="default">Inactive</Badge>,
    },
    {
      key: 'banned', label: 'Status',
      render: u => u.banned
        ? <Badge color="red">Banned</Badge>
        : <Badge color="green">OK</Badge>,
    },
    {
      key: 'lastActive', label: 'Last Active',
      render: u => u.lastActive ? new Date(u.lastActive).toLocaleDateString() : '—',
    },
    {
      key: 'totalReferralToken', label: 'Referrals',
      render: u => <span className="um-mono">{u.totalReferralToken ?? 0}</span>,
    },
    {
      key: 'actions', label: 'Actions',
      render: u => (
        <div className="um-actions">
          <Btn size="sm" variant="ghost" onClick={() => setDrawerUser(u._id)}>View</Btn>
          {u.banned
            ? <Btn size="sm" variant="success" onClick={() => doAction(u._id, 'unban',   'Unban')}>Unban</Btn>
            : <Btn size="sm" variant="danger"  onClick={() => doAction(u._id, 'ban',     'Ban')}>Ban</Btn>
          }
          <Btn size="sm" variant="secondary" onClick={() => doResetRewards(u._id)}>↺ Rewards</Btn>
          <Btn size="sm" variant="danger"    onClick={() => doDelete(u._id)}>Delete</Btn>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="User Management"
        subtitle={`${pagination.total?.toLocaleString() ?? '—'} total users`}
        actions={
          <Btn
            onClick={() => { setSearch(''); setPlan(''); setStatus(''); setPage(1); }}
            variant="secondary" size="sm"
          >
            Clear Filters
          </Btn>
        }
      />

      <Card style={{ marginBottom: '1rem' }}>
        <div className="ap-filter-bar">
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, username…" />
          <Select value={plan}      onChange={setPlan}      options={PLAN_OPTIONS} placeholder="All Plans" />
          <Select value={status}    onChange={setStatus}    options={STATUS_OPTIONS} placeholder="All Statuses" />
          <Select value={sortBy}    onChange={setSortBy}    options={SORT_OPTIONS} placeholder="Sort by" />
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </Btn>
        </div>
      </Card>

      <Card>
        <Table columns={columns} rows={users} loading={loading} empty="No users found" />
        <Pagination
          page={page}
          pages={pagination.pages}
          onPage={p => setPage(p)}
        />
      </Card>

      {confirm && (
        <ConfirmModal
          msg={confirm.msg}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {drawerUser && (
        <>
          <div className="um-drawer-overlay" onClick={() => setDrawerUser(null)} />
          <UserDrawer userId={drawerUser} onClose={() => setDrawerUser(null)} />
        </>
      )}

      <style>{`
        .um-user-cell  { display:flex; align-items:center; gap:.75rem; }
        .um-avatar     { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.875rem; flex-shrink:0; }
        .um-name       { font-size:.875rem; font-weight:600; color:var(--text-primary); }
        .um-email      { font-size:.75rem; color:var(--text-secondary); }
        .um-mono       { font-family:'DM Mono',monospace; font-size:.875rem; }
        .um-actions    { display:flex; gap:.375rem; flex-wrap:wrap; }

        /* Confirm Modal */
        .um-overlay    { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:400; display:flex; align-items:center; justify-content:center; }
        .um-modal      { background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:2rem; max-width:400px; width:90%; box-shadow:var(--shadow-pop); }
        .um-modal-msg  { font-size:.9375rem; color:var(--text-primary); margin-bottom:1.5rem; line-height:1.6; }
        .um-modal-actions { display:flex; gap:.75rem; justify-content:flex-end; }

        /* Drawer */
        .um-drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:300; }
        .um-drawer     { position:fixed; right:0; top:0; bottom:0; width:420px; max-width:95vw; background:var(--bg-card); border-left:1px solid var(--border); z-index:350; display:flex; flex-direction:column; box-shadow:var(--shadow-pop); animation:um-slide .25s ease; }
        @keyframes um-slide { from { transform:translateX(100%); } to { transform:translateX(0); } }
        .um-drawer-header  { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); }
        .um-drawer-title   { display:flex; align-items:center; gap:.875rem; }
        .um-drawer-avatar  { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.125rem; }
        .um-drawer-name    { font-weight:700; font-size:.9375rem; color:var(--text-primary); }
        .um-drawer-email   { font-size:.8125rem; color:var(--text-secondary); }
        .um-drawer-close   { background:var(--bg-canvas); border:1px solid var(--border); color:var(--text-secondary); width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; }
        .um-drawer-body    { flex:1; overflow-y:auto; padding:1.25rem 1.5rem; }
        .um-detail-grid    { display:grid; gap:.5rem; margin-bottom:1.5rem; }
        .um-detail-row     { display:flex; justify-content:space-between; padding:.5rem .75rem; border-radius:8px; font-size:.8125rem; }
        .um-detail-row:nth-child(odd) { background:var(--bg-canvas); }
        .um-detail-key     { color:var(--text-secondary); font-weight:500; }
        .um-detail-val     { color:var(--text-primary); font-weight:600; text-align:right; }
        .um-drawer-section { font-size:.8125rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text-secondary); margin:.75rem 0 .5rem; }
        .um-claims-list    { display:flex; flex-direction:column; gap:.375rem; }
        .um-claim-row      { display:flex; gap:.75rem; padding:.375rem .75rem; background:var(--bg-canvas); border-radius:6px; font-size:.8125rem; align-items:center; }
        .um-claim-type     { font-weight:700; color:var(--accent); text-transform:capitalize; }
        .um-claim-milestone{ flex:1; color:var(--text-primary); }
        .um-claim-date     { color:var(--text-secondary); white-space:nowrap; }
      `}</style>
    </>
  );
};

export default AdminUsers;