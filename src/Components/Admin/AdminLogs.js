// Components/Admin/AdminLogs.js — Activity Audit Logs
import React, { useEffect, useState, useCallback } from 'react';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import {
  PageHeader, Card, Btn, Badge, SearchBar,
  Table, Pagination, DateRangeFilter, AdminUIStyles,
} from './AdminUI';

const ACTION_COLORS = {
  user_ban:           'red',
  user_unban:         'green',
  user_delete:        'red',
  user_suspend:       'yellow',
  user_activate:      'green',
  user_reset_rewards: 'yellow',
  reward_undo:        'yellow',
  admin_promote:      'purple',
  admin_demote:       'red',
  post_approved:      'green',
  post_rejected:      'red',
  post_delete:        'red',
};

const actionColor = (action) => ACTION_COLORS[action] || 'default';

const actionIcon = (action) => {
  if (action?.includes('delete'))  return '🗑';
  if (action?.includes('ban'))     return '🚫';
  if (action?.includes('unban'))   return '✓';
  if (action?.includes('promote')) return '⬆';
  if (action?.includes('demote'))  return '⬇';
  if (action?.includes('reward'))  return '◇';
  if (action?.includes('post'))    return '▨';
  if (action?.includes('suspend')) return '⏸';
  if (action?.includes('reset'))   return '↺';
  return '◎';
};

