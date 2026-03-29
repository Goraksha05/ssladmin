// Components/Admin/RewardPayout.js
// ─────────────────────────────────────────────────────────────────────────────
// Payout Management panel — sub-section of AdminFinancial.
//
// Alignment with project conventions:
//
//   • Consumes PayoutContext via usePayouts() — never calls apiRequest directly.
//   • Action handlers (processPayout, updateStatus, bulkProcess) return null on
//     failure; error toasts have already been fired by apiRequest's interceptor
//     so modal close logic checks `if (ok)` rather than catching/re-toasting.
//   • ProtectedRoute / AdminRoute auth guards live in App.js — this component
//     renders only inside an already-guarded route subtree, so it performs no
//     auth checks of its own (mirrors every other Admin/* component).
//   • `loading` from usePayouts() is a map { payouts, claims, summary,
//     action, bulk, user } — not a boolean — so all disabled/spinner checks
//     reference the correct key (e.g. loading.action, not loading).
//   • Export helpers (exportXLSX / exportCSV / exportPDF) are pure local
//     utilities that don't go through apiRequest, so they may call toast
//     directly — this is intentional and does not create double-toast issues.
//
// Tabs:
//   1. Summary        — INR KPIs, reward-type / plan charts, recent-paid feed
//   2. All Payouts    — filterable paginated list with inline status transitions
//   3. Pending Claims — enriched unpaid claims, single + bulk process flows
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { usePayouts } from '../../Context/PayoutContext';
import {
  PageHeader, Card, Btn, Badge, Select,
  Table, Pagination, DateRangeFilter, AdminUIStyles,
} from './AdminUI';

import './RewardPayout.css';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',           label: 'All Statuses' },
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid',       label: 'Paid' },
  { value: 'failed',     label: 'Failed' },
  { value: 'on_hold',    label: 'On Hold' },
];

const TYPE_OPTIONS = [
  { value: '',         label: 'All Types' },
  { value: 'post',     label: 'Post' },
  { value: 'referral', label: 'Referral' },
  { value: 'streak',   label: 'Streak' },
];

const PLAN_LABELS = {
  '2500': 'Basic ₹2500',
  '3500': 'Silver ₹3500',
  '4500': 'Gold ₹4500',
};

const TYPE_COLORS = { post: '#4f46e5', referral: '#10b981', streak: '#f59e0b' };
const PLAN_COLORS = { '2500': '#10b981', '3500': '#4f46e5', '4500': '#f59e0b' };

// Lifecycle transitions — mirrors financeAndPayoutController.js TRANSITIONS map
const TRANSITIONS = {
  pending:    ['processing', 'paid', 'on_hold', 'failed'],
  processing: ['paid', 'failed', 'on_hold'],
  failed:     ['pending'],
  on_hold:    ['pending'],
  paid:       [],
};

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '—';

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT HELPERS
// These are local utility functions — they do not go through apiRequest and
// therefore may call toast directly without risking double-notification.
// ─────────────────────────────────────────────────────────────────────────────

function exportXLSX(rows, name) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name);
  XLSX.writeFile(wb, `${name}_${Date.now()}.xlsx`);
  toast.success('Excel exported');
}

