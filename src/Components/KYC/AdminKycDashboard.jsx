/**
 * Components/KYC/AdminKycDashboard.js
 *
 * NEW FILE — Full KYC review & approval panel for admins.
 *
 * Backend endpoints consumed:
 *   GET    /api/admin/kyc              → paginated list of all KYC submissions
 *                                        query: ?status=&page=&limit=&search=
 *   GET    /api/admin/kyc/:userId      → full KYC record + OCR data for a user
 *   PATCH  /api/admin/kyc/:userId/verify  → approve KYC   body: { notes? }
 *   PATCH  /api/admin/kyc/:userId/reject  → reject  KYC   body: { reason }
 *   PATCH  /api/admin/kyc/:userId/reset   → reset to not_started (optional)
 *
 * Permission required: view_users  (reads KYC data)
 *                      manage_users or approve_kyc  (approve / reject)
 *
 * Auth: all requests go through apiRequest which attaches the Bearer token
 *       from localStorage automatically via the request interceptor.
 *
 * Design: editorial admin aesthetic — dense data table + slide-in detail drawer.
 */

import React, {
  useEffect, useState, useCallback, useRef,
} from 'react';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import { usePermissions } from '../../Context/PermissionsContext';
import {
  PageHeader, Card, Btn, Badge, Table,
  Pagination, SearchBar, Select, Spinner, AdminUIStyles,
} from '../Admin/AdminUI';
import './AdminKycDashboard.css';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  not_started: { label: 'Not Started', color: 'default', icon: '○' },
  required: { label: 'Required', color: 'yellow', icon: '!' },
  submitted: { label: 'Submitted', color: 'blue', icon: '◷' },
  verified: { label: 'Verified', color: 'green', icon: '✓' },
  rejected: { label: 'Rejected', color: 'red', icon: '✗' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted (Pending Review)' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'required', label: 'Required' },
  { value: 'not_started', label: 'Not Started' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

// ── Score bar (liveness / match score) ───────────────────────────────────────
const ScoreBar = ({ value, label }) => {
  if (value == null) return <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: '.75rem', fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
};

// ── Document thumbnail ────────────────────────────────────────────────────────
const DocThumb = ({ url, label }) => {
  const [err, setErr] = useState(false);
  if (!url) return null;
  return (
    <div className="kyc-doc-thumb">
      <span className="kyc-doc-label">{label}</span>
      {err ? (
        <div className="kyc-doc-placeholder">Image unavailable</div>
      ) : (
        <img
          src={url}
          alt={label}
          className="kyc-doc-img"
          onError={() => setErr(true)}
        />
      )}
    </div>
  );
};

// ── RejectModal ───────────────────────────────────────────────────────────────
const RejectModal = ({ userId, userName, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const PRESETS = [
    'Document image is blurry or unreadable',
    'Document appears to be expired',
    'Name on document does not match account name',
    'Document type not accepted',
    'Face match score below threshold',
    'Suspected fraudulent document',
  ];

  const submit = async () => {
    if (!reason.trim()) { toast.warn('Please provide a rejection reason'); return; }
    setSaving(true);
    try {
      // FIX: /api/kyc/:id/reject (not /api/admin/kyc/:id/reject)
      await apiRequest.patch(`/api/kyc/${userId}/reject`, { reason: reason.trim() });
      toast.success(`KYC rejected for ${userName}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to reject KYC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kyc-overlay" onClick={onClose}>
      <div className="kyc-modal" onClick={e => e.stopPropagation()}>
        <div className="kyc-modal-header">
          <h3 className="kyc-modal-title">Reject KYC — {userName}</h3>
          <button className="kyc-modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="kyc-modal-desc">
          The user will be notified with this reason and asked to resubmit.
        </p>

        <label className="kyc-field-label">Rejection Reason</label>
        <textarea
          className="kyc-textarea"
          rows={4}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe why the KYC was rejected…"
          autoFocus
        />

        <div className="kyc-presets">
          <span className="kyc-presets-label">Quick select:</span>
          {PRESETS.map(p => (
            <button key={p} className="kyc-preset-btn" onClick={() => setReason(p)}>{p}</button>
          ))}
        </div>

        <div className="kyc-modal-footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" size="sm" onClick={submit} disabled={saving || !reason.trim()}>
            {saving ? 'Rejecting…' : 'Confirm Rejection'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── Detail Drawer ─────────────────────────────────────────────────────────────
const KycDrawer = ({ userId, onClose, onApprove, onReject, canAct }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setLoading(true);
    // FIX: correct prefix /api/kyc/:id (not /api/admin/kyc/:id)
    apiRequest.get(`/api/kyc/${userId}`)
      .then(r => setDetail(r.data))
      .catch(() => toast.error('Failed to load KYC details'))
      .finally(() => setLoading(false));
  }, [userId]);

  const approve = async () => {
    setApproving(true);
    try {
      // FIX: /api/kyc/:id/verify (not /api/admin/kyc/:id/verify)
      await apiRequest.patch(`/api/kyc/${userId}/verify`, { notes: notes || undefined });
      toast.success('KYC approved successfully');
      onApprove();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to approve KYC');
    } finally {
      setApproving(false);
    }
  };

  const kyc = detail?.kyc;
  const user = detail?.user;
  const ocr = kyc?.ocrData || {};
  const thumbs = kyc?.thumbnails || {};
  const status = kyc?.status || 'not_started';
  const meta = STATUS_META[status] || STATUS_META.not_started;

  return (
    <div className="kyc-drawer">
      <div className="kyc-drawer-header">
        <div className="kyc-drawer-title-row">
          <div className="kyc-drawer-avatar">
            {(user?.name || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div className="kyc-drawer-name">{user?.name || '—'}</div>
            <div className="kyc-drawer-email">{user?.email}</div>
          </div>
        </div>
        <button className="kyc-drawer-close" onClick={onClose}>✕</button>
      </div>

      {loading ? <Spinner /> : !detail ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Failed to load KYC data
        </div>
      ) : (
        <div className="kyc-drawer-body">
          {/* Status banner */}
          <div className={`kyc-status-banner kyc-status-${status}`}>
            <span className="kyc-status-icon">{meta.icon}</span>
            <div>
              <div className="kyc-status-title">{meta.label}</div>
              {kyc?.submittedAt && (
                <div className="kyc-status-sub">Submitted {fmtDateTime(kyc.submittedAt)}</div>
              )}
              {kyc?.verifiedAt && (
                <div className="kyc-status-sub">Verified {fmtDateTime(kyc.verifiedAt)}</div>
              )}
              {kyc?.rejectionReason && (
                <div className="kyc-rejection-reason">
                  Rejection reason: {kyc.rejectionReason}
                </div>
              )}
            </div>
          </div>

          {/* Scores */}
          {(kyc?.liveness != null || kyc?.score != null) && (
            <div className="kyc-section">
              <div className="kyc-section-title">Verification Scores</div>
              <div className="kyc-score-grid">
                <div className="kyc-score-row">
                  <span className="kyc-score-label">Liveness</span>
                  <ScoreBar value={kyc.liveness} />
                </div>
                <div className="kyc-score-row">
                  <span className="kyc-score-label">Face Match</span>
                  <ScoreBar value={kyc.score} />
                </div>
              </div>
            </div>
          )}

          {/* OCR data */}
          {Object.keys(ocr).length > 0 && (
            <div className="kyc-section">
              <div className="kyc-section-title">OCR — Extracted Document Data</div>
              <div className="kyc-ocr-grid">
                {Object.entries(ocr).map(([k, v]) => (
                  <div key={k} className="kyc-ocr-row">
                    <span className="kyc-ocr-key">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="kyc-ocr-val">{String(v) || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document thumbnails */}
          {Object.keys(thumbs).length > 0 && (
            <div className="kyc-section">
              <div className="kyc-section-title">Document Images</div>
              <div className="kyc-thumbs-grid">
                {Object.entries(thumbs).map(([k, url]) => (
                  <DocThumb key={k} url={url} label={k.replace(/([A-Z])/g, ' $1').trim()} />
                ))}
              </div>
            </div>
          )}

          {/* User info */}
          <div className="kyc-section">
            <div className="kyc-section-title">User Account</div>
            <div className="kyc-info-grid">
              {[
                ['Name', user?.name],
                ['Email', user?.email],
                ['Phone', user?.phone],
                ['Plan', user?.subscription?.plan || 'None'],
                ['Sub Active', user?.subscription?.active ? 'Yes' : 'No'],
                ['Account Created', fmtDate(user?.date)],
              ].map(([k, v]) => (
                <div key={k} className="kyc-info-row">
                  <span className="kyc-info-key">{k}</span>
                  <span className="kyc-info-val">{v ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action area — only for submitted KYC, only if admin has permission */}
          {status === 'submitted' && canAct && (
            <div className="kyc-action-section">
              <div className="kyc-section-title">Review Decision</div>
              <label className="kyc-field-label" style={{ marginBottom: '.375rem', display: 'block' }}>
                Notes (optional — not shown to user)
              </label>
              <textarea
                className="kyc-textarea"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal note about this review…"
                style={{ marginBottom: '1rem' }}
              />
              <div className="kyc-action-btns">
                <Btn
                  variant="success"
                  onClick={approve}
                  disabled={approving}
                  style={{ flex: 1 }}
                >
                  {approving ? 'Approving…' : '✓ Approve KYC'}
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => onReject(userId, user?.name || user?.email)}
                  style={{ flex: 1 }}
                >
                  ✗ Reject KYC
                </Btn>
              </div>
            </div>
          )}

          {/* Re-review already verified */}
          {status === 'verified' && canAct && (
            <div className="kyc-action-section">
              <Badge color="green" style={{ fontSize: '.875rem', padding: '.5rem 1rem' }}>
                ✓ KYC already verified — no action needed
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const AdminKycDashboard = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();

  // Permissions — view_users is the minimum; approve_kyc or manage_admins to act
  const canView = hasPermission('view_users') || isSuperAdmin;
  const canAct = hasPermission('approve_kyc') || hasPermission('manage_admins') || isSuperAdmin;

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('submitted'); // default: pending review
  const [page, setPage] = useState(1);
  const [drawerUser, setDrawerUser] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // { userId, userName }
  const [stats, setStats] = useState(null);

  const searchTimer = useRef(null);

  const fetchRecords = useCallback(async (p = 1) => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 20,
        ...(status && { status }),
        ...(search && { search }),
      });
      // FIX: correct prefix is /api/kyc (mounted in index.js as app.use('/api/kyc', ...))
      // NOT /api/admin/kyc — that path is never registered on the backend.
      const res = await apiRequest.get(`/api/kyc?${params}`);
      setRecords(res.data.users || res.data.records || []);
      setPagination(res.data.pagination || { page: p, pages: 1, total: res.data.total || 0 });
    } catch {
      toast.error('Failed to load KYC records');
    } finally {
      setLoading(false);
    }
  }, [status, search, canView]);

  const fetchStats = useCallback(async () => {
    if (!canView) return;
    try {
      // FIX: correct prefix /api/kyc/stats (not /api/admin/kyc/stats)
      const res = await apiRequest.get('/api/kyc/stats');
      setStats(res.data);
    } catch {
      // Stats are non-critical — fail silently
    }
  }, [canView]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchRecords(1);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search, status, fetchRecords]);

  useEffect(() => { fetchRecords(page); }, [page]); // eslint-disable-line
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleApproved = () => {
    fetchRecords(page);
    fetchStats();
  };

  const handleRejected = () => {
    fetchRecords(page);
    fetchStats();
    setDrawerUser(null);
  };

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => {
        const user = r.user || r;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div className="kyc-table-avatar">
              {(user.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text-primary)' }}>{user.name || '—'}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{user.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'status', label: 'KYC Status',
      render: r => {
        const s = r.kyc?.status || r.kycStatus || 'not_started';
        const m = STATUS_META[s] || STATUS_META.not_started;
        return <Badge color={m.color}>{m.icon} {m.label}</Badge>;
      },
    },
    {
      key: 'score', label: 'Face Match',
      render: r => <ScoreBar value={r.kyc?.score ?? r.kycScore} />,
    },
    {
      key: 'liveness', label: 'Liveness',
      render: r => <ScoreBar value={r.kyc?.liveness ?? r.kycLiveness} />,
    },
    {
      key: 'submittedAt', label: 'Submitted',
      render: r => (
        <span style={{ fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
          {fmtDate(r.kyc?.submittedAt || r.kycSubmittedAt)}
        </span>
      ),
    },
    {
      key: 'plan', label: 'Plan',
      render: r => {
        const plan = r.user?.subscription?.plan || r.subscription?.plan;
        return plan ? <Badge color="blue">{plan}</Badge> : <Badge color="default">None</Badge>;
      },
    },
    {
      key: 'actions', label: 'Actions',
      render: r => {
        const uid = r.user?._id || r._id;
        const s = r.kyc?.status || r.kycStatus || 'not_started';
        return (
          <div style={{ display: 'flex', gap: '.375rem' }}>
            <Btn size="sm" variant="ghost" onClick={() => setDrawerUser(uid)}>
              View
            </Btn>
            {s === 'submitted' && canAct && (
              <>
                <Btn size="sm" variant="success" onClick={async () => {
                  try {
                    // FIX: /api/kyc/:id/verify (not /api/admin/kyc/:id/verify)
                    await apiRequest.patch(`/api/kyc/${uid}/verify`);
                    toast.success('KYC approved');
                    handleApproved();
                  } catch (e) {
                    toast.error(e?.response?.data?.message || 'Failed to approve');
                  }
                }}>✓</Btn>
                <Btn size="sm" variant="danger" onClick={() =>
                  setRejectTarget({ userId: uid, userName: r.user?.name || r.name || uid })
                }>✗</Btn>
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (!canView) {
    return (
      <>
        <AdminUIStyles />
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h3 style={{ color: 'var(--text-primary)' }}>Access Restricted</h3>
          <p>You need the <code>view_users</code> permission to access KYC records.</p>
        </div>
      </>
    );
  }

  const pendingCount = stats?.submitted ?? records.filter(r =>
    (r.kyc?.status || r.kycStatus) === 'submitted'
  ).length;

  return (
    <>
      <AdminUIStyles />

      <PageHeader
        title="KYC Review Dashboard"
        subtitle="Review, approve and reject identity verification submissions"
        actions={
          <Btn size="sm" variant="secondary" onClick={() => { fetchRecords(page); fetchStats(); }}>
            ↻ Refresh
          </Btn>
        }
      />

      {/* Stats row */}
      {stats && (
        <div className="ap-stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Pending Review', value: stats.submitted ?? 0, color: '#f59e0b', icon: '◷' },
            { label: 'Verified', value: stats.verified ?? 0, color: '#10b981', icon: '✓' },
            { label: 'Rejected', value: stats.rejected ?? 0, color: '#ef4444', icon: '✗' },
            { label: 'Total Submitted', value: stats.total ?? 0, color: '#4f46e5', icon: '▤' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="ap-stat-card" style={{ '--sc-color': color }}>
              <div className="ap-stat-top">
                <div className="ap-stat-icon" style={{ fontSize: '1.25rem' }}>{icon}</div>
              </div>
              <div className="ap-stat-value">{value.toLocaleString()}</div>
              <div className="ap-stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending alert banner */}
      {pendingCount > 0 && (
        <div className="kyc-alert-banner">
          <span>⚠️</span>
          <span>
            <strong>{pendingCount} KYC submission{pendingCount !== 1 ? 's' : ''}</strong> awaiting review
            {!canAct && ' — you need the approve_kyc permission to take action'}
          </span>
          {status !== 'submitted' && (
            <Btn size="sm" onClick={() => setStatus('submitted')}>
              View Pending
            </Btn>
          )}
        </div>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: '1rem' }}>
        <div className="ap-filter-bar">
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, email…" />
          <Select value={status} onChange={v => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} placeholder="All Statuses" />
          {status && (
            <Btn size="sm" variant="secondary" onClick={() => { setStatus(''); setSearch(''); setPage(1); }}>
              Clear
            </Btn>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
            {pagination.total?.toLocaleString() ?? '—'} records
          </span>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          rows={records}
          loading={loading}
          empty={
            status === 'submitted'
              ? '🎉 No pending KYC submissions — all caught up!'
              : 'No KYC records match your filters'
          }
        />
        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>

      {/* Detail Drawer */}
      {drawerUser && (
        <>
          <div className="kyc-drawer-overlay" onClick={() => setDrawerUser(null)} />
          <KycDrawer
            userId={drawerUser}
            onClose={() => setDrawerUser(null)}
            onApprove={handleApproved}
            onReject={(uid, name) => { setRejectTarget({ userId: uid, userName: name }); }}
            canAct={canAct}
          />
        </>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          userId={rejectTarget.userId}
          userName={rejectTarget.userName}
          onClose={() => setRejectTarget(null)}
          onDone={handleRejected}
        />
      )}
    </>
  );
};

export default AdminKycDashboard;