// Components/Admin/AdminRewards.js

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import {
  PageHeader, Card, StatCard, Btn, Badge, SearchBar, Select,
  Table, Pagination, DateRangeFilter, AdminUIStyles,
} from './AdminUI';

const COLORS = ['#4f46e5', '#7c3aed', '#10b981'];

const TYPE_OPTIONS = [
  { value: '',         label: 'All Types' },
  { value: 'referral', label: 'Referral'  },
  { value: 'post',     label: 'Post'      },
  { value: 'streak',   label: 'Streak'    },
];

const TABS = ['overview', 'claims', 'undo'];

// ── Undo Panel ───────────────────────────────────────────────────────────────
const UndoPanel = () => {
  const [users,      setUsers]      = useState([]);
  const [allRewards, setAllRewards] = useState(null);
  const [search,     setSearch]     = useState('');
  const [selUser,    setSelUser]    = useState('');
  const [undoType,   setUndoType]   = useState('');
  const [undoSlab,   setUndoSlab]   = useState('');
  const [loadingU,   setLoadingU]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // FIX: fetch with a generous limit; the search bar filters client-side
  useEffect(() => {
    apiRequest.get('/api/admin/users?limit=200&sortBy=name&sortOrder=asc')
      .then(r => setUsers(r.data.users || []))
      .catch(() => toast.error('Failed to load users'));
  }, []);

  const loadRewards = async () => {
    if (!selUser) return toast.warn('Select a user first');
    setLoadingU(true);
    try {
      const res = await apiRequest.get('/api/admin/rewards');
      setAllRewards(res.data);
    } catch {
      toast.error('Failed to load rewards');
    } finally {
      setLoadingU(false);
    }
  };

  const doUndo = async () => {
    if (!selUser || !undoType || !undoSlab) return toast.warn('Fill all fields');
    setSubmitting(true);
    try {
      await apiRequest.post('/api/admin/undo-reward', {
        userId: selUser,
        type:   undoType,
        slab:   undoSlab,
      });
      toast.success('Reward undone successfully');
      setAllRewards(null);
      setUndoType('');
      setUndoSlab('');
    } catch {
      toast.error('Failed to undo reward');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Derive available slabs from reward activity filtered by selected user + type
  const slabOptions = (() => {
    if (!allRewards || !undoType || !selUser) return [];
    const key     = `${undoType}Rewards`;
    const slabKey = undoType === 'streak' ? 'streakslab' : 'slabAwarded';
    const userRewards = (allRewards[key] || []).filter(r => r.user?._id === selUser || r.user === selUser);
    const slabs = [...new Set(userRewards.map(r => r[slabKey]).filter(Boolean))];
    return slabs.map(s => ({ value: String(s), label: String(s) }));
  })();

  const userSummary = allRewards ? {
    referral: (allRewards.referralRewards || []).filter(r => r.user?._id === selUser || r.user === selUser),
    post:     (allRewards.postRewards     || []).filter(r => r.user?._id === selUser || r.user === selUser),
    streak:   (allRewards.streakRewards   || []).filter(r => r.user?._id === selUser || r.user === selUser),
  } : null;

  return (
    <div className="rw-undo-grid">
      <Card>
        <div className="ap-section-title">Select User</div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search users…" />
        <div className="rw-user-list">
          {filtered.slice(0, 50).map(u => (
            <button key={u._id}
              className={`rw-user-btn ${selUser === u._id ? 'rw-user-selected' : ''}`}
              onClick={() => { setSelUser(u._id); setAllRewards(null); setUndoType(''); setUndoSlab(''); }}
            >
              <div className="rw-user-av">{(u.name?.[0] || 'U').toUpperCase()}</div>
              <div className="rw-user-info">
                <span className="rw-user-name">{u.name}</span>
                <span className="rw-user-email">{u.email}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="rw-empty">No users found</p>}
        </div>
      </Card>

      <div className="rw-undo-right">
        <Card style={{ marginBottom: '1rem' }}>
          <div className="ap-section-title">Load User Rewards</div>
          <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.875rem', color: 'var(--text-secondary)' }}>
              {selUser ? `User: ${users.find(u => u._id === selUser)?.name || selUser}` : 'No user selected'}
            </span>
            <Btn onClick={loadRewards} disabled={!selUser || loadingU} size="sm">
              {loadingU ? 'Loading…' : 'Load Rewards'}
            </Btn>
          </div>

          {userSummary && (
            <div className="rw-reward-info">
              {[
                ['Post Rewards',     userSummary.post,     'slabAwarded'],
                ['Referral Rewards', userSummary.referral, 'slabAwarded'],
                ['Streak Rewards',   userSummary.streak,   'streakslab'],
              ].map(([label, arr, key]) => (
                <div key={label} className="rw-slab-row">
                  <span className="rw-slab-label">{label}</span>
                  <span className="rw-slab-val">
                    {arr.length
                      ? arr.map(r => r[key]).filter(Boolean).join(', ')
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="ap-section-title">Undo a Reward</div>
          <div className="rw-undo-form">
            <Select
              value={undoType}
              onChange={v => { setUndoType(v); setUndoSlab(''); }}
              options={[
                { value: 'post',     label: 'Post Reward'     },
                { value: 'referral', label: 'Referral Reward' },
                { value: 'streak',   label: 'Streak Reward'   },
              ]}
              placeholder="Select reward type"
            />
            {undoType && (
              slabOptions.length > 0 ? (
                <Select value={undoSlab} onChange={setUndoSlab} options={slabOptions} placeholder="Select slab" />
              ) : allRewards ? (
                <p className="rw-empty" style={{ margin: 0 }}>No redeemed slabs for this type</p>
              ) : (
                <p className="rw-empty" style={{ margin: 0 }}>Load rewards first</p>
              )
            )}
            <Btn onClick={doUndo} disabled={!selUser || !undoType || !undoSlab || submitting} variant="danger" size="sm">
              {submitting ? 'Undoing…' : 'Undo Reward'}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const AdminRewards = () => {
  const [tab,       setTab]       = useState('overview');
  const [data,      setData]      = useState(null);
  const [claims,    setClaims]    = useState([]);
  const [claimPag,  setClaimPag]  = useState({ page: 1, pages: 1, total: 0 });
  const [loading,   setLoading]   = useState(true);
  const [claimPage, setClaimPage] = useState(1);
  const [claimType, setClaimType] = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  // FIX: isMounted guard prevents stale tab from overwriting active tab's state
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest.get('/api/admin/rewards');
      if (mountedRef.current) setData(res.data);
    } catch { toast.error('Failed to load rewards'); }
    finally  { if (mountedRef.current) setLoading(false); }
  }, []);

  const fetchClaims = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 20,
        ...(claimType && { type: claimType }),
        ...(dateFrom  && { from: dateFrom }),
        ...(dateTo    && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/reward-claims?${params}`);
      // Handle both flat array and paginated object shapes
      const list       = Array.isArray(res.data) ? res.data : (res.data?.claims || []);
      const pagination = res.data?.pagination    || { pages: 1, total: list.length };
      if (mountedRef.current) {
        setClaims(list);
        setClaimPag(pagination);
      }
    } catch { toast.error('Failed to load claims'); }
    finally  { if (mountedRef.current) setLoading(false); }
  }, [claimType, dateFrom, dateTo]);

  useEffect(() => { if (tab === 'overview') fetchOverview(); }, [tab, fetchOverview]);
  useEffect(() => { if (tab === 'claims')   fetchClaims(claimPage); }, [tab, claimPage, claimType, dateFrom, dateTo, fetchClaims]);

  const claimCols = [
    { key: 'user', label: 'User', render: c => (
      <div>
        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{c.user?.name || '—'}</div>
        <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{c.user?.email}</div>
      </div>
    )},
    {
      key: 'type', label: 'Type',
      render: c => (
        <Badge color={c.type === 'referral' ? 'blue' : c.type === 'post' ? 'purple' : 'yellow'}>
          {c.type}
        </Badge>
      ),
    },
    { key: 'milestone', label: 'Milestone', render: c => <span className="rw-mono">{c.milestone}</span> },
    {
      key: 'claimedAt', label: 'Claimed',
      render: c => {
        const d = c.claimedAt || c.createdAt;
        return d ? new Date(d).toLocaleString() : '—';
      },
    },
  ];

  const totals  = data?.totals || {};
  const pieData = [
    { name: 'Referral', value: data?.referralRewards?.length || totals.referral || 0, fill: COLORS[0] },
    { name: 'Post',     value: data?.postRewards?.length     || totals.post     || 0, fill: COLORS[1] },
    { name: 'Streak',   value: data?.streakRewards?.length   || totals.streak   || 0, fill: COLORS[2] },
  ];

  const makeBarData = (rewards, slabKey) => {
    const map = {};
    (rewards || []).forEach(r => { const s = r[slabKey]; if (s !== undefined) map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([slab, count]) => ({ slab, count }));
  };

  return (
    <>
      <AdminUIStyles />
      <PageHeader title="Rewards Management" subtitle="Track, analyse and undo reward activity" />

      <div className="rw-tabs">
        {TABS.map(t => (
          <button key={t} className={`rw-tab ${tab === t ? 'rw-tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Overview' : t === 'claims' ? '🎁 Claims' : '↩ Undo'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        loading
          ? <div className="ap-spinner-wrap"><div className="ap-spinner" style={{ width: 40, height: 40 }} /></div>
          : data ? (
            <>
              <div className="ap-stats-grid" style={{ marginBottom: '1.5rem' }}>
                <StatCard label="Referral Rewards" value={(data.referralRewards?.length || totals.referral || 0).toLocaleString()} icon="👥" color={COLORS[0]} />
                <StatCard label="Post Rewards"     value={(data.postRewards?.length     || totals.post     || 0).toLocaleString()} icon="📝" color={COLORS[1]} />
                <StatCard label="Streak Rewards"   value={(data.streakRewards?.length   || totals.streak   || 0).toLocaleString()} icon="🔥" color={COLORS[2]} />
                <StatCard label="Total"            value={pieData.reduce((s, r) => s + r.value, 0).toLocaleString()} icon="◇" color="#f59e0b" />
              </div>

              <div className="rw-charts-grid" style={{ marginBottom: '1.5rem' }}>
                <Card>
                  <div className="ap-section-title">Distribution by Type</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                        {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip /><Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                {[
                  { label: 'Referral by Slab', arr: data.referralRewards, key: 'slabAwarded', color: COLORS[0] },
                  { label: 'Post by Slab',     arr: data.postRewards,     key: 'slabAwarded', color: COLORS[1] },
                  { label: 'Streak by Slab',   arr: data.streakRewards,   key: 'streakslab',  color: COLORS[2] },
                ].map(({ label, arr, key, color }) => (
                  <Card key={label}>
                    <div className="ap-section-title">{label}</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={makeBarData(arr, key)} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="slab" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                        <Tooltip /><Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                ))}
              </div>
            </>
          ) : null
      )}

      {tab === 'claims' && (
        <Card>
          <div className="ap-filter-bar">
            <Select value={claimType} onChange={v => { setClaimType(v); setClaimPage(1); }} options={TYPE_OPTIONS} placeholder="All Types" />
            <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
            <Btn size="sm" variant="secondary" onClick={() => { setClaimType(''); setDateFrom(''); setDateTo(''); setClaimPage(1); }}>Clear</Btn>
          </div>
          <Table columns={claimCols} rows={claims} loading={loading} empty="No claims found" />
          <Pagination page={claimPage} pages={claimPag.pages} onPage={setClaimPage} />
        </Card>
      )}

      {tab === 'undo' && <UndoPanel />}

      <style>{`
        .rw-tabs       { display:flex; gap:.5rem; margin-bottom:1.25rem; background:var(--bg-card); border:1px solid var(--border); padding:.5rem; border-radius:12px; }
        .rw-tab        { padding:.5rem 1.25rem; border:none; background:none; font-family:inherit; font-size:.875rem; font-weight:600; color:var(--text-secondary); border-radius:8px; cursor:pointer; transition:all .2s; }
        .rw-tab:hover  { background:var(--bg-canvas); color:var(--text-primary); }
        .rw-tab-active { background:var(--accent); color:#fff !important; }
        .rw-charts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; }
        .rw-mono       { font-family:'DM Mono',monospace; font-size:.875rem; }
        .rw-undo-grid  { display:grid; grid-template-columns:300px 1fr; gap:1rem; }
        @media(max-width:768px) { .rw-undo-grid { grid-template-columns:1fr; } }
        .rw-user-list  { max-height:360px; overflow-y:auto; margin-top:.75rem; display:flex; flex-direction:column; gap:.25rem; }
        .rw-user-btn   { display:flex; align-items:center; gap:.75rem; padding:.625rem .75rem; background:none; border:1px solid transparent; border-radius:8px; cursor:pointer; text-align:left; transition:all .15s; width:100%; }
        .rw-user-btn:hover  { background:var(--bg-canvas); }
        .rw-user-selected   { background:rgba(79,70,229,.1) !important; border-color:var(--accent) !important; }
        .rw-user-av    { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.8125rem; flex-shrink:0; }
        .rw-user-info  { display:flex; flex-direction:column; min-width:0; }
        .rw-user-name  { font-size:.8125rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rw-user-email { font-size:.6875rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rw-reward-info { margin-top:1rem; display:flex; flex-direction:column; gap:.375rem; border-top:1px solid var(--border); padding-top:.875rem; }
        .rw-slab-row   { display:flex; justify-content:space-between; font-size:.8125rem; padding:.375rem .5rem; border-radius:6px; background:var(--bg-canvas); }
        .rw-slab-label { color:var(--text-secondary); font-weight:500; }
        .rw-slab-val   { color:var(--text-primary); font-weight:600; font-family:'DM Mono',monospace; }
        .rw-undo-form  { display:flex; flex-direction:column; gap:.875rem; margin-top:.5rem; }
        .rw-undo-right { display:flex; flex-direction:column; gap:1rem; }
        .rw-empty      { text-align:center; color:var(--text-secondary); font-size:.875rem; padding:1.5rem; }
      `}</style>
    </>
  );
};

export default AdminRewards;