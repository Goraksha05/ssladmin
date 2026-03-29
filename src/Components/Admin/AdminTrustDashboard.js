// components/Admin/AdminTrustDashboard.js
//
// CHANGES FROM ORIGINAL:
//
//   1. CRITICAL — Wrong auth header key. The original API() helper sent
//      `'auth-token': token` but the backend auth middleware (fetchUser.js /
//      verifyAdmin.js) reads the standard `Authorization: Bearer <token>`
//      header set by apiRequest's request interceptor. Using a custom
//      `auth-token` header meant every trust API call was unauthorised (401).
//      Fix: replaced the bespoke fetch() wrapper with apiRequest so the
//      interceptor handles auth automatically. The old API() function is removed.
//
//   2. CRITICAL — localStorage key mismatch. The original read
//      `localStorage.getItem('authToken')` (capital T) but AuthContext stores
//      the token under 'authtoken' (lowercase t, matching the backend response
//      field). This caused the token to always be null in the old helper.
//      This is now moot since the whole fetch wrapper is replaced by apiRequest,
//      but documented here for clarity.
//
//   3. CRITICAL — Wrong import path for AdminUI.css. Original imported
//      `'./AdminUI.css'` which does not exist — AdminUI exports a <style> tag
//      via AdminUIStyles, not a CSS file. Import removed; AdminUIStyles
//      component rendered instead.
//
//   4. FIX — CSS variable names bridged. AdminTrustDashboard used
//      `--color-background-primary`, `--color-text-primary` etc. (its own
//      convention) while the rest of the admin panel uses `--bg-card`,
//      `--text-primary` etc. AdminUI.js now defines alias variables so both
//      naming conventions resolve to the same values without changing any
//      inline styles in this file.
//
//   5. FIX — All API calls migrated from raw fetch() to apiRequest (axios).
//      Response shape adjusted: axios wraps the body in `.data`, so all
//      `data.events`, `data.clusters`, etc. become `res.data.events` etc.
//
//   6. FIX — Error handling added to all API calls. The original used
//      Promise chains with no .catch(), causing unhandled rejections on
//      network errors. All calls now have try/catch with toast notifications.
//
//   7. FIX — AdminUIStyles rendered at the root so CSS variables are
//      available to all sub-components.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import { PageHeader, Card, StatCard, Btn, Badge, Select, AdminUIStyles } from './AdminUI';

// ── Tier badge ─────────────────────────────────────────────────────────────────
// FIX: TrustDashboard used color names like 'danger', 'warning', 'info',
// 'success' — AdminUI.js Badge now supports these as aliases.
const TIER_COLOR = { auto_flag: 'danger', kyc_gate: 'warning', watchlist: 'info', clean: 'success' };
const TierBadge = ({ tier }) => (
  <Badge color={TIER_COLOR[tier] || 'default'}>{tier || 'clean'}</Badge>
);