// ── Log Detail Modal ────────────────────────────────────────────────────────
const LogDetail = ({ log, onClose }) => (
  <div className="lg-overlay" onClick={onClose}>
    <div className="lg-modal" onClick={e => e.stopPropagation()}>
      <div className="lg-modal-header">
        <div className="lg-modal-title">Log Entry</div>
        <button className="lg-close" onClick={onClose}>✕</button>
      </div>
      <div className="lg-modal-body">
        {[
          ['Action',      log.action],
          ['Admin',       `${log.adminId?.name || '—'} (${log.adminId?.email || log.adminEmail || '—'})`],
          ['Target User', log.targetUser?.email || log.targetEmail || '—'],
          ['IP Address',  log.ip || '—'],
          ['Timestamp',   new Date(log.createdAt).toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="lg-detail-row">
            <span className="lg-detail-key">{k}</span>
            <span className="lg-detail-val">{v}</span>
          </div>
        ))}
        {log.details && Object.keys(log.details).length > 0 && (
          <>
            <div className="lg-detail-section">Metadata</div>
            <pre className="lg-pre">{JSON.stringify(log.details, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────────
const AdminLogs = () => {
  const [logs,       setLogs]       = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const [detail,     setDetail]     = useState(null);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 25,
        ...(actionFilter && { action: actionFilter }),
        ...(dateFrom     && { from: dateFrom }),
        ...(dateTo       && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/logs?${params}`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load logs'); }
    finally   { setLoading(false); }
  }, [actionFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [actionFilter, dateFrom, dateTo]);
  useEffect(() => { fetchLogs(page); }, [page, actionFilter, dateFrom, dateTo]);

  const columns = [
    {
      key: 'icon', label: '',
      render: l => <span style={{ fontSize: '1.125rem' }}>{actionIcon(l.action)}</span>,
    },
    {
      key: 'action', label: 'Action',
      render: l => <Badge color={actionColor(l.action)}>{l.action}</Badge>,
    },
    {
      key: 'adminId', label: 'By Admin',
      render: l => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{l.adminId?.name || '—'}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{l.adminId?.email || l.adminEmail}</div>
        </div>
      ),
    },
    {
      key: 'targetUser', label: 'Target',
      render: l => l.targetUser?.email || l.targetEmail || <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'ip', label: 'IP',
      render: l => <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.8125rem' }}>{l.ip || '—'}</span>,
    },
    {
      key: 'createdAt', label: 'Time',
      render: l => (
        <div>
          <div style={{ fontSize: '.875rem' }}>{new Date(l.createdAt).toLocaleDateString()}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{new Date(l.createdAt).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: 'view', label: '',
      render: l => <Btn size="sm" variant="ghost" onClick={() => setDetail(l)}>View</Btn>,
    },
  ];

  // Quick stats
  const actionCounts = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});
  const topActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Activity Logs"
        subtitle={`${pagination.total?.toLocaleString() ?? '—'} total log entries`}
        actions={<Btn size="sm" variant="secondary" onClick={() => fetchLogs(page)}>↻ Refresh</Btn>}
      />

      {/* Quick stats */}
      {topActions.length > 0 && (
        <Card style={{ marginBottom: '1rem' }}>
          <div className="ap-section-title" style={{ marginBottom: '.75rem' }}>Recent Activity Summary</div>
          <div className="lg-action-chips">
            {topActions.map(([action, count]) => (
              <button
                key={action}
                className={`lg-chip ${actionFilter === action ? 'lg-chip-active' : ''}`}
                onClick={() => setActionFilter(f => f === action ? '' : action)}
              >
                {actionIcon(action)} {action}
                <span className="lg-chip-count">{count}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: '1rem' }}>
        <div className="ap-filter-bar">
          <SearchBar value={actionFilter} onChange={setActionFilter} placeholder="Filter by action…" />
          <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
          <Btn size="sm" variant="secondary" onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}>
            Clear
          </Btn>
        </div>
      </Card>

      <Card>
        <Table columns={columns} rows={logs} loading={loading} empty="No log entries found" />
        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>

      {detail && <LogDetail log={detail} onClose={() => setDetail(null)} />}

      <style>{`
        .lg-action-chips { display:flex; gap:.5rem; flex-wrap:wrap; }
        .lg-chip         { display:flex; align-items:center; gap:.375rem; padding:.375rem .875rem; background:var(--bg-canvas); border:1px solid var(--border); border-radius:9999px; font-size:.8125rem; font-weight:600; color:var(--text-secondary); cursor:pointer; transition:all .2s; }
        .lg-chip:hover   { border-color:var(--accent); color:var(--accent); }
        .lg-chip-active  { background:rgba(79,70,229,.1); border-color:var(--accent); color:var(--accent); }
        .lg-chip-count   { background:var(--border); color:var(--text-secondary); font-size:.6875rem; padding:.1rem .4rem; border-radius:4px; font-family:'DM Mono',monospace; }
        .lg-overlay      { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); z-index:400; display:flex; align-items:center; justify-content:center; padding:1rem; }
        .lg-modal        { background:var(--bg-card); border:1px solid var(--border); border-radius:16px; max-width:500px; width:100%; box-shadow:var(--shadow-pop); overflow:hidden; }
        .lg-modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); }
        .lg-modal-title  { font-size:1rem; font-weight:700; color:var(--text-primary); }
        .lg-close        { background:var(--bg-canvas); border:1px solid var(--border); color:var(--text-secondary); width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:1rem; }
        .lg-modal-body   { padding:1.25rem 1.5rem; max-height:70vh; overflow-y:auto; }
        .lg-detail-row   { display:flex; justify-content:space-between; gap:1rem; padding:.5rem .75rem; border-radius:8px; font-size:.875rem; }
        .lg-detail-row:nth-child(odd) { background:var(--bg-canvas); }
        .lg-detail-key   { color:var(--text-secondary); font-weight:500; flex-shrink:0; }
        .lg-detail-val   { color:var(--text-primary); font-weight:600; text-align:right; word-break:break-all; }
        .lg-detail-section { font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text-secondary); margin:1rem 0 .5rem; }
        .lg-pre          { background:var(--bg-canvas); border:1px solid var(--border); border-radius:8px; padding:.875rem; font-size:.8125rem; overflow-x:auto; color:var(--text-primary); font-family:'DM Mono',monospace; }
      `}</style>
    </>
  );
};

export default AdminLogs;