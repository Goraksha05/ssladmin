/**
 * Components/AdminRewardDashboard.js
 *
 * REDESIGN: clean stats + charts dashboard with collapsible tables.
 * No functional bugs here, but AdminRewards.js UndoPanel had the wrong
 * endpoint (`/api/admin/users/:id` doesn't exist for reward data).
 * That's fixed in AdminRewards.js. This file is the standalone dashboard.
 */

import React, { useEffect, useState, memo } from 'react';
import apiRequest from '../utils/apiRequest';
import { utils, writeFile } from 'xlsx';
import { toast } from 'react-toastify';
import {
  ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip,
  Bar, Cell, PieChart, Pie,
} from 'recharts';
import { useI18nTheme } from '../Context/I18nThemeContext';
import AdminToolbar from './AdminToolbar';

const formatDate = (d) =>
  new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function aggregate(rewards, key) {
  return rewards.reduce((acc, r) => {
    const slab = r[key];
    if (!slab) return acc;
    acc[slab] = (acc[slab] || 0) + 1;
    return acc;
  }, {});
}

const COLORS = ['#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

const StatCard = ({ title, value, icon, color }) => (
  <div className="ard-stat" style={{ '--sc': color }}>
    <div className="ard-stat-icon">{icon}</div>
    <div className="ard-stat-body">
      <span className="ard-stat-label">{title}</span>
      <span className="ard-stat-value">{value}</span>
    </div>
  </div>
);

const AdminRewardDashboard = ({ filterByUserId }) => {
  const { t, darkMode } = useI18nTheme();
  const [data, setData]                = useState(null);
  const [viewJSON, setViewJSON]        = useState(false);
  const [expanded, setExpanded]        = useState({});

  useEffect(() => {
    apiRequest.get('/api/admin/rewards')
      .then(r => setData(r.data))
      .catch(() => toast.error(t.failedLoadRewards || 'Failed to load rewards'));
  }, [t.failedLoadRewards]);

  if (!data) return (
    <div className="ard-center">
      <div className="ard-spinner" />
      <p className="ard-muted">{t.loadingRewards || 'Loading rewards…'}</p>
    </div>
  );

  const chartInput = ['referral', 'post', 'streak'].reduce((obj, type) => {
    const rewards = data[`${type}Rewards`];
    obj[type] = Object.entries(
      aggregate(rewards, type === 'streak' ? 'streakslab' : 'slabAwarded')
    ).map(([slab, count]) => ({ slab, count }));
    return obj;
  }, {});

  const total  = data.referralRewards.length + data.postRewards.length + data.streakRewards.length;
  const pieData = [
    { name: 'Referral', value: data.referralRewards.length },
    { name: 'Post',     value: data.postRewards.length },
    { name: 'Streak',   value: data.streakRewards.length },
  ];

  const tooltipStyle = {
    backgroundColor: darkMode ? '#1a1d27' : '#fff',
    border: `1px solid ${darkMode ? '#2d3148' : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    color: darkMode ? '#e2e8f0' : '#0f172a',
  };
  const axisColor = darkMode ? '#94a3b8' : '#64748b';

  const exportCSV = (scope = 'all') => {
    const rows = ['referral', 'post', 'streak']
      .filter(tp => scope === 'all' || scope === tp)
      .flatMap(type =>
        (data[`${type}Rewards`] || [])
          .filter(r => !filterByUserId || r.user?._id === filterByUserId)
          .map(r => ({
            Type:  type,
            Email: r.user?.email ?? 'Unknown',
            Slab:  r.slabAwarded ?? r.streakslab,
            Date:  formatDate(r.createdAt),
          }))
      );
    if (!rows.length) return toast.info('Nothing to export.');
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Rewards');
    writeFile(wb, `${scope}_rewards_${Date.now()}.xlsx`);
    toast.success('Exported successfully!');
  };

  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <section className="ard-root">
        {/* Header */}
        <div className="ard-header">
          <div>
            <h2 className="ard-title">{t.rewardDashboard || 'Reward Dashboard'}</h2>
            <p className="ard-sub">{t.rewardOverview || 'Overview of all reward activity'}</p>
          </div>
          <div className="ard-header-right">
            <div className="ard-actions">
              <button onClick={() => exportCSV('all')} className="ard-btn ard-btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.export || 'Export'}
              </button>
              <button onClick={() => setViewJSON(v => !v)} className="ard-btn ard-btn-secondary">
                {viewJSON ? (t.hideJson || 'Hide JSON') : (t.viewJson || 'View JSON')}
              </button>
            </div>
            <AdminToolbar />
          </div>
        </div>

        {/* Stats */}
        <div className="ard-stats-grid">
          <StatCard title={t.totalRewards    || 'Total Rewards'}    value={total.toLocaleString()}                         icon="🎯" color="#4f46e5" />
          <StatCard title={t.referralRewards || 'Referral Rewards'} value={data.referralRewards.length.toLocaleString()}   icon="👥" color="#7c3aed" />
          <StatCard title={t.postRewards     || 'Post Rewards'}     value={data.postRewards.length.toLocaleString()}       icon="📝" color="#ec4899" />
          <StatCard title={t.streakRewards   || 'Streak Rewards'}   value={data.streakRewards.length.toLocaleString()}     icon="🔥" color="#f59e0b" />
        </div>

        {/* Charts */}
        <div className="ard-charts">
          <div className="ard-chart-card">
            <h3 className="ard-chart-title">{t.rewardDistribution || 'Distribution'}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {[
            { key: 'referral', label: t.referralBySlab || 'Referral by Slab', color: '#7c3aed' },
            { key: 'post',     label: t.postBySlab     || 'Post by Slab',     color: '#ec4899' },
            { key: 'streak',   label: t.streakBySlab   || 'Streak by Slab',   color: '#f59e0b' },
          ].map(({ key, label, color }) => (
            <div key={key} className="ard-chart-card">
              <h3 className="ard-chart-title">{label}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartInput[key]}>
                  <XAxis dataKey="slab" tick={{ fill: axisColor, fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>

        {/* Tables */}
        <div className="ard-tables">
          {['referral', 'post', 'streak'].map(type => {
            const rewards = data[`${type}Rewards`]
              .filter(r => !filterByUserId || r.user?._id === filterByUserId)
              .slice(0, 50);
            const slabKey = type === 'streak' ? 'streakslab' : 'slabAwarded';
            const isOpen  = expanded[type];
            const icon    = type === 'referral' ? '👥' : type === 'post' ? '📝' : '🔥';

            return (
              <div key={type} className="ard-table-card">
                <button className="ard-table-hdr" onClick={() => toggle(type)}>
                  <div className="ard-table-hdr-left">
                    <span>{icon}</span>
                    <span className="ard-table-title">{type.charAt(0).toUpperCase() + type.slice(1)} Rewards</span>
                    <span className="ard-badge">{rewards.length}</span>
                  </div>
                  <svg className={`ard-chevron ${isOpen ? 'ard-open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="ard-table-body">
                    {rewards.length ? (
                      <div className="ard-table-wrap">
                        <table className="ard-table">
                          <thead>
                            <tr><th>User</th><th>Slab</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            {rewards.map((r, i) => (
                              <tr key={i}>
                                <td>
                                  <div className="ard-user-cell">
                                    <div className="ard-user-av">{(r.user?.email || 'U')[0].toUpperCase()}</div>
                                    <span className="ard-user-email">{r.user?.email || 'Unknown'}</span>
                                  </div>
                                </td>
                                <td><span className="ard-slab">{r[slabKey]}</span></td>
                                <td className="ard-date">{formatDate(r.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="ard-empty">No rewards for this category.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {viewJSON && (
          <div className="ard-json">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </section>

      <style>{`
        .ard-root { display:flex; flex-direction:column; gap:2rem; }
        .ard-center { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem; gap:1rem; }
        .ard-muted { color:var(--text-secondary); margin:0; font-size:.875rem; }

        .ard-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .ard-title  { font-size:1.625rem; font-weight:700; color:var(--text-primary); margin:0; letter-spacing:-0.02em; }
        .ard-sub    { font-size:.875rem; color:var(--text-secondary); margin:.375rem 0 0; }
        .ard-header-right { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
        .ard-actions { display:flex; gap:.625rem; }

        .ard-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.5625rem 1.125rem;
          border:none; border-radius:.5rem; font-size:.875rem; font-weight:600; cursor:pointer; transition:all .2s; }
        .ard-btn-primary   { background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff; }
        .ard-btn-primary:hover   { transform:translateY(-2px); box-shadow:0 6px 14px rgba(37,99,235,.3); }
        .ard-btn-secondary { background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); }
        .ard-btn-secondary:hover { background:var(--bg-tertiary); transform:translateY(-2px); }

        .ard-stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1.25rem; }
        .ard-stat { background:var(--bg-primary); border:1px solid var(--border-color); border-radius:1rem;
          padding:1.375rem 1.5rem; display:flex; align-items:center; gap:1rem; transition:all .2s;
          position:relative; overflow:hidden; }
        .ard-stat::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--sc); }
        .ard-stat:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); }
        .ard-stat-icon  { font-size:2.25rem; line-height:1; }
        .ard-stat-body  { display:flex; flex-direction:column; gap:.2rem; }
        .ard-stat-label { font-size:.8125rem; color:var(--text-secondary); font-weight:500; }
        .ard-stat-value { font-size:1.875rem; font-weight:700; color:var(--text-primary); line-height:1; }

        .ard-charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1.25rem; }
        .ard-chart-card { background:var(--bg-primary); border:1px solid var(--border-color); border-radius:1rem; padding:1.5rem; }
        .ard-chart-title { font-size:.9375rem; font-weight:600; color:var(--text-primary); margin:0 0 1.25rem; }

        .ard-tables { display:flex; flex-direction:column; gap:1rem; }
        .ard-table-card { background:var(--bg-primary); border:1px solid var(--border-color); border-radius:1rem; overflow:hidden; }
        .ard-table-hdr { width:100%; display:flex; justify-content:space-between; align-items:center;
          padding:1.125rem 1.5rem; background:none; border:none; cursor:pointer; transition:background .2s; }
        .ard-table-hdr:hover { background:var(--bg-secondary); }
        .ard-table-hdr-left { display:flex; align-items:center; gap:.875rem; }
        .ard-table-title { font-size:1rem; font-weight:600; color:var(--text-primary); }
        .ard-badge { background:var(--bg-secondary); border:1px solid var(--border-color); padding:.2rem .625rem;
          border-radius:9999px; font-size:.75rem; color:var(--text-secondary); font-weight:600; }
        .ard-chevron { transition:transform .2s; color:var(--text-secondary); }
        .ard-open  { transform:rotate(180deg); }
        .ard-table-body { padding:0 1.5rem 1.5rem; animation:ardSlideDown .25s ease; }
        @keyframes ardSlideDown { from{opacity:0} to{opacity:1} }
        .ard-table-wrap { overflow-x:auto; border-radius:.5rem; border:1px solid var(--border-color); }
        .ard-table { width:100%; border-collapse:collapse; }
        .ard-table th { background:var(--bg-secondary); padding:.75rem 1rem; text-align:left;
          font-size:.6875rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.06em; }
        .ard-table td { padding:.875rem 1rem; border-top:1px solid var(--border-color); font-size:.875rem; color:var(--text-primary); }
        .ard-table tbody tr:hover td { background:var(--bg-secondary); }
        .ard-user-cell { display:flex; align-items:center; gap:.625rem; }
        .ard-user-av { width:30px; height:30px; border-radius:50%;
          background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff;
          display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.75rem; flex-shrink:0; }
        .ard-user-email { font-size:.875rem; color:var(--text-primary); }
        .ard-slab { display:inline-block; padding:.25rem .625rem; background:var(--bg-secondary);
          border-radius:.375rem; font-weight:600; font-size:.8125rem; }
        .ard-date { color:var(--text-secondary); font-size:.8125rem; }
        .ard-empty { text-align:center; padding:2rem; color:var(--text-secondary); font-size:.875rem; }

        .ard-json { background:var(--bg-primary); border:1px solid var(--border-color); border-radius:1rem; padding:1.5rem; overflow:auto; max-height:400px; }
        .ard-json pre { margin:0; font-family:'DM Mono',monospace; font-size:.75rem; color:var(--text-primary); }

        .ard-spinner { width:40px; height:40px; border:3px solid var(--border-color);
          border-top-color:var(--accent); border-radius:50%; animation:ardSpin 1s linear infinite; }
        @keyframes ardSpin { to{transform:rotate(360deg)} }

        @media(max-width:768px) {
          .ard-header { flex-direction:column; }
          .ard-header-right { width:100%; justify-content:space-between; }
        }
      `}</style>
    </>
  );
};

export default memo(AdminRewardDashboard);