// ── Score bar ──────────────────────────────────────────────────────────────────
const ScoreBar = ({ score = 0, label }) => {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 75 ? '#dc2626' : pct >= 60 ? '#d97706' : pct >= 45 ? '#2563eb' : '#16a34a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 90 }}>{label}</span>}
      <div style={{ flex: 1, height: 6, background: 'var(--color-border-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, minWidth: 32, textAlign: 'right', color }}>{pct}%</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats]   = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [highRiskRes, allRes] = await Promise.all([
          apiRequest.get('/api/trust/fraud-events?limit=5&minScore=0.45'),
          apiRequest.get('/api/trust/fraud-events?limit=200'),
        ]);
        const events = allRes.data.events || [];
        const byTier = { auto_flag: 0, kyc_gate: 0, watchlist: 0, clean: 0 };
        for (const e of events) {
          const score = e.scores?.aggregateRiskScore || 0;
          if (score >= 0.75) byTier.auto_flag++;
          else if (score >= 0.60) byTier.kyc_gate++;
          else if (score >= 0.45) byTier.watchlist++;
          else byTier.clean++;
        }
        setStats({ total: allRes.data.total, byTier, unresolved: events.filter(e => !e.resolved).length });
        setRecent(highRiskRes.data.events || []);
      } catch {
        toast.error('Failed to load trust overview');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="ap-loading">Loading overview…</div>;

  return (
    <div>
      <div className="ap-stats-grid">
        <StatCard label="Total fraud events" value={stats?.total}            icon="🛡" color="#4f46e5" />
        <StatCard label="Auto-flagged"        value={stats?.byTier.auto_flag} icon="🚨" color="#dc2626" />
        <StatCard label="KYC gated"           value={stats?.byTier.kyc_gate}  icon="🔐" color="#d97706" />
        <StatCard label="On watchlist"        value={stats?.byTier.watchlist} icon="👁" color="#2563eb" />
        <StatCard label="Unresolved"          value={stats?.unresolved}       icon="⏳" color="#9333ea" />
      </div>

      <Card style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Recent high-risk events</h2>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No high-risk events found.</p>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>User</th><th>Trigger</th><th>Risk score</th><th>Actions</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(e => (
                <tr key={e.id || e._id}>
                  <td><code style={{ fontSize: 11 }}>{(e.userId || '').slice(-8)}</code></td>
                  <td>{e.triggerEvent}</td>
                  <td><ScoreBar score={e.scores?.aggregateRiskScore} /></td>
                  <td>
                    {(e.actionsTriggered || []).map(a => (
                      <Badge key={a} color="danger" style={{ marginRight: 4 }}>{a.replace(/_/g, ' ')}</Badge>
                    ))}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {new Date(e.createdAt).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Fraud Feed
// ─────────────────────────────────────────────────────────────────────────────
function FraudFeedTab() {
  const [events,          setEvents]   = useState([]);
  const [total,           setTotal]    = useState(0);
  const [page,            setPage]     = useState(1);
  const [tierFilter,      setTier]     = useState('');
  const [resolvedFilter,  setResolved] = useState('false');
  const [loading,         setLoading]  = useState(false);
  const [selected,        setSelected] = useState(null);
  const [resolving,       setResolving]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (tierFilter)     params.set('tier',     tierFilter);
      if (resolvedFilter) params.set('resolved',  resolvedFilter);
      const res = await apiRequest.get(`/api/trust/fraud-events?${params}`);
      setEvents(res.data.events || []);
      setTotal(res.data.total   || 0);
    } catch {
      toast.error('Failed to load fraud events');
    } finally {
      setLoading(false);
    }
  }, [page, tierFilter, resolvedFilter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (eventId, resolution) => {
    setResolving(true);
    try {
      await apiRequest.post(`/api/trust/fraud-events/${eventId}/resolve`, { resolution });
      setSelected(null);
      load();
    } catch {
      toast.error('Failed to resolve event');
    } finally {
      setResolving(false);
    }
  };

  const TIER_OPTIONS = [
    { value: '',          label: 'All tiers' },
    { value: 'auto_flag', label: 'Auto-flagged' },
    { value: 'kyc_gate',  label: 'KYC gate' },
    { value: 'watchlist', label: 'Watchlist' },
  ];

  const tierOf = (score) =>
    score >= 0.75 ? 'auto_flag' : score >= 0.60 ? 'kyc_gate' : score >= 0.45 ? 'watchlist' : 'clean';

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select value={tierFilter} onChange={setTier} options={TIER_OPTIONS} placeholder="All tiers" />
        <Select
          value={resolvedFilter}
          onChange={setResolved}
          options={[{ value: 'false', label: 'Unresolved' }, { value: 'true', label: 'Resolved' }, { value: '', label: 'All' }]}
        />
        <Btn variant="secondary" onClick={load}>Refresh</Btn>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          {total} events
        </span>
      </div>

      {loading ? (
        <div className="ap-loading">Loading…</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ap-table">
            <thead>
              <tr>
                <th>User ID</th><th>Trigger</th><th>Risk</th><th>Tier</th><th>Actions taken</th><th>When</th><th></th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr
                  key={e.id || e._id}
                  style={{ cursor: 'pointer', background: selected?.id === e.id ? 'var(--color-background-secondary)' : undefined }}
                  onClick={() => setSelected(e)}
                >
                  <td><code style={{ fontSize: 11 }}>{(e.userId || '').slice(-8)}</code></td>
                  <td style={{ fontSize: 12 }}>{e.triggerEvent?.replace(/_/g, ' ')}</td>
                  <td style={{ minWidth: 120 }}><ScoreBar score={e.scores?.aggregateRiskScore} /></td>
                  <td><TierBadge tier={tierOf(e.scores?.aggregateRiskScore || 0)} /></td>
                  <td style={{ fontSize: 11 }}>
                    {(e.actionsTriggered || []).slice(0, 2).map(a => (
                      <span key={a} style={{ marginRight: 4, color: 'var(--color-text-danger)' }}>{a.replace(/_/g, ' ')}</span>
                    ))}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {new Date(e.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td>
                    {!e.resolved && <Badge color="warning">Open</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
        <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</Btn>
        <span style={{ fontSize: 13, alignSelf: 'center' }}>Page {page}</span>
        <Btn variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={events.length < 30}>Next →</Btn>
      </div>

      {selected && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
          background: 'var(--color-background-primary)',
          borderLeft: '1px solid var(--color-border-tertiary)',
          overflowY: 'auto', padding: 24, zIndex: 100,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 500 }}>Event detail</h3>
            <Btn variant="ghost" size="sm" onClick={() => setSelected(null)}>✕</Btn>
          </div>

          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Event ID: <code>{selected.id || selected._id}</code>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            User: <code>{selected.userId}</code>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Score breakdown</div>
            <ScoreBar score={selected.scores?.multiAccountScore}   label="Multi-account" />
            <div style={{ marginTop: 6 }}><ScoreBar score={selected.scores?.deviceSimilarity}   label="Device" /></div>
            <div style={{ marginTop: 6 }}><ScoreBar score={selected.scores?.networkSimilarity}  label="Network" /></div>
            <div style={{ marginTop: 6 }}><ScoreBar score={selected.scores?.behaviorSimilarity} label="Behavior" /></div>
            <div style={{ marginTop: 6 }}><ScoreBar score={selected.scores?.graphClusterDensity}label="Graph" /></div>
            <div style={{ marginTop: 6 }}><ScoreBar score={selected.scores?.referralAbuse}      label="Ref. abuse" /></div>
          </div>

          <div style={{
            background: 'var(--color-background-secondary)',
            borderRadius: 8, padding: 12, fontSize: 12,
            fontFamily: 'var(--font-mono)', marginBottom: 16, lineHeight: 1.6,
          }}>
            {selected.explanation}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Actions triggered</div>
            {(selected.actionsTriggered || []).map(a => (
              <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#dc2626', fontSize: 14 }}>●</span>
                <span style={{ fontSize: 13 }}>{a.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {(!selected.actionsTriggered || selected.actionsTriggered.length === 0) && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Observation only</span>
            )}
          </div>

          {!selected.resolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Resolve as:</div>
              <Btn variant="success" onClick={() => resolve(selected.id || selected._id, 'false_positive')} disabled={resolving}>
                False positive — restore user
              </Btn>
              <Btn variant="danger" onClick={() => resolve(selected.id || selected._id, 'confirmed_fraud')} disabled={resolving}>
                Confirmed fraud
              </Btn>
              <Btn variant="secondary" onClick={() => resolve(selected.id || selected._id, 'escalated')} disabled={resolving}>
                Escalate to team
              </Btn>
            </div>
          )}
          {selected.resolved && (
            <Badge color="success">Resolved: {selected.resolution}</Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Clusters
// ─────────────────────────────────────────────────────────────────────────────
function ClustersTab() {
  const [clusters,  setClusters] = useState([]);
  const [minSize,   setMinSize]  = useState('3');
  const [loading,   setLoading]  = useState(false);
  const [expanded,  setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest.get(`/api/trust/clusters?minSize=${minSize}&limit=50`);
      setClusters(res.data.clusters || []);
    } catch {
      toast.error('Failed to load clusters');
    } finally {
      setLoading(false);
    }
  }, [minSize]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>Min cluster size:</label>
        <input
          type="number"
          value={minSize}
          onChange={e => setMinSize(e.target.value)}
          style={{
            width: 80, padding: '6px 10px', borderRadius: 6,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)', fontSize: 13,
          }}
        />
        <Btn onClick={load} disabled={loading}>Search</Btn>
      </div>

      {loading ? (
        <div className="ap-loading">Loading clusters…</div>
      ) : clusters.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>No clusters found with {minSize}+ members.</p>
      ) : (
        clusters.map(c => (
          <Card
            key={c.clusterId}
            style={{ marginBottom: 12, cursor: 'pointer' }}
            onClick={() => setExpanded(expanded === c.clusterId ? null : c.clusterId)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {(c.clusterId || '').slice(0, 20)}…
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge color={c.userCount >= 10 ? 'danger' : c.userCount >= 5 ? 'warning' : 'info'}>
                  {c.userCount} accounts
                </Badge>
                {(c.allFlags || []).map(f => (
                  <Badge key={f} color="danger">{f.replace(/_/g, ' ')}</Badge>
                ))}
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Betweenness: {((c.avgBetweenness || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <span style={{ fontSize: 18 }}>{expanded === c.clusterId ? '▲' : '▼'}</span>
            </div>

            {expanded === c.clusterId && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Use the Investigation Agent to query this cluster:<br />
                  <code style={{ fontSize: 11 }}>
                    "Show me all members of cluster {(c.clusterId || '').slice(0, 20)}… and their risk scores"
                  </code>
                </p>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Investigation Agent
// ─────────────────────────────────────────────────────────────────────────────
const EXAMPLE_QUERIES = [
  'Find users with referral abuse score above 0.7',
  'Show clusters where more than 5 accounts share a device',
  'List accounts earning rewards with risk score above 0.8',
  'Find all users in auto_flag tier who are not yet resolved',
  'Show me users with referral burst scores above 3',
];

function InvestigateTab() {
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  const submit = async () => {
    if (!query.trim() || loading) return;
    const q = query.trim();
    setLoading(true);
    setQuery('');
    setHistory(h => [...h, { role: 'user', text: q }]);

    try {
      const res = await apiRequest.post('/api/trust/investigate', { query: q });
      const data = res.data;
      setHistory(h => [...h, {
        role:      'agent',
        text:      data.report || data.message || '(no response)',
        toolCalls: data.toolCalls || [],
        duration:  data.duration,
      }]);
    } catch {
      setHistory(h => [...h, { role: 'agent', text: 'Investigation failed — please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {history.length === 0 && (
          <div style={{ padding: '24px 0' }}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Ask the AI investigation agent anything about fraud, abuse, or risk on the platform.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  style={{
                    background: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-border-tertiary)',
                    borderRadius: 8, padding: '10px 14px',
                    textAlign: 'left', cursor: 'pointer',
                    fontSize: 13, color: 'var(--color-text-primary)',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {msg.role === 'user' ? (
              <div style={{
                background: 'var(--color-background-secondary)',
                borderRadius: 10, padding: '10px 14px',
                maxWidth: '80%', marginLeft: 'auto', fontSize: 14,
              }}>
                {msg.text}
              </div>
            ) : (
              <Card style={{ background: 'var(--color-background-secondary)' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'var(--font-sans)', lineHeight: 1.6, margin: 0 }}>
                  {msg.text}
                </pre>
                {msg.toolCalls?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-tertiary)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                      Tool calls: {msg.toolCalls.map(t => t.tool).join(' → ')}
                      {msg.duration && ` · ${(msg.duration / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        ))}

        {loading && (
          <Card style={{ background: 'var(--color-background-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)' }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <span style={{ fontSize: 13 }}>Agent investigating… querying data sources</span>
            </div>
          </Card>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--color-border-tertiary)' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
          placeholder="Ask about fraud, risk, or suspicious patterns…"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)', fontSize: 14,
          }}
          disabled={loading}
        />
        <Btn onClick={submit} disabled={loading || !query.trim()}>Investigate</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Simulate
// ─────────────────────────────────────────────────────────────────────────────
function SimulateTab() {
  const [config, setConfig] = useState({ plan: '2500', totalUsers: 5000, months: 6, runs: 500 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const run = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiRequest.post('/api/trust/simulate', config);
      if (res.data.message) throw new Error(res.data.message);
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const STRATEGY_LABELS = {
    organic:        'Organic users',
    streak_farmer:  'Streak farmers',
    post_farmer:    'Post farmers',
    referral_ring:  'Referral rings',
    combined:       'Combined abusers',
  };

  const STRATEGY_COLORS = {
    organic: '#16a34a', streak_farmer: '#2563eb', post_farmer: '#d97706',
    referral_ring: '#dc2626', combined: '#9333ea',
  };

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>Simulation parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { key: 'plan', label: 'Subscription plan', type: 'select', opts: [{ v: '2500', l: '₹2500' }, { v: '3500', l: '₹3500' }, { v: '4500', l: '₹4500' }] },
            { key: 'totalUsers', label: 'Total active users', type: 'number', min: 100, max: 1000000 },
            { key: 'months',     label: 'Projection (months)', type: 'number', min: 1,   max: 24 },
            { key: 'runs',       label: 'Monte Carlo runs',    type: 'number', min: 100, max: 5000 },
          ].map(({ key, label, type, opts, min, max }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
              {type === 'select' ? (
                <select
                  value={config[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                  className="ap-select"
                >
                  {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : (
                <input
                  type="number" min={min} max={max}
                  value={config[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: parseInt(e.target.value) || min }))}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 6,
                    border: '1px solid var(--color-border-secondary)',
                    background: 'var(--color-background-secondary)',
                    color: 'var(--color-text-primary)', fontSize: 13,
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Btn onClick={run} disabled={loading}>
            {loading ? 'Running simulation…' : 'Run Monte Carlo simulation'}
          </Btn>
        </div>
        {error && <p style={{ color: 'var(--color-text-danger)', marginTop: 10, fontSize: 13 }}>{error}</p>}
      </Card>

      {result && (
        <div>
          <div className="ap-stats-grid" style={{ marginBottom: 20 }}>
            <StatCard label="Total estimated payout"  value={`₹${(result.summary?.totalEstimatedPayoutINR || 0).toLocaleString('en-IN')}`} icon="💸" color="#dc2626" />
            <StatCard label="Subscription revenue"    value={`₹${(result.summary?.totalSubscriptionRevenue || 0).toLocaleString('en-IN')}`} icon="💰" color="#16a34a" />
            <StatCard label="Profitability ratio"      value={result.summary?.overallProfitabilityRatio != null ? `${(result.summary.overallProfitabilityRatio * 100).toFixed(1)}%` : '—'} icon="📊" color="#4f46e5" />
            <StatCard label="High-risk users (est.)"  value={result.summary?.highRiskUserCount} icon="⚠️" color="#d97706" />
          </div>

          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>Strategy breakdown</h3>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Strategy</th><th>User count</th><th>Payout (₹)</th>
                  <th>Revenue (₹)</th><th>Profitability</th><th>Detection rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.strategies || {}).map(([strategy, data]) => (
                  <tr key={strategy}>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STRATEGY_COLORS[strategy] || '#888', marginRight: 8 }} />
                      {STRATEGY_LABELS[strategy] || strategy}
                    </td>
                    <td>{data.userCount?.toLocaleString('en-IN')}</td>
                    <td style={{ color: '#dc2626' }}>₹{data.totalPayout?.estimatedINR?.toLocaleString('en-IN')}</td>
                    <td style={{ color: '#16a34a' }}>₹{data.subscriptionRevenue?.toLocaleString('en-IN')}</td>
                    <td>{data.profitabilityRatio != null ? <ScoreBar score={data.profitabilityRatio} /> : '—'}</td>
                    <td>{data.detectionRate != null ? `${(data.detectionRate * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {(result.vulnerabilities || []).length > 0 && (
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>⚠️ Vulnerability findings</h3>
              {result.vulnerabilities.map((v, i) => (
                <div key={i} style={{
                  padding: 14, borderRadius: 8, marginBottom: 10,
                  background: v.severity === 'high' ? 'rgba(220,38,38,0.06)' : v.severity === 'medium' ? 'rgba(217,119,6,0.06)' : 'rgba(37,99,235,0.06)',
                  borderLeft: `3px solid ${v.severity === 'high' ? '#dc2626' : v.severity === 'medium' ? '#d97706' : '#2563eb'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Badge color={v.severity === 'high' ? 'danger' : v.severity === 'medium' ? 'warning' : 'info'}>{v.severity}</Badge>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{v.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p style={{ fontSize: 13, marginBottom: 6, color: 'var(--color-text-primary)' }}>{v.description}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>💡 {v.recommendation}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',    label: '🛡 Overview' },
  { id: 'feed',        label: '🚨 Fraud feed' },
  { id: 'clusters',   label: '🔗 Clusters' },
  { id: 'investigate',label: '🔍 Investigate' },
  { id: 'simulate',   label: '📊 Simulate' },
];

export default function AdminTrustDashboard() {
  const [tab, setTab] = useState('overview');

  return (
    <div>
      {/* FIX: AdminUIStyles renders the :root CSS vars needed by all sub-tabs */}
      <AdminUIStyles />

      <PageHeader
        title="Trust & Safety Intelligence"
        subtitle="AI-powered fraud detection, behavioral fingerprinting, and economic simulation"
      />

      <div style={{
        display: 'flex', gap: 4,
        borderBottom: '1px solid var(--color-border-tertiary)',
        marginBottom: 24, overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === t.id ? 500 : 400,
              cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <OverviewTab />}
      {tab === 'feed'        && <FraudFeedTab />}
      {tab === 'clusters'    && <ClustersTab />}
      {tab === 'investigate' && <InvestigateTab />}
      {tab === 'simulate'    && <SimulateTab />}
    </div>
  );
}