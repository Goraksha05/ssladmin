// Components/Admin/AdminOverview.js — Analytics Dashboard
import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import {
  StatCard, PageHeader, Card, Btn, Spinner, AdminUIStyles,
} from './AdminUI';

const PALETTE = ['#4f46e5', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const fmtNum = n => n?.toLocaleString() ?? '—';
const fmtDate = s => {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ov-tooltip">
      <div className="ov-tt-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="ov-tt-row" style={{ color: p.color }}>
          {p.name}: <strong>{fmtNum(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const AdminOverview = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest.get('/api/admin/analytics');
      setData(res.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) return <Spinner size={48} />;
  if (!data)   return <div className="ov-error">Failed to load. <Btn onClick={fetchAnalytics} size="sm">Retry</Btn></div>;

  const { totals, growthChart, postsGrowthChart, subPlans, topReferrers, topPosters } = data;

  // Merge user + post growth for combined chart
  const combinedGrowth = (() => {
    const map = {};
    growthChart.forEach(d => { map[d._id] = { date: d._id, users: d.count, posts: 0 }; });
    postsGrowthChart.forEach(d => {
      if (map[d._id]) map[d._id].posts = d.count;
      else map[d._id] = { date: d._id, users: 0, posts: d.count };
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const pieData = subPlans.map((s, i) => ({
    name: s._id || 'Unknown', value: s.count, fill: PALETTE[i % PALETTE.length],
  }));

  const rewardPie = [
    { name: 'Referral', value: totals.referralRewards, fill: PALETTE[0] },
    { name: 'Post',     value: totals.postRewards,     fill: PALETTE[1] },
    { name: 'Streak',   value: totals.streakRewards,   fill: PALETTE[2] },
  ];

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Platform Overview"
        subtitle="Real-time analytics and platform health"
        actions={
          <Btn onClick={fetchAnalytics} variant="secondary" size="sm">
            ↻ Refresh
          </Btn>
        }
      />

      {/* KPI Stats */}
      <div className="ap-stats-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Total Users"        value={fmtNum(totals.users)}        icon="👤" color="#4f46e5" />
        <StatCard label="Active (30d)"       value={fmtNum(totals.activeUsers)}   icon="✦"  color="#10b981" />
        <StatCard label="New Today"          value={fmtNum(totals.newUsersToday)} icon="✚"  color="#06b6d4" />
        <StatCard label="Active Subs"        value={fmtNum(totals.activeSubs)}    icon="◈"  color="#f59e0b" />
        <StatCard label="Total Posts"        value={fmtNum(totals.posts)}         icon="▨"  color="#7c3aed" />
        <StatCard label="Total Rewards"      value={fmtNum(totals.totalRewards)}  icon="◇"  color="#ec4899" />
        <StatCard label="Reward Claims"      value={fmtNum(totals.rewardClaims)}  icon="⬡"  color="#ef4444" />
        <StatCard label="Banned Users"       value={fmtNum(totals.bannedUsers)}   icon="⊗"  color="#94a3b8" />
      </div>

      {/* Growth Chart */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div className="ov-chart-header">
          <div>
            <div className="ov-chart-title">Platform Growth (Last 30 days)</div>
            <div className="ov-chart-sub">Users registered & posts created daily</div>
          </div>
          <div className="ov-chart-legend">
            <span className="ov-leg-dot" style={{ background: '#4f46e5' }} /> Users
            <span className="ov-leg-dot" style={{ background: '#10b981', marginLeft: '1rem' }} /> Posts
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={combinedGrowth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={2} fill="url(#gUsers)" name="Users" />
            <Area type="monotone" dataKey="posts" stroke="#10b981" strokeWidth={2} fill="url(#gPosts)" name="Posts" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Pie charts row */}
      <div className="ov-two-col" style={{ marginBottom: '1.5rem' }}>
        <Card>
          <div className="ov-chart-title" style={{ marginBottom: '1rem' }}>Subscription Plans</div>
          {pieData.length === 0
            ? <p className="ov-empty">No subscription data</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={v => [fmtNum(v), 'Users']} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </Card>

        <Card>
          <div className="ov-chart-title" style={{ marginBottom: '1rem' }}>Rewards by Type</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={rewardPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {rewardPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip formatter={v => [fmtNum(v), 'Rewards']} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="ov-two-col">
        <Card>
          <div className="ov-chart-title" style={{ marginBottom: '1rem' }}>🏆 Top Referrers</div>
          {topReferrers.length === 0
            ? <p className="ov-empty">No referral data yet</p>
            : (
              <div className="ov-leaderboard">
                {topReferrers.map((u, i) => (
                  <div key={u._id} className="ov-lb-row">
                    <span className="ov-lb-rank" style={{ color: i < 3 ? '#f59e0b' : 'var(--text-secondary)' }}>
                      {i + 1}
                    </span>
                    <div className="ov-lb-info">
                      <span className="ov-lb-name">{u.name}</span>
                      <span className="ov-lb-email">{u.email}</span>
                    </div>
                    <span className="ov-lb-score">{fmtNum(u.totalReferralToken)}</span>
                  </div>
                ))}
              </div>
            )
          }
        </Card>

        <Card>
          <div className="ov-chart-title" style={{ marginBottom: '1rem' }}>✦ Top Posters</div>
          {topPosters.length === 0
            ? <p className="ov-empty">No post data yet</p>
            : (
              <div className="ov-leaderboard">
                {topPosters.map((u, i) => (
                  <div key={u._id} className="ov-lb-row">
                    <span className="ov-lb-rank" style={{ color: i < 3 ? '#4f46e5' : 'var(--text-secondary)' }}>
                      {i + 1}
                    </span>
                    <div className="ov-lb-info">
                      <span className="ov-lb-name">{u.user?.name || 'Unknown'}</span>
                      <span className="ov-lb-email">{u.user?.email || '—'}</span>
                    </div>
                    <span className="ov-lb-score">{fmtNum(u.count)} posts</span>
                  </div>
                ))}
              </div>
            )
          }
        </Card>
      </div>

      <style>{`
        .ov-chart-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:.5rem; }
        .ov-chart-title  { font-size:.9375rem; font-weight:700; color:var(--text-primary); }
        .ov-chart-sub    { font-size:.8125rem; color:var(--text-secondary); margin-top:.25rem; }
        .ov-chart-legend { display:flex; align-items:center; font-size:.8125rem; color:var(--text-secondary); }
        .ov-leg-dot      { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:.375rem; }
        .ov-two-col      { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1rem; }
        .ov-leaderboard  { display:flex; flex-direction:column; gap:.5rem; }
        .ov-lb-row       { display:flex; align-items:center; gap:.875rem; padding:.5rem .75rem; border-radius:8px; transition:background .15s; }
        .ov-lb-row:hover { background:var(--bg-canvas); }
        .ov-lb-rank      { font-size:.875rem; font-weight:700; width:1.5rem; text-align:center; flex-shrink:0; font-family:'DM Mono',monospace; }
        .ov-lb-info      { flex:1; display:flex; flex-direction:column; min-width:0; }
        .ov-lb-name      { font-size:.875rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ov-lb-email     { font-size:.75rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ov-lb-score     { font-size:.8125rem; font-weight:700; color:var(--accent); white-space:nowrap; font-family:'DM Mono',monospace; }
        .ov-tooltip      { background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:.625rem .875rem; box-shadow:var(--shadow-pop); }
        .ov-tt-label     { font-size:.75rem; color:var(--text-secondary); margin-bottom:.25rem; }
        .ov-tt-row       { font-size:.875rem; margin:.125rem 0; }
        .ov-empty        { color:var(--text-secondary); font-size:.875rem; text-align:center; padding:2rem; }
        .ov-error        { display:flex; align-items:center; justify-content:center; gap:1rem; padding:3rem; color:var(--text-secondary); }
      `}</style>
    </>
  );
};

export default AdminOverview;