function exportCSVLocal(rows, name) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  saveAs(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${name}_${Date.now()}.csv`
  );
  toast.success('CSV exported');
}

function exportPDFLocal(rows, title) {
  if (!rows.length) { toast.warn('No data to export'); return; }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  const cols = Object.keys(rows[0]);
  doc.autoTable({
    startY: 28,
    head:   [cols],
    body:   rows.map(r => cols.map(c => String(r[c] ?? ''))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229] },
  });
  doc.save(`${title}_${Date.now()}.pdf`);
  toast.success('PDF exported');
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`rp-status rp-status-${status}`}>
    <span>{status === 'paid' ? '✓' : status === 'failed' ? '✗' : '●'}</span>
    {status?.replace('_', ' ')}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// INR BREAKDOWN CARD
// ─────────────────────────────────────────────────────────────────────────────

const BreakdownCard = ({ breakdown = {}, totalAmountINR }) => (
  <div className="rp-breakdown">
    <div className="rp-breakdown__row">
      <span className="rp-breakdown__label">🛒 Grocery Coupons</span>
      <span className="rp-breakdown__val">{fmt(breakdown.groceryCoupons)}</span>
    </div>
    <div className="rp-breakdown__row">
      <span className="rp-breakdown__label">📈 Shares</span>
      <span className="rp-breakdown__val">{fmt(breakdown.shares)}</span>
    </div>
    <div className="rp-breakdown__row">
      <span className="rp-breakdown__label">🪙 Referral Tokens</span>
      <span className="rp-breakdown__val">{fmt(breakdown.referralToken)}</span>
    </div>
    <div className="rp-breakdown__row rp-breakdown__total">
      <span>Total</span>
      <span>{fmt(totalAmountINR)}</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// USER INFO STRIP
// ─────────────────────────────────────────────────────────────────────────────

const UserStrip = ({ user }) => {
  if (!user) return null;
  const name  = user.name || user.username || 'Unknown';
  const email = user.email || '—';
  return (
    <div className="rp-user-strip">
      <div className="rp-user-strip__avatar">{initials(name)}</div>
      <div>
        <div className="rp-user-strip__name">{name}</div>
        <div className="rp-user-strip__email">{email}</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — Update Payout Status
// ─────────────────────────────────────────────────────────────────────────────

const UpdateStatusModal = ({ payout, onClose }) => {
  // `loading` here is the payoutLoading map — check .action, not the whole object
  const { updateStatus, loading } = usePayouts();
  const allowed = TRANSITIONS[payout?.status] ?? [];

  const [form, setForm] = useState({
    status:         allowed[0] || '',
    transactionRef: payout?.transactionRef || '',
    failureReason:  '',
    notes:          '',
  });

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.status) { toast.warn('Choose a target status'); return; }
    if (form.status === 'failed' && !form.failureReason.trim()) {
      toast.warn('Failure reason is required when marking as failed');
      return;
    }
    // updateStatus returns null on failure — the interceptor already toasted
    // the error, so we only close on success (truthy return value)
    const ok = await updateStatus(payout._id, {
      status:         form.status,
      transactionRef: form.transactionRef || undefined,
      failureReason:  form.failureReason  || undefined,
      notes:          form.notes          || undefined,
    });
    if (ok) onClose();
  };

  if (!payout) return null;

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal__header">
          <span className="rp-modal__title">Update Payout Status</span>
          <button className="rp-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="rp-modal__body">
          <UserStrip user={payout.user} />
          <BreakdownCard breakdown={payout.breakdown} totalAmountINR={payout.totalAmountINR} />

          {payout.status === 'paid' || allowed.length === 0 ? (
            <div className="rp-warn-banner">
              {payout.status === 'paid'
                ? '✅ This payout is already paid — no further transitions allowed.'
                : `⚠️ No allowed transitions from "${payout.status}".`
              }
            </div>
          ) : (
            <>
              <div className="rp-field">
                <label>New Status</label>
                <select value={form.status} onChange={e => setField('status', e.target.value)}>
                  {allowed.map(s => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="rp-field">
                <label>Transaction Reference (optional)</label>
                <input
                  value={form.transactionRef}
                  onChange={e => setField('transactionRef', e.target.value)}
                  placeholder="Razorpay ID / NEFT UTR / IMPS ref"
                />
              </div>

              {form.status === 'failed' && (
                <div className="rp-field">
                  <label>
                    Failure Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={form.failureReason}
                    onChange={e => setField('failureReason', e.target.value)}
                    placeholder="Describe why the payout failed"
                  />
                </div>
              )}

              <div className="rp-field">
                <label>Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="Admin note"
                />
              </div>
            </>
          )}
        </div>

        <div className="rp-modal__footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          {allowed.length > 0 && payout.status !== 'paid' && (
            <Btn size="sm" onClick={handleSubmit} disabled={loading.action}>
              {loading.action ? 'Saving…' : 'Update Status'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — Process single pending claim
// ─────────────────────────────────────────────────────────────────────────────

const ProcessClaimModal = ({ claim, onClose }) => {
  const { processPayout, loading } = usePayouts();

  const [form, setForm] = useState({
    status:         'processing',
    transactionRef: '',
    notes:          '',
  });
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    // processPayout returns null on failure; the interceptor has already
    // shown the error toast — we only close the modal on success
    const ok = await processPayout({
      claimId:        claim._id,
      status:         form.status,
      transactionRef: form.transactionRef || undefined,
      notes:          form.notes          || undefined,
    });
    if (ok) onClose();
  };

  if (!claim) return null;

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal__header">
          <span className="rp-modal__title">Process Payout</span>
          <button className="rp-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="rp-modal__body">
          <UserStrip user={claim.user} />

          {/* Risk / readiness warnings */}
          {!claim.hasBankDetails && (
            <div className="rp-warn-banner">⚠️ User has no bank details on file.</div>
          )}
          {claim.rewardsFrozen && (
            <div className="rp-warn-banner">🔒 User's rewards are currently frozen.</div>
          )}
          {claim.kycStatus !== 'verified' && (
            <div className="rp-warn-banner">
              ⚠️ KYC status: <strong>{claim.kycStatus || 'not started'}</strong>
            </div>
          )}

          {/* Claim metadata */}
          <div className="rp-breakdown">
            <div className="rp-breakdown__row">
              <span className="rp-breakdown__label">Reward Type</span>
              <span className="rp-breakdown__val" style={{ textTransform: 'capitalize' }}>
                {claim.type}
              </span>
            </div>
            <div className="rp-breakdown__row">
              <span className="rp-breakdown__label">Milestone</span>
              <span className="rp-breakdown__val">{claim.milestone}</span>
            </div>
            <div className="rp-breakdown__row">
              <span className="rp-breakdown__label">Plan</span>
              <span className="rp-breakdown__val">
                {PLAN_LABELS[claim.planKey] || claim.planKey || '—'}
              </span>
            </div>
            <div className="rp-breakdown__row">
              <span className="rp-breakdown__label">Claimed At</span>
              <span className="rp-breakdown__val">{formatDate(claim.claimedAt)}</span>
            </div>
          </div>

          <BreakdownCard breakdown={claim.breakdown} totalAmountINR={claim.estimatedINR} />

          <div className="rp-field">
            <label>Initial Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid (direct)</option>
            </select>
          </div>

          {form.status === 'paid' && (
            <div className="rp-field">
              <label>Transaction Reference</label>
              <input
                value={form.transactionRef}
                onChange={e => setField('transactionRef', e.target.value)}
                placeholder="Razorpay ID / NEFT UTR"
              />
            </div>
          )}

          <div className="rp-field">
            <label>Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Admin note for this payout"
            />
          </div>
        </div>

        <div className="rp-modal__footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={handleSubmit} disabled={loading.action}>
            {loading.action ? 'Processing…' : 'Create Payout'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — Bulk process results
// ─────────────────────────────────────────────────────────────────────────────

const BulkResultModal = ({ result, onClose }) => {
  if (!result) return null;
  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal wide" onClick={e => e.stopPropagation()}>
        <div className="rp-modal__header">
          <span className="rp-modal__title">Bulk Process Results</span>
          <button className="rp-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="rp-modal__body">
          <div className="rp-bulk-results">
            <div className="rp-bulk-results__item green">
              <span>{result.processed?.length ?? 0}</span>
              <span>Processed</span>
            </div>
            <div className="rp-bulk-results__item yellow">
              <span>{result.skipped?.length ?? 0}</span>
              <span>Skipped</span>
            </div>
            <div className="rp-bulk-results__item red">
              <span>{result.failed?.length ?? 0}</span>
              <span>Failed</span>
            </div>
          </div>

          <div className="rp-breakdown">
            <div className="rp-breakdown__row rp-breakdown__total">
              <span>Total INR Dispatched</span>
              <span>{fmt(result.totalINRDispatched)}</span>
            </div>
          </div>

          {result.failed?.length > 0 && (
            <>
              <div className="rp-section-title">Failed claims</div>
              {result.failed.map((f, i) => (
                <div key={i} className="rp-warn-banner" style={{ fontSize: '.8rem' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>
                    {f.claimId}
                  </code>
                  &nbsp;—&nbsp;{f.reason}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="rp-modal__footer">
          <Btn size="sm" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Summary
// ─────────────────────────────────────────────────────────────────────────────

const SummaryTab = () => {
  const { summary, recentPaid, loading } = usePayouts();

  // Skeleton while fetching
  if (loading.summary && !summary) {
    return (
      <div className="rp-kpi-grid">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rp-kpi-card">
            <div className="rp-skeleton" style={{ height: 14, width: '60%' }} />
            <div className="rp-skeleton" style={{ height: 28, width: '80%', marginTop: 6 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
        No summary data available yet.
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Paid Out',
      value: fmt(summary.totalPaidINR),
      color: '#10b981',
      sub: `${summary.countByStatus?.paid ?? 0} payouts`,
    },
    {
      label: 'Pending / Processing',
      value: fmt(summary.totalPendingINR),
      color: '#f59e0b',
      sub: `${(summary.countByStatus?.pending ?? 0) + (summary.countByStatus?.processing ?? 0)} payouts`,
    },
    {
      label: 'On Hold',
      value: fmt(summary.totalOnHoldINR),
      color: '#8b5cf6',
      sub: `${summary.countByStatus?.on_hold ?? 0} payouts`,
    },
    {
      label: 'Failed',
      value: fmt(summary.totalFailedINR),
      color: '#ef4444',
      sub: `${summary.countByStatus?.failed ?? 0} payouts`,
    },
    {
      label: 'Avg Payout',
      value: fmt(summary.avgPayoutINR),
      color: '#4f46e5',
      sub: 'per paid record',
    },
  ];

  const typeData = Object.entries(summary.paidByRewardType ?? {}).map(([k, v]) => ({
    name: k, value: v, fill: TYPE_COLORS[k] || '#94a3b8',
  }));

  const planData = Object.entries(summary.paidByPlan ?? {}).map(([k, v]) => ({
    name:  PLAN_LABELS[k] || k,
    value: v.totalAmountINR,
    count: v.count,
    fill:  PLAN_COLORS[k] || '#94a3b8',
  }));

  return (
    <div className="rp-root">
      {/* KPI strip */}
      <div className="rp-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="rp-kpi-card" style={{ '--kpi-color': k.color }}>
            <div className="rp-kpi-label">{k.label}</div>
            <div className="rp-kpi-value">{k.value}</div>
            <div className="rp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="rp-chart-row">
        {typeData.length > 0 && (
          <Card>
            <div className="rp-section-title">Paid — by Reward Type</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [fmt(v), '₹ Paid']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {typeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {planData.length > 0 && (
          <Card>
            <div className="rp-section-title">Paid — by Plan</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {planData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={v => [fmt(v), '₹ Paid']} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Recent paid feed */}
      {recentPaid.length > 0 && (
        <Card>
          <div className="rp-section-title">Recently Paid</div>
          <div className="rp-feed">
            {recentPaid.map(p => (
              <div key={p._id} className="rp-feed__item">
                <div className="rp-feed__dot" />
                <span className="rp-feed__name">
                  {p.user?.name || p.user?.username || '—'}
                </span>
                <span className="rp-feed__type">{p.rewardType}</span>
                <span className="rp-feed__amt">{fmt(p.totalAmountINR)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — All Payouts
// ─────────────────────────────────────────────────────────────────────────────

const PayoutsTab = () => {
  const {
    payouts, pagination, page, setPage,
    filters, setFilters, clearFilters,
    loading,
  } = usePayouts();

  // Payout selected for the UpdateStatus modal
  const [selected, setSelected] = useState(null);

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => {
        const u = r.user;
        if (!u) return <span className="rp-mono">—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>
              {u.name || u.username || '—'}
            </span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
              {u.email}
            </span>
          </div>
        );
      },
    },
    {
      key: 'rewardType', label: 'Type',
      render: r => (
        <Badge
          color={
            r.rewardType === 'post'
              ? 'blue'
              : r.rewardType === 'referral'
                ? 'green'
                : 'yellow'
          }
        >
          {r.rewardType}
        </Badge>
      ),
    },
    { key: 'milestone', label: 'Milestone' },
    {
      key: 'planKey', label: 'Plan',
      render: r => (
        <span style={{ fontSize: '.8rem' }}>
          {PLAN_LABELS[r.planKey] || r.planKey || '—'}
        </span>
      ),
    },
    {
      key: 'totalAmountINR', label: 'Amount',
      render: r => <span className="rp-amount">{fmt(r.totalAmountINR)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'transactionRef', label: 'Txn Ref',
      render: r => r.transactionRef
        ? <span className="rp-mono">{r.transactionRef}</span>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'createdAt', label: 'Created',
      render: r => <span style={{ fontSize: '.8rem' }}>{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="rp-action-row">
          <button
            className="rp-btn-icon"
            title={r.status === 'paid' ? 'Already paid' : 'Update status'}
            onClick={() => setSelected(r)}
            disabled={r.status === 'paid'}
          >
            ✎
          </button>
        </div>
      ),
    },
  ];

  // Flatten payouts for export — same shape as AdminFinancial's pattern
  const exportRows = payouts.map(r => ({
    Name:          r.user?.name || '',
    Email:         r.user?.email || '',
    Type:          r.rewardType || '',
    Milestone:     r.milestone || '',
    Plan:          r.planKey || '',
    'Amount (₹)':  r.totalAmountINR ?? 0,
    Status:        r.status || '',
    'Txn Ref':     r.transactionRef || '',
    Created:       formatDate(r.createdAt),
    'Paid At':     formatDate(r.paidAt),
    Notes:         r.notes || '',
  }));

  return (
    <>
      <Card>
        <div className="rp-filter-bar">
          <Select
            value={filters.status}
            onChange={v => setFilters({ status: v })}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
          />
          <Select
            value={filters.rewardType}
            onChange={v => setFilters({ rewardType: v })}
            options={TYPE_OPTIONS}
            placeholder="All Types"
          />
          <DateRangeFilter
            from={filters.from}
            to={filters.to}
            onFrom={v => setFilters({ from: v })}
            onTo={v => setFilters({ to: v })}
          />
          <Btn size="sm" variant="secondary" onClick={clearFilters}>Clear</Btn>

          <div style={{ flex: 1 }} />

          {payouts.length > 0 && (
            <>
              <Btn size="sm" variant="secondary" onClick={() => exportXLSX(exportRows, 'payouts')}>↓ Excel</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportCSVLocal(exportRows, 'payouts')}>↓ CSV</Btn>
              <Btn size="sm" variant="secondary" onClick={() => exportPDFLocal(exportRows, 'Payouts Report')}>↓ PDF</Btn>
            </>
          )}
        </div>

        <Table
          columns={columns}
          rows={payouts}
          loading={loading.payouts}
          empty="No payout records found"
        />
        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>

      {selected && (
        <UpdateStatusModal payout={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Pending Claims
// ─────────────────────────────────────────────────────────────────────────────

const PendingClaimsTab = () => {
  const {
    pendingClaims, claimPagination, claimPage, setClaimPage,
    claimFilters, setClaimFilters, clearClaimFilters,
    loading, bulkProcess,
  } = usePayouts();

  const [selected,   setSelected]   = useState(null);  // claim for ProcessClaimModal
  const [checkedIds, setCheckedIds] = useState([]);    // bulk select
  const [bulkStatus, setBulkStatus] = useState('processing');
  const [bulkResult, setBulkResult] = useState(null);  // BulkResultModal data

  const allIds     = pendingClaims.map(c => String(c._id));
  const allChecked = allIds.length > 0 && checkedIds.length === allIds.length;

  const toggleAll = () => setCheckedIds(allChecked ? [] : allIds);
  const toggleOne = (id) =>
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleBulk = async () => {
    // bulkProcess returns null on failure; interceptor has already toasted
    const result = await bulkProcess(checkedIds, { status: bulkStatus });
    if (result) {
      setCheckedIds([]);
      setBulkResult(result);
    }
  };

  const columns = [
    {
      key: 'check',
      label: (
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          style={{ cursor: 'pointer' }}
        />
      ),
      render: r => (
        <input
          type="checkbox"
          checked={checkedIds.includes(String(r._id))}
          onChange={() => toggleOne(String(r._id))}
          style={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      key: 'user', label: 'User',
      render: r => {
        const u = r.user;
        if (!u) return '—';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>
              {u.name || u.username}
            </span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
              {u.email}
            </span>
          </div>
        );
      },
    },
    {
      key: 'type', label: 'Type',
      render: r => (
        <Badge
          color={
            r.type === 'post'
              ? 'blue'
              : r.type === 'referral'
                ? 'green'
                : 'yellow'
          }
        >
          {r.type}
        </Badge>
      ),
    },
    { key: 'milestone', label: 'Milestone' },
    {
      key: 'planKey', label: 'Plan',
      render: r => (
        <span style={{ fontSize: '.8rem' }}>
          {PLAN_LABELS[r.planKey] || r.planKey || '—'}
        </span>
      ),
    },
    {
      key: 'estimatedINR', label: 'Est. Amount',
      render: r => (
        <span className={r.estimatedINR > 0 ? 'rp-amount' : 'rp-amount-warn'}>
          {fmt(r.estimatedINR)}
        </span>
      ),
    },
    {
      key: 'hasBankDetails', label: 'Bank',
      render: r => r.hasBankDetails
        ? <Badge color="green">✓ Set</Badge>
        : <Badge color="default">—</Badge>,
    },
    {
      key: 'kycStatus', label: 'KYC',
      render: r => (
        <Badge color={r.kycStatus === 'verified' ? 'green' : 'default'}>
          {r.kycStatus || 'n/a'}
        </Badge>
      ),
    },
    {
      key: 'rewardsFrozen', label: 'Frozen',
      render: r => r.rewardsFrozen
        ? <Badge color="red">🔒</Badge>
        : <Badge color="default">—</Badge>,
    },
    {
      key: 'claimedAt', label: 'Claimed',
      render: r => (
        <span style={{ fontSize: '.8rem' }}>{formatDate(r.claimedAt)}</span>
      ),
    },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="rp-action-row">
          <button
            className="rp-btn-icon success"
            title="Process this claim"
            onClick={() => setSelected(r)}
          >
            ▶
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        {/* Claim sub-filters */}
        <div className="rp-filter-bar">
          <Select
            value={claimFilters.type}
            onChange={v => setClaimFilters({ type: v })}
            options={TYPE_OPTIONS}
            placeholder="All Types"
          />
          <input
            type="number"
            min="0"
            placeholder="Min ₹ amount"
            value={claimFilters.minINR}
            onChange={e => setClaimFilters({ minINR: e.target.value })}
            style={{
              padding: '.35rem .6rem',
              borderRadius: 7,
              border: '1px solid var(--border-color)',
              fontSize: '.85rem',
              background: 'var(--bg)',
              minWidth: 120,
            }}
          />
          <label style={{
            display: 'flex', alignItems: 'center', gap: '.35rem',
            fontSize: '.875rem', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={!!claimFilters.bankOnly}
              onChange={e => setClaimFilters({ bankOnly: e.target.checked })}
            />
            Bank details only
          </label>
          <Btn size="sm" variant="secondary" onClick={clearClaimFilters}>Clear</Btn>
        </div>

        {/* Bulk action bar — only visible when items are checked */}
        {checkedIds.length > 0 && (
          <div className="rp-bulk-bar">
            <span className="rp-bulk-bar__count">{checkedIds.length} selected</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              style={{
                padding: '.3rem .6rem',
                borderRadius: 6,
                border: '1px solid #bfdbfe',
                fontSize: '.85rem',
                background: '#eff6ff',
                color: '#1e40af',
              }}
            >
              <option value="processing">→ Processing</option>
              <option value="paid">→ Paid (direct)</option>
            </select>
            <div className="rp-bulk-bar__spacer" />
            <Btn
              size="sm"
              variant="secondary"
              onClick={() => setCheckedIds([])}
            >
              Deselect All
            </Btn>
            <Btn
              size="sm"
              onClick={handleBulk}
              disabled={loading.bulk}
            >
              {loading.bulk
                ? 'Processing…'
                : `Bulk Process (${checkedIds.length})`
              }
            </Btn>
          </div>
        )}

        <Table
          columns={columns}
          rows={pendingClaims}
          loading={loading.claims}
          empty="No pending claims — all rewards have been paid out 🎉"
        />
        <Pagination
          page={claimPage}
          pages={claimPagination.pages}
          onPage={setClaimPage}
        />
      </Card>

      {selected && (
        <ProcessClaimModal claim={selected} onClose={() => setSelected(null)} />
      )}

      {bulkResult && (
        <BulkResultModal result={bulkResult} onClose={() => setBulkResult(null)} />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const RewardPayout = () => {
  const [tab, setTab] = useState('summary');
  const { claimPagination, pendingClaims, loading, refresh } = usePayouts();

  // Show the unprocessed count on the Pending Claims tab badge.
  // Use server-reported total (claimPagination.total) when available; fall
  // back to the length of the current page slice.
  const pendingCount = claimPagination.total ?? pendingClaims.length;
  const isBusy = loading.payouts || loading.claims || loading.summary;

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Reward Payouts"
        subtitle="Process, track and manage all user reward disbursements"
        actions={
          <Btn
            size="sm"
            variant="secondary"
            onClick={refresh}
            disabled={isBusy}
          >
            {isBusy ? '⟳ Loading…' : '⟳ Refresh'}
          </Btn>
        }
      />

      {/* Tab bar */}
      <div className="rp-tabs">
        {[
          { id: 'summary', label: 'Summary' },
          { id: 'payouts', label: 'All Payouts' },
          {
            id: 'claims',
            label: 'Pending Claims',
            badge: pendingCount > 0 ? pendingCount : null,
          },
        ].map(t => (
          <button
            key={t.id}
            className={`rp-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge != null && (
              <span className="rp-tab-badge">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'payouts' && <PayoutsTab />}
      {tab === 'claims'  && <PendingClaimsTab />}
    </>
  );
};

export default RewardPayout;