// Components/AdminRewardDashboard.js — with i18n + dark/light theme
import React, { useEffect, useState, memo } from "react";
import apiRequest from "../utils/apiRequest";
import { utils, writeFile } from "xlsx";
import { toast } from "react-toastify";
import {
  ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip,
  Legend, Bar, Cell, PieChart, Pie
} from "recharts";
import { useI18nTheme } from "../Context/I18nThemeContext";
import AdminToolbar from "./AdminToolbar";

const formatDate = (d) =>
  new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function aggregate(rewards, key) {
  return rewards.reduce((acc, r) => {
    const slab = r[key];
    if (!slab) return acc;
    acc[slab] = (acc[slab] || 0) + 1;
    return acc;
  }, {});
}

const COLORS = ['#2563eb', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

const StatCard = ({ title, value, icon, color }) => (
  <div className="stat-card" style={{ '--accent-color': color }}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <span className="stat-label">{title}</span>
      <span className="stat-value">{value}</span>
    </div>
  </div>
);

const AdminRewardDashboard = ({ filterByUserId }) => {
  const { t, darkMode } = useI18nTheme();
  const [data, setData] = useState(null);
  const [viewJSON, setViewJSON] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    apiRequest
      .get("/api/admin/rewards")
      .then((r) => setData(r.data))
      .catch(() => toast.error(t.failedLoadRewards));
  }, []);

  if (!data) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{t.loadingRewards}</p>
      </div>
    );
  }

  const chartInput = ["referral", "post", "streak"].reduce((obj, type) => {
    const key = `${type}Rewards`;
    const rewards = data[key];
    obj[type] = Object.entries(
      aggregate(rewards, type === "streak" ? "streakslab" : "slabAwarded")
    ).map(([slab, count]) => ({ slab, count }));
    return obj;
  }, {});

  const totalRewards = data.referralRewards.length + data.postRewards.length + data.streakRewards.length;

  const pieData = [
    { name: t.referral, value: data.referralRewards.length },
    { name: t.post, value: data.postRewards.length },
    { name: t.streak, value: data.streakRewards.length }
  ];

  const tooltipStyle = {
    backgroundColor: darkMode ? '#1a1d27' : '#fff',
    border: `1px solid ${darkMode ? '#2d3148' : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    color: darkMode ? '#e2e8f0' : '#0f172a',
  };

  const axisColor = darkMode ? '#94a3b8' : '#64748b';

  const exportCSV = (scope = "all") => {
    const rows = ["referral", "post", "streak"]
      .filter((tp) => scope === "all" || scope === tp)
      .flatMap((type) =>
        (data[`${type}Rewards`] || [])
          .filter((r) => !filterByUserId || r.user?._id === filterByUserId)
          .map((r) => ({
            Type: type,
            Email: r.user?.email ?? "Unknown",
            Slab: r.slabAwarded ?? r.streakslab,
            Date: formatDate(r.createdAt)
          }))
      );

    if (!rows.length) return toast.info(t.nothingToExport);
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Rewards");
    writeFile(wb, `${scope}_rewards_${Date.now()}.xlsx`);
    toast.success(t.exportSuccess);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <>
      <section className="dashboard-section">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h2 className="dashboard-title">{t.rewardDashboard}</h2>
            <p className="dashboard-subtitle">{t.rewardOverview}</p>
          </div>
          <div className="dashboard-right">
            <div className="dashboard-actions">
              <button onClick={() => exportCSV("all")} className="btn btn-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.export}
              </button>
              <button onClick={() => setViewJSON(!viewJSON)} className="btn btn-secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                {viewJSON ? t.hideJson : t.viewJson}
              </button>
            </div>
            <AdminToolbar />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard title={t.totalRewards}    value={totalRewards.toLocaleString()}                  icon="🎯" color="#2563eb" />
          <StatCard title={t.referralRewards} value={data.referralRewards.length.toLocaleString()}   icon="👥" color="#7c3aed" />
          <StatCard title={t.postRewards}     value={data.postRewards.length.toLocaleString()}       icon="📝" color="#ec4899" />
          <StatCard title={t.streakRewards}   value={data.streakRewards.length.toLocaleString()}     icon="🔥" color="#f59e0b" />
        </div>

        {/* Charts */}
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">{t.rewardDistribution}</h3>
            <ResponsiveContainer width="100%" height={300}>
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
            { key: 'referral', label: t.referralBySlab, color: '#7c3aed' },
            { key: 'post',     label: t.postBySlab,     color: '#ec4899' },
            { key: 'streak',   label: t.streakBySlab,   color: '#f59e0b' },
          ].map(({ key, label, color }) => (
            <div key={key} className="chart-card">
              <h3 className="chart-title">{label}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartInput[key]}>
                  <XAxis dataKey="slab" tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={color} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>

        {/* Data Tables */}
        <div className="tables-section">
          {["referral", "post", "streak"].map((type) => {
            const rewards = data[`${type}Rewards`]
              .filter((r) => !filterByUserId || r.user?._id === filterByUserId)
              .slice(0, 50);
            const slabKey = type === "streak" ? "streakslab" : "slabAwarded";
            const isExpanded = expandedSections[type];
            const icon = type === "referral" ? "👥" : type === "post" ? "📝" : "🔥";
            const label = type === "referral" ? t.referral : type === "post" ? t.post : t.streak;

            return (
              <div key={type} className="table-card">
                <button className="table-header" onClick={() => toggleSection(type)}>
                  <div className="table-header-left">
                    <span className="table-icon">{icon}</span>
                    <h3 className="table-title">{label} Rewards</h3>
                    <span className="table-count">{rewards.length} {t.records}</span>
                  </div>
                  <svg className={`chevron ${isExpanded ? 'expanded' : ''}`} width="20" height="20"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="table-content">
                    {rewards.length ? (
                      <div className="table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{t.user}</th>
                              <th>{t.slab}</th>
                              <th>{t.date}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rewards.map((r, i) => (
                              <tr key={i}>
                                <td>
                                  <div className="user-cell">
                                    <div className="user-avatar">{(r.user?.email || "U")[0].toUpperCase()}</div>
                                    <span>{r.user?.email || "Unknown"}</span>
                                  </div>
                                </td>
                                <td><span className="slab-badge">{r[slabKey]}</span></td>
                                <td className="date-cell">{formatDate(r.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="no-data">{t.noData}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {viewJSON && (
          <div className="json-viewer">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </section>

      <style>{`
        .dashboard-section { display:flex; flex-direction:column; gap:2rem; }

        .dashboard-header {
          display:flex; justify-content:space-between; align-items:flex-start;
          gap:1rem; flex-wrap:wrap;
        }
        .dashboard-title { font-size:1.875rem; font-weight:700; color:var(--text-primary); margin:0; }
        .dashboard-subtitle { font-size:0.875rem; color:var(--text-secondary); margin:.5rem 0 0 0; }
        .dashboard-right { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
        .dashboard-actions { display:flex; gap:.75rem; flex-wrap:wrap; }

        .btn { display:flex; align-items:center; gap:.5rem; padding:.625rem 1.25rem;
          border:none; border-radius:.5rem; font-weight:600; font-size:.875rem;
          cursor:pointer; transition:all .2s; }
        .btn-primary { background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 16px rgba(37,99,235,.3); }
        .btn-secondary { background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); }
        .btn-secondary:hover { background:var(--bg-secondary); transform:translateY(-2px); }

        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1.5rem; }
        .stat-card { background:var(--bg-primary); border:1px solid var(--border-color); border-radius:1rem;
          padding:1.5rem; display:flex; align-items:center; gap:1rem; transition:all .2s;
          position:relative; overflow:hidden; }
        .stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--accent-color); }
        .stat-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); }
        .stat-icon { font-size:2.5rem; line-height:1; }
        .stat-content { display:flex; flex-direction:column; gap:.25rem; }
        .stat-label { font-size:.875rem; color:var(--text-secondary); font-weight:500; }
        .stat-value { font-size:2rem; font-weight:700; color:var(--text-primary); line-height:1; }

        .charts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.5rem; }
        .chart-card { background:var(--bg-primary); border:1px solid var(--border-color);
          border-radius:1rem; padding:1.5rem; transition:box-shadow .2s; }
        .chart-card:hover { box-shadow:var(--shadow-md); }
        .chart-title { font-size:1rem; font-weight:600; color:var(--text-primary); margin:0 0 1.5rem 0; }

        .tables-section { display:flex; flex-direction:column; gap:1rem; }
        .table-card { background:var(--bg-primary); border:1px solid var(--border-color);
          border-radius:1rem; overflow:hidden; transition:box-shadow .2s; }
        .table-header { width:100%; display:flex; justify-content:space-between; align-items:center;
          padding:1.25rem 1.5rem; background:none; border:none; cursor:pointer; transition:background .2s; }
        .table-header:hover { background:var(--bg-secondary); }
        .table-header-left { display:flex; align-items:center; gap:1rem; }
        .table-icon { font-size:1.5rem; }
        .table-title { font-size:1.125rem; font-weight:600; color:var(--text-primary); margin:0; }
        .table-count { font-size:.875rem; color:var(--text-secondary); background:var(--bg-tertiary);
          padding:.25rem .75rem; border-radius:9999px; }
        .chevron { transition:transform .2s; color:var(--text-secondary); }
        .chevron.expanded { transform:rotate(180deg); }
        .table-content { padding:0 1.5rem 1.5rem 1.5rem; animation:slideDown .3s ease; }
        @keyframes slideDown { from { opacity:0; } to { opacity:1; } }
        .table-wrapper { overflow-x:auto; border-radius:.5rem; border:1px solid var(--border-color); }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table th { background:var(--bg-secondary); padding:.875rem 1rem; text-align:left;
          font-weight:600; font-size:.75rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.05em; }
        .data-table td { padding:1rem; border-top:1px solid var(--border-color); font-size:.875rem; color:var(--text-primary); }
        .data-table tbody tr:hover { background:var(--bg-secondary); }
        .user-cell { display:flex; align-items:center; gap:.75rem; }
        .user-avatar { width:32px; height:32px; border-radius:50%;
          background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff;
          display:flex; align-items:center; justify-content:center; font-weight:600; font-size:.875rem; }
        .slab-badge { display:inline-block; padding:.375rem .75rem; background:var(--bg-tertiary);
          border-radius:.375rem; font-weight:600; font-size:.8125rem; color:var(--text-primary); }
        .date-cell { color:var(--text-secondary); font-size:.8125rem; }
        .no-data { text-align:center; padding:3rem; color:var(--text-secondary); }

        .json-viewer { background:var(--bg-primary); border:1px solid var(--border-color);
          border-radius:1rem; padding:1.5rem; overflow:auto; max-height:400px; }
        .json-viewer pre { margin:0; font-family:'Monaco','Menlo','Courier New',monospace;
          font-size:.75rem; color:var(--text-primary); }

        .loading-container { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem; gap:1rem; }
        .spinner { width:48px; height:48px; border:4px solid var(--border-color);
          border-top-color:var(--accent); border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        @media (max-width:768px) {
          .dashboard-header { flex-direction:column; }
          .dashboard-right { width:100%; justify-content:space-between; }
          .btn { flex:1; justify-content:center; }
        }
      `}</style>
    </>
  );
};

export default memo(AdminRewardDashboard);