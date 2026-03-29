// ═══════════════════════════════════════════════════════════════════════════
// FILE: Components/Admin/AdminAuditLogs.js
//
// CHANGES:
//   1. FIX — `ap-filter-bar` class already has `margin-bottom:1.25rem` in
//      AdminUIStyles; removed the duplicate style override.
//   2. FIX — page reset when action filter changes: was already correct with
//      `useEffect(() => { setPage(1); }, [action])`. No change needed.
//   3. FIX — Added error toast for page-change fetches (was only on initial load).
// ═══════════════════════════════════════════════════════════════════════════

// Components/Admin/AdminAuditLogs.js
import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import {
  PageHeader, Card, Badge, Table, Pagination, Select, AdminUIStyles,
} from './AdminUI';

const ACTION_COLORS = {
  admin_login:       'blue',
  admin_create:      'green',
  admin_delete:      'red',
  admin_role_change: 'purple',
  reward_undo:       'yellow',
  user_ban:          'red',
  user_suspend:      'yellow',
  post_delete:       'red',
  role_created:      'green',
  role_updated:      'blue',
  role_deleted:      'red',
};

const ACTIONS = [
  { value: '',                label: 'All Actions' },
  { value: 'admin_login',     label: 'Admin Login' },
  { value: 'admin_create',    label: 'Admin Created' },
  { value: 'admin_delete',    label: 'Admin Deleted' },
  { value: 'admin_role_change', label: 'Role Changed' },
  { value: 'reward_undo',     label: 'Reward Undone' },
  { value: 'user_ban',        label: 'User Banned' },
  { value: 'user_suspend',    label: 'User Suspended' },
  { value: 'post_delete',     label: 'Post Deleted' },
  { value: 'role_created',    label: 'Role Created' },
  { value: 'role_updated',    label: 'Role Updated' },
  { value: 'role_deleted',    label: 'Role Deleted' },
];

const AdminAuditLogs = () => {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);
  const [action,  setAction]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (action) params.set('action', action);
      const res = await apiRequest.get(`/api/admin/audit-logs?${params}`);
      setLogs(res.data.logs);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => { setPage(1); }, [action]);
  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      key: 'createdAt', label: 'Time',
      render: l => (
        <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {new Date(l.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action', label: 'Action',
      render: l => (
        <Badge color={ACTION_COLORS[l.action] ?? 'default'}>
          {l.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'adminEmail', label: 'Admin',
      render: l => <span style={{ fontSize: '.875rem', color: 'var(--text-primary)' }}>{l.adminEmail ?? '—'}</span>,
    },
    {
      key: 'targetEmail', label: 'Target',
      render: l => <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{l.targetEmail ?? '—'}</span>,
    },
    {
      key: 'details', label: 'Details',
      render: l => {
        const d = l.details ?? {};
        const entries = Object.entries(d).filter(([k]) => !['targetId','adminId'].includes(k));
        if (!entries.length) return <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>—</span>;
        return (
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', maxWidth: 240 }}>
            {entries.slice(0, 3).map(([k, v]) => (
              <div key={k}><strong>{k}:</strong> {String(v).slice(0, 40)}</div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'ip', label: 'IP',
      render: l => (
        <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {l.ip ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Audit Logs"
        subtitle={`${total.toLocaleString()} event${total !== 1 ? 's' : ''} recorded`}
      />

      <div className="ap-filter-bar">
        <Select value={action} onChange={setAction} options={ACTIONS} placeholder="All Actions" />
        <span style={{ fontSize: '.8125rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          Page {page} of {pages}
        </span>
      </div>

      <Card>
        <Table columns={columns} rows={logs} loading={loading} empty="No audit events found" />
        <Pagination page={page} pages={pages} onPage={setPage} />
      </Card>
    </>
  );
};

export { AdminAuditLogs };
export default AdminAuditLogs;