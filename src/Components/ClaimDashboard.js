/**
 * Components/ClaimDashboard.js
 *
 * BUG FIX: Was rendering `new Date(claim.date)` but the RewardClaim schema
 * uses `claimedAt` (with `createdAt` as fallback via timestamps:true).
 * `claim.date` is always undefined → showed "Invalid Date" in every row.
 * Fixed: use `claim.claimedAt || claim.createdAt`.
 *
 * REDESIGN: Clean editorial table with colour-coded type pills and animated entry.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiRequest from '../utils/apiRequest';

const fetchClaims = async () => {
  const { data } = await apiRequest.get('/api/admin/reward-claims');
  // API returns a flat array of RewardClaim documents (not wrapped in { claims })
  return Array.isArray(data) ? data : (data?.claims ?? []);
};

const TYPE_META = {
  referral: { icon: '👥', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  border: 'rgba(124,58,237,0.25)' },
  post:     { icon: '📝', color: '#ec4899', bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.25)' },
  streak:   { icon: '🔥', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
};

const getMeta = (type) => TYPE_META[type?.toLowerCase()] || {
  icon: '🎁', color: '#2563eb', bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.25)',
};

const ClaimDashboard = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['claims'],
    queryFn:  fetchClaims,
    staleTime: 60_000,
    retry: 2,
  });

  const filtered = data.filter(c => {
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    const matchSearch = !search || [c.user?.name, c.user?.email, c.milestone]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const stats = ['referral', 'post', 'streak'].map(type => ({
    type,
    count: data.filter(c => c.type === type).length,
    ...getMeta(type),
  }));

  if (isLoading) return (
    <div className="cd-center">
      <div className="cd-spinner" />
      <p className="cd-muted">Loading claims…</p>
    </div>
  );

  if (error) return (
    <div className="cd-center">
      <span style={{ fontSize: '3rem' }}>⚠️</span>
      <h3 className="cd-title">Failed to load claims</h3>
      <p className="cd-muted">Please refresh the page to try again.</p>
    </div>
  );

  if (!data.length) return (
    <div className="cd-center">
      <span style={{ fontSize: '3rem' }}>📭</span>
      <h3 className="cd-title">No reward claims yet</h3>
      <p className="cd-muted">Claims will appear here once users start redeeming rewards.</p>
    </div>
  );

  return (
    <>
      <section className="cd-root">
        {/* Header */}
        <div className="cd-header">
          <div>
            <h2 className="cd-page-title">Reward Claim Monitor</h2>
            <p className="cd-page-sub">Real-time log of all reward redemptions</p>
          </div>
          <div className="cd-total-badge">
            <span className="cd-total-label">Total Claims</span>
            <span className="cd-total-value">{data.length.toLocaleString()}</span>
          </div>
        </div>

        {/* Stat pills */}
        <div className="cd-stats">
          {stats.map(s => (
            <button
              key={s.type}
              className={`cd-stat-pill ${typeFilter === s.type ? 'cd-stat-active' : ''}`}
              style={{ '--pill-color': s.color, '--pill-bg': s.bg, '--pill-border': s.border }}
              onClick={() => setTypeFilter(typeFilter === s.type ? 'all' : s.type)}
            >
              <span className="cd-stat-icon">{s.icon}</span>
              <div className="cd-stat-text">
                <span className="cd-stat-type">{s.type}</span>
                <span className="cd-stat-count">{s.count.toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="cd-controls">
          <div className="cd-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email or milestone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="cd-search-input"
            />
            {search && <button className="cd-clear" onClick={() => setSearch('')}>×</button>}
          </div>
          <span className="cd-result-count">{filtered.length} of {data.length} results</span>
        </div>

        {/* Table */}
        <div className="cd-table-wrap">
          {filtered.length === 0 ? (
            <div className="cd-center" style={{ padding: '3rem' }}>
              <p className="cd-muted">No claims match your current filters.</p>
            </div>
          ) : (
            <table className="cd-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Milestone</th>
                  <th>Claimed At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((claim, i) => {
                  const meta = getMeta(claim.type);
                  // BUG FIX: `claim.date` is always undefined.
                  // RewardClaim schema uses `claimedAt`; timestamps:true adds `createdAt` as fallback.
                  const claimedDate = claim.claimedAt || claim.createdAt;
                  return (
                    <tr key={claim._id || i} className="cd-row" style={{ animationDelay: `${i * 20}ms` }}>
                      <td>
                        <div className="cd-user-cell">
                          <div className="cd-avatar">{(claim.user?.name || 'U')[0].toUpperCase()}</div>
                          <div className="cd-user-info">
                            <span className="cd-user-name">{claim.user?.name || '—'}</span>
                            <span className="cd-user-email">{claim.user?.email || 'Unknown'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="cd-type-pill"
                          style={{ '--pill-color': meta.color, '--pill-bg': meta.bg, '--pill-border': meta.border }}>
                          <span>{meta.icon}</span>
                          {claim.type}
                        </span>
                      </td>
                      <td>
                        <span className="cd-milestone">{claim.milestone ?? '—'}</span>
                      </td>
                      <td>
                        <div className="cd-date-cell">
                          {claimedDate ? (
                            <>
                              <span className="cd-date-primary">
                                {new Date(claimedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span className="cd-date-secondary">
                                {new Date(claimedDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          ) : <span className="cd-muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <style>{`
        .cd-root { display:flex; flex-direction:column; gap:1.5rem; }

        .cd-center { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem 2rem; gap:1rem; text-align:center; }
        .cd-title  { margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary); }
        .cd-muted  { margin:0; font-size:.875rem; color:var(--text-secondary); }

        .cd-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .cd-page-title { font-size:1.625rem; font-weight:700; color:var(--text-primary); margin:0; letter-spacing:-0.02em; }
        .cd-page-sub { font-size:.875rem; color:var(--text-secondary); margin:.375rem 0 0; }
        .cd-total-badge { display:flex; flex-direction:column; align-items:flex-end; padding:.75rem 1.25rem;
          background:linear-gradient(135deg,var(--accent),#7c3aed); border-radius:.75rem; color:#fff; }
        .cd-total-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; opacity:.85; }
        .cd-total-value { font-size:1.75rem; font-weight:700; line-height:1.2; margin-top:.125rem; }

        .cd-stats { display:flex; gap:.75rem; flex-wrap:wrap; }
        .cd-stat-pill { display:flex; align-items:center; gap:.625rem; padding:.75rem 1.125rem;
          background:var(--bg-primary); border:1px solid var(--border-color);
          border-radius:.75rem; cursor:pointer; transition:all .2s; }
        .cd-stat-pill:hover { border-color:var(--pill-color); background:var(--pill-bg); }
        .cd-stat-active { background:var(--pill-bg) !important; border-color:var(--pill-border) !important; }
        .cd-stat-icon { font-size:1.25rem; }
        .cd-stat-text { display:flex; flex-direction:column; align-items:flex-start; }
        .cd-stat-type { font-size:.6875rem; color:var(--text-secondary); text-transform:capitalize; font-weight:600; }
        .cd-stat-count { font-size:1.125rem; font-weight:700; color:var(--pill-color); line-height:1.1; }

        .cd-controls { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; justify-content:space-between; }
        .cd-search { position:relative; display:flex; align-items:center; gap:.5rem;
          background:var(--bg-primary); border:1px solid var(--border-color); border-radius:.5rem; padding:.5rem .875rem;
          flex:1; min-width:220px; max-width:400px; transition:border-color .2s; }
        .cd-search:focus-within { border-color:var(--accent); }
        .cd-search svg { color:var(--text-secondary); flex-shrink:0; }
        .cd-search-input { flex:1; border:none; outline:none; background:none; font-size:.875rem; color:var(--text-primary); }
        .cd-search-input::placeholder { color:var(--text-secondary); }
        .cd-clear { background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.125rem; padding:0; line-height:1; }
        .cd-result-count { font-size:.8125rem; color:var(--text-secondary); white-space:nowrap; }

        .cd-table-wrap { background:var(--bg-primary); border:1px solid var(--border-color); border-radius:1rem; overflow:hidden; }
        .cd-table { width:100%; border-collapse:collapse; }
        .cd-table thead { background:var(--bg-secondary); }
        .cd-table th { padding:.875rem 1.25rem; text-align:left; font-size:.6875rem; font-weight:700;
          color:var(--text-secondary); text-transform:uppercase; letter-spacing:.08em;
          border-bottom:1.5px solid var(--border-color); white-space:nowrap; }
        .cd-table td { padding:1rem 1.25rem; border-bottom:1px solid var(--border-color); vertical-align:middle; }
        .cd-row { animation:cdFadeIn .25s ease both; transition:background .15s; }
        .cd-row:last-child td { border-bottom:none; }
        .cd-row:hover td { background:var(--bg-secondary); }
        @keyframes cdFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

        .cd-user-cell { display:flex; align-items:center; gap:.75rem; }
        .cd-avatar { width:36px; height:36px; border-radius:50%;
          background:linear-gradient(135deg,var(--accent),#7c3aed); color:#fff;
          display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.875rem; flex-shrink:0; }
        .cd-user-info { display:flex; flex-direction:column; gap:.1rem; }
        .cd-user-name  { font-size:.875rem; font-weight:600; color:var(--text-primary); }
        .cd-user-email { font-size:.75rem; color:var(--text-secondary); }

        .cd-type-pill { display:inline-flex; align-items:center; gap:.375rem;
          padding:.35rem .75rem; border-radius:.375rem;
          background:var(--pill-bg); border:1px solid var(--pill-border);
          color:var(--pill-color); font-size:.75rem; font-weight:700; text-transform:capitalize; }

        .cd-milestone { display:inline-block; padding:.3rem .625rem;
          background:var(--bg-secondary); border:1px solid var(--border-color);
          border-radius:.375rem; font-size:.8125rem; font-weight:600; color:var(--text-primary);
          font-family:'DM Mono',monospace; }

        .cd-date-cell  { display:flex; flex-direction:column; gap:.1rem; }
        .cd-date-primary   { font-size:.875rem; color:var(--text-primary); font-weight:500; }
        .cd-date-secondary { font-size:.75rem; color:var(--text-secondary); }

        .cd-spinner { width:36px; height:36px; border:3px solid var(--border-color);
          border-top-color:var(--accent); border-radius:50%; animation:cdSpin .8s linear infinite; }
        @keyframes cdSpin { to{transform:rotate(360deg)} }

        @media(max-width:640px) {
          .cd-stats { flex-direction:row; }
          .cd-stat-pill { flex:1; min-width:0; }
          .cd-table th:nth-child(3), .cd-table td:nth-child(3) { display:none; }
        }
      `}</style>
    </>
  );
};

export default ClaimDashboard;