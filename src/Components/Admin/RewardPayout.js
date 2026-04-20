// Components/Admin/RewardPayout.js
// ─────────────────────────────────────────────────────────────────────────────
// Payout Management panel — sub-section of AdminFinancial.
//
// CHANGES FROM PREVIOUS VERSION:
//
//   NEW TAB — "Unredeemed Wallets" (4th tab, between Pending Claims and Summary).
//     Shows users who have totalGroceryCoupons > 0 but have NOT yet submitted a
//     grocery redemption request (or whose previous request was completed and
//     they now have new balance again).
//
//     This is the "proactive" view for admins — instead of waiting for users to
//     initiate a redemption, the admin can see who is sitting on unredeemed
//     balance and take action (e.g. send a nudge notification).
//
//     Distinct from "Pending Claims" which shows grocery_redeem Payout records
//     already submitted by users and awaiting admin processing.
//
//   TYPE_OPTIONS in the "Pending Claims" filter bar now includes
//   'grocery_redeem' so admins can isolate self-submitted redemption requests.
//
//   All modals, export helpers, and Summary/Payouts/PendingClaims tabs are
//   unchanged.
//
// Tab order:
//   1. Summary          — INR KPIs, charts, recent-paid feed
//   2. All Payouts      — all Payout documents, filterable, inline status edit
//   3. Pending Claims   — RewardClaims with no Payout yet (all types incl. grocery_redeem)
//   4. Unredeemed Wallets — users with wallet balance who haven't redeemed yet
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
  Table, Pagination, DateRangeFilter, AdminUIStyles, SearchBar,
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

// Updated: includes grocery_redeem so admins can filter grocery requests
const TYPE_OPTIONS = [
  { value: '',              label: 'All Types' },
  { value: 'post',          label: 'Post Reward' },
  { value: 'referral',      label: 'Referral Reward' },
  { value: 'streak',        label: 'Streak Reward' },
  { value: 'grocery_redeem',label: 'Grocery Redemption' },
];

const KYC_STATUS_OPTIONS = [
  { value: '',            label: 'All KYC Statuses' },
  { value: 'verified',    label: 'Verified' },
  { value: 'submitted',   label: 'Under Review' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'not_started', label: 'Not Started' },
];

const PLAN_LABELS = {
  '2500': 'Basic ₹2500',
  '3500': 'Silver ₹3500',
  '4500': 'Gold ₹4500',
};

const TYPE_COLORS  = { post: '#4f46e5', referral: '#10b981', streak: '#f59e0b', grocery_redeem: '#059669' };
const PLAN_COLORS  = { '2500': '#10b981', '3500': '#4f46e5', '4500': '#f59e0b' };

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
// IFSC → BANK NAME LOOKUP
// Derives the bank name from the first 4 characters of an IFSC code.
// Covers all major Indian scheduled commercial banks.
// Returns null if the code is unrecognised (upstream can fall back to the raw code).
// ─────────────────────────────────────────────────────────────────────────────

const IFSC_BANK_MAP = {
  // Public sector banks
  SBIN: 'State Bank of India',
  SBHY: 'State Bank of Hyderabad',
  SBMY: 'State Bank of Mysore',
  SBTR: 'State Bank of Travancore',
  SBPA: 'State Bank of Patiala',
  BKID: 'Bank of India',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  PUNB: 'Punjab National Bank',
  UBIN: 'Union Bank of India',
  ANDB: 'Andhra Bank',
  ALLA: 'Allahabad Bank',
  VIJB: 'Vijaya Bank',
  CORP: 'Corporation Bank',
  ORBC: 'Oriental Bank of Commerce',
  UTBI: 'United Bank of India',
  IOBA: 'Indian Overseas Bank',
  IDIB: 'Indian Bank',
  UCBA: 'UCO Bank',
  MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab & Sind Bank',
  SYNC: 'Syndicate Bank',
  DENA: 'Dena Bank',
  // Private sector banks
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  YESB: 'Yes Bank',
  INDB: 'IndusInd Bank',
  IDFB: 'IDFC First Bank',
  FDRL: 'Federal Bank',
  KVBL: 'Karur Vysya Bank',
  DLXB: 'Dhanlaxmi Bank',
  CSBK: 'Catholic Syrian Bank',
  SRCB: 'Saraswat Bank',
  JSFB: 'Jana Small Finance Bank',
  AUBL: 'AU Small Finance Bank',
  USFB: 'Ujjivan Small Finance Bank',
  ESAF: 'ESAF Small Finance Bank',
  ESFB: 'Equitas Small Finance Bank',
  SFBL: 'Suryoday Small Finance Bank',
  NESF: 'North East Small Finance Bank',
  FINF: 'Fincare Small Finance Bank',
  SIBL: 'South Indian Bank',
  LAVB: 'Lakshmi Vilas Bank',
  NKGS: 'NKGSB Co-operative Bank',
  KARB: 'Karnataka Bank',
  KBKB: 'Kalyan Janata Sahakari Bank',
  TMBL: 'Tamilnad Mercantile Bank',
  DCBL: 'DCB Bank',
  RBLB: 'RBL Bank',
  BDBL: 'Bandhan Bank',
  IBKL: 'IDBI Bank',
  CIUB: 'City Union Bank',
  // Payment banks & neo banks
  AIRP: 'Airtel Payments Bank',
  FINO: 'Fino Payments Bank',
  PAYTM: 'Paytm Payments Bank',
  NSDL: 'NSDL Payments Bank',
  IPOS: 'India Post Payments Bank',
  // Foreign banks (common in India)
  CITI: 'Citibank',
  HSBC: 'HSBC Bank',
  DEUT: 'Deutsche Bank',
  SCBL: 'Standard Chartered Bank',
  BOFA: 'Bank of America',
  BNPA: 'BNP Paribas',
  DBSS: 'DBS Bank',
};

/**
 * Returns the bank name from an IFSC code, or null if unrecognised.
 * IFSC format: AAAA0BBBBBB (4-char bank code + 0 + 6-char branch code)
 */
function bankNameFromIFSC(ifsc) {
  if (!ifsc || typeof ifsc !== 'string') return null;
  const code = ifsc.slice(0, 4).toUpperCase();
  return IFSC_BANK_MAP[code] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BANK DETAILS CARD
// Shows full, unmasked account number, IFSC code, bank name (derived from
// IFSC prefix), and PAN number — for admin use only.
// Sources:
//   • payout.bankDetails  — snapshot stored at payout creation time
//   • user.bankDetails    — live from the User document (pending-claims modal)
// ─────────────────────────────────────────────────────────────────────────────

const BankDetailsCard = ({ bankDetails, title = 'Bank Details' }) => {
  if (!bankDetails) return null;

  const { accountNumber, ifscCode, panNumber } = bankDetails;
  const hasAny = accountNumber || ifscCode || panNumber;
  if (!hasAny) return null;

  const bankName = bankNameFromIFSC(ifscCode);

  return (
    <div style={{
      marginTop: '.875rem',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '.5rem',
        padding: '.5rem .875rem',
        background: 'rgba(79,70,229,.07)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '1rem' }}>🏦</span>
        <span style={{
          fontWeight: 700, fontSize: '.8rem',
          letterSpacing: '.04em', color: 'var(--text-primary)',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        {bankName && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '.75rem', fontWeight: 600,
            color: '#4f46e5',
            background: 'rgba(79,70,229,.1)',
            padding: '.15rem .5rem',
            borderRadius: 5,
          }}>
            {bankName}
          </span>
        )}
      </div>

      {/* Fields */}
      <div style={{ padding: '.625rem .875rem', display: 'flex', flexDirection: 'column', gap: '.45rem' }}>

        {accountNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>
              Account No.
            </span>
            <span style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '.875rem', fontWeight: 600,
              letterSpacing: '.08em', color: 'var(--text-primary)',
              userSelect: 'all',
            }}>
              {accountNumber}
            </span>
          </div>
        )}

        {ifscCode && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>
              IFSC Code
            </span>
            <span style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '.875rem', fontWeight: 600,
              letterSpacing: '.08em', color: 'var(--text-primary)',
              userSelect: 'all',
            }}>
              {ifscCode.toUpperCase()}
            </span>
          </div>
        )}

        {bankName && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>
              Bank Name
            </span>
            <span style={{
              fontSize: '.85rem', fontWeight: 500,
              color: 'var(--text-primary)',
            }}>
              {bankName}
            </span>
          </div>
        )}

        {panNumber && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            paddingTop: '.35rem',
            borderTop: '1px dashed var(--border)',
            marginTop: '.1rem',
          }}>
            <span style={{ fontSize: '.775rem', color: 'var(--text-secondary)', minWidth: 110 }}>
              PAN Number
            </span>
            <span style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '.875rem', fontWeight: 600,
              letterSpacing: '.12em', color: 'var(--text-primary)',
              userSelect: 'all',
            }}>
              {panNumber.toUpperCase()}
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

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
// MODAL — Update Payout Status (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const UpdateStatusModal = ({ payout, onClose }) => {
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

          {/* Bank details snapshot — stored on the Payout document at creation time */}
          <BankDetailsCard
            bankDetails={payout.bankDetails ?? payout.user?.bankDetails}
            title="Recipient Bank Details"
          />

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
                  <label>Failure Reason <span style={{ color: '#ef4444' }}>*</span></label>
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
// MODAL — Process single pending claim (unchanged)
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

          {/* Live bank details from user profile — where the payout will be sent */}
          {claim.hasBankDetails && claim.user?.bankDetails && (
            <BankDetailsCard
              bankDetails={claim.user.bankDetails}
              title="Transfer To (User Bank Details)"
            />
          )}

          <div className="rp-breakdown">
            <div className="rp-breakdown__row">
              <span className="rp-breakdown__label">Reward Type</span>
              <span className="rp-breakdown__val" style={{ textTransform: 'capitalize' }}>
                {claim.type === 'grocery_redeem' ? '🛒 Grocery Redemption' : claim.type}
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
// MODAL — Bulk process results (unchanged)
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
// TAB 1 — Summary (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const SummaryTab = () => {
  const { summary, recentPaid, loading } = usePayouts();

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
      <div className="rp-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="rp-kpi-card" style={{ '--kpi-color': k.color }}>
            <div className="rp-kpi-label">{k.label}</div>
            <div className="rp-kpi-value">{k.value}</div>
            <div className="rp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

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
// TAB 2 — All Payouts (unchanged except grocery_redeem now shows in TYPE_OPTIONS)
// ─────────────────────────────────────────────────────────────────────────────

const PayoutsTab = () => {
  const {
    payouts, pagination, page, setPage,
    filters, setFilters, clearFilters,
    loading,
  } = usePayouts();

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
      render: r => {
        const colorMap = {
          post:          'blue',
          referral:      'green',
          streak:        'yellow',
          grocery_redeem:'purple',
        };
        return (
          <Badge color={colorMap[r.rewardType] || 'default'}>
            {r.rewardType === 'grocery_redeem' ? '🛒 Grocery' : r.rewardType}
          </Badge>
        );
      },
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
      key: 'bankDetails', label: 'Bank Details',
      render: r => {
        const bd = r.bankDetails ?? r.user?.bankDetails;
        if (!bd?.accountNumber && !bd?.ifscCode) {
          return <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>—</span>;
        }
        const bankName = bankNameFromIFSC(bd.ifscCode);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem', minWidth: 160 }}>
            {bankName && (
              <span style={{
                fontSize: '.72rem', fontWeight: 700,
                color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                {bankName}
              </span>
            )}
            {bd.accountNumber && (
              <span style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '.8rem', letterSpacing: '.05em',
                color: 'var(--text-primary)', fontWeight: 600,
                userSelect: 'all',
              }}>
                {bd.accountNumber}
              </span>
            )}
            {bd.ifscCode && (
              <span style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '.72rem', color: 'var(--text-secondary)',
                letterSpacing: '.05em',
                userSelect: 'all',
              }}>
                {bd.ifscCode.toUpperCase()}
              </span>
            )}
            {bd.panNumber && (
              <span style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '.7rem', color: 'var(--text-secondary)',
                letterSpacing: '.06em',
                userSelect: 'all',
              }}>
                PAN: {bd.panNumber.toUpperCase()}
              </span>
            )}
          </div>
        );
      },
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

  const exportRows = payouts.map(r => {
    const bd = r.bankDetails ?? r.user?.bankDetails;
    return {
      Name:            r.user?.name || '',
      Email:           r.user?.email || '',
      Phone:           r.user?.phone || '',
      Type:            r.rewardType || '',
      Milestone:       r.milestone || '',
      Plan:            r.planKey || '',
      'Amount (₹)':    r.totalAmountINR ?? 0,
      'Cash (₹)':      r.cashAmountINR ?? r.totalAmountINR ?? 0,
      Status:          r.status || '',
      'Txn Ref':       r.transactionRef || '',
      'Bank Name':     bankNameFromIFSC(bd?.ifscCode) || '',
      'Account No.':   bd?.accountNumber || '',
      'IFSC Code':     bd?.ifscCode || '',
      'PAN Number':    bd?.panNumber || '',
      Created:         formatDate(r.createdAt),
      'Paid At':       formatDate(r.paidAt),
      Notes:           r.notes || '',
    };
  });

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
// Now includes grocery_redeem in the type filter.
// ─────────────────────────────────────────────────────────────────────────────

const PendingClaimsTab = () => {
  const {
    pendingClaims, claimPagination, claimPage, setClaimPage,
    claimFilters, setClaimFilters, clearClaimFilters,
    loading, bulkProcess,
  } = usePayouts();

  const [selected,   setSelected]   = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('processing');
  const [bulkResult, setBulkResult] = useState(null);

  const allIds     = pendingClaims.map(c => String(c._id));
  const allChecked = allIds.length > 0 && checkedIds.length === allIds.length;

  const toggleAll = () => setCheckedIds(allChecked ? [] : allIds);
  const toggleOne = (id) =>
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleBulk = async () => {
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
      render: r => {
        const colorMap = {
          post:          'blue',
          referral:      'green',
          streak:        'yellow',
          grocery_redeem:'purple',
        };
        return (
          <Badge color={colorMap[r.type] || 'default'}>
            {r.type === 'grocery_redeem' ? '🛒 Grocery' : r.type}
          </Badge>
        );
      },
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
        <div className="rp-filter-bar">
          {/* Updated: TYPE_OPTIONS now includes grocery_redeem */}
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
            <Btn size="sm" variant="secondary" onClick={() => setCheckedIds([])}>
              Deselect All
            </Btn>
            <Btn size="sm" onClick={handleBulk} disabled={loading.bulk}>
              {loading.bulk ? 'Processing…' : `Bulk Process (${checkedIds.length})`}
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
// TAB 4 — Unredeemed Wallets  (NEW)
//
// Shows users who have totalGroceryCoupons > 0 but have NOT submitted a
// grocery redemption request yet (or whose last redemption was paid/failed
// and they now have new balance from new slab claims).
//
// These users have EARNED grocery coupons through activity slab rewards
// (post / referral / streak) and the balance is sitting in their wallet
// waiting for them to click "Redeem".
//
// Admin use cases:
//   • Identify who has large unredeemed balances
//   • Check who is eligible to self-redeem (KYC + subscription + bank details)
//   • Filter by eligibility gaps (no bank, KYC not verified) to understand
//     why certain users haven't redeemed
//   • Export the list for outreach/nudge campaigns
// ─────────────────────────────────────────────────────────────────────────────

const UnredeemedWalletsTab = () => {
  const {
    unredeemedWallets,
    walletSummary,
    walletPagination,
    walletPage, setWalletPage,
    walletFilters, setWalletFilters, clearWalletFilters,
    loading,
  } = usePayouts();

  // Export rows for CSV/Excel/PDF
  const exportRows = unredeemedWallets.map(u => ({
    Name:               u.name || '',
    Email:              u.email || '',
    Phone:              u.phone || '',
    'Balance (₹)':      u.totalGroceryCoupons ?? 0,
    Shares:             u.totalShares ?? 0,
    'Referral Tokens':  u.totalReferralToken ?? 0,
    Plan:               u.plan || 'None',
    'KYC Status':       u.kycStatus || 'not_started',
    'Bank Name':        bankNameFromIFSC(u.ifscCode) || '',
    'Account No.':      u.accountNumber || '',
    'IFSC Code':        u.ifscCode || '',
    'PAN Number':       u.panNumber || '',
    Eligible:           u.eligible ? 'Yes' : 'No',
    'Rewards Frozen':   u.rewardsFrozen ? 'Yes' : 'No',
    'Slabs Redeemed':   u.totalSlabsRedeemed ?? 0,
    'Last Active':      formatDate(u.lastActive),
  }));

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: '.875rem',
            flexShrink: 0,
          }}>
            {(r.name?.[0] || 'U').toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>
              {r.name || r.username || '—'}
            </span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
              {r.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'totalGroceryCoupons', label: 'Balance',
      render: r => (
        <span style={{
          fontFamily: '"DM Mono", monospace',
          fontSize: '.9rem', fontWeight: 700,
          color: r.totalGroceryCoupons >= 2500 ? '#10b981' : 'var(--text-primary)',
        }}>
          {fmt(r.totalGroceryCoupons)}
        </span>
      ),
    },
    {
      key: 'plan', label: 'Plan',
      render: r => r.plan
        ? <Badge color="blue">{r.plan}</Badge>
        : <Badge color="default">None</Badge>,
    },
    {
      key: 'kycStatus', label: 'KYC',
      render: r => {
        const colorMap = { verified: 'green', submitted: 'yellow', rejected: 'red' };
        return (
          <Badge color={colorMap[r.kycStatus] || 'default'}>
            {r.kycStatus?.replace('_', ' ') || 'not started'}
          </Badge>
        );
      },
    },
    {
      key: 'hasBankDetails', label: 'Bank Details',
      render: r => {
        if (!r.hasBankDetails) {
          return (
            <span style={{ fontSize: '.8rem', color: '#ef4444', fontWeight: 600 }}>
              ✗ Not set
            </span>
          );
        }
        const bankName = bankNameFromIFSC(r.ifscCode);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem', minWidth: 150 }}>
            {bankName && (
              <span style={{
                fontSize: '.72rem', fontWeight: 700,
                color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                {bankName}
              </span>
            )}
            {r.accountNumber && (
              <span style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '.8rem', fontWeight: 600,
                color: 'var(--text-primary)', letterSpacing: '.05em',
                userSelect: 'all',
              }}>
                {r.accountNumber}
              </span>
            )}
            {r.ifscCode && (
              <span style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '.72rem', color: 'var(--text-secondary)',
                letterSpacing: '.05em',
                userSelect: 'all',
              }}>
                {r.ifscCode.toUpperCase()}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'eligible', label: 'Can Self-Redeem',
      render: r => r.eligible
        ? (
          <Badge color="green" style={{ fontSize: '.7rem' }}>
            ✓ Ready
          </Badge>
        )
        : (
          // Show WHY they can't self-redeem
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Badge color="default" style={{ fontSize: '.7rem' }}>Not ready</Badge>
            {!r.kycVerified && (
              <span style={{ fontSize: '.65rem', color: '#f59e0b' }}>KYC unverified</span>
            )}
            {!r.subActive && (
              <span style={{ fontSize: '.65rem', color: '#ef4444' }}>No subscription</span>
            )}
            {!r.hasBankDetails && (
              <span style={{ fontSize: '.65rem', color: '#ef4444' }}>No bank details</span>
            )}
            {r.rewardsFrozen && (
              <span style={{ fontSize: '.65rem', color: '#dc2626' }}>🔒 Frozen</span>
            )}
          </div>
        ),
    },
    {
      key: 'totalSlabsRedeemed', label: 'Slabs Claimed',
      render: r => (
        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '.85rem' }}>
          {r.totalSlabsRedeemed ?? 0}
        </span>
      ),
    },
    {
      key: 'lastActive', label: 'Last Active',
      render: r => (
        <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
          {formatDate(r.lastActive)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── KPI Strip ── */}
      {walletSummary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '.75rem',
          marginBottom: '.25rem',
        }}>
          {[
            {
              label: 'Users with Balance',
              value: (walletSummary.totalUsersWithBalance ?? 0).toLocaleString(),
              color: '#4f46e5',
              icon: '👥',
            },
            {
              label: 'Total Unredeemed',
              value: fmt(walletSummary.totalUnredeemedINR),
              color: '#059669',
              icon: '🛒',
            },
            {
              label: 'Eligible to Redeem',
              value: (walletSummary.eligibleToRedeem ?? 0).toLocaleString(),
              color: '#10b981',
              icon: '✓',
            },
            {
              label: 'Missing Bank Details',
              value: (walletSummary.missingBankDetails ?? 0).toLocaleString(),
              color: '#ef4444',
              icon: '🏦',
            },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1rem 1.125rem',
              boxShadow: 'var(--shadow-card)',
              borderTop: `3px solid ${k.color}`,
            }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '.375rem' }}>{k.icon}</div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 700,
                fontFamily: '"DM Mono", monospace', letterSpacing: '-.03em',
                color: 'var(--text-primary)', lineHeight: 1,
              }}>
                {k.value}
              </div>
              <div style={{
                fontSize: '.775rem', color: 'var(--text-secondary)',
                fontWeight: 500, marginTop: '.25rem',
              }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Info banner ── */}
      <div style={{
        display: 'flex', gap: '.75rem', padding: '.875rem 1rem',
        background: 'rgba(5,150,105,.06)',
        border: '1px solid rgba(5,150,105,.18)',
        borderRadius: 10, fontSize: '.8125rem',
        color: 'var(--text-primary)', lineHeight: 1.5,
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
        <span>
          These users have earned grocery coupons through slab rewards (posts, referrals, streaks)
          but have <strong>not yet submitted a redemption request</strong>.
          Users with an active request already in progress appear in <strong>Pending Claims</strong> instead.
        </span>
      </div>

      {/* ── Filters ── */}
      <Card>
        <div className="rp-filter-bar">
          <SearchBar
            value={walletFilters.search}
            onChange={v => setWalletFilters({ search: v })}
            placeholder="Search name, email…"
          />
          <Select
            value={walletFilters.kycStatus}
            onChange={v => setWalletFilters({ kycStatus: v })}
            options={KYC_STATUS_OPTIONS}
            placeholder="All KYC Statuses"
          />
          <input
            type="number"
            min="0"
            placeholder="Min ₹ balance"
            value={walletFilters.minBalance}
            onChange={e => setWalletFilters({ minBalance: e.target.value })}
            style={{
              padding: '.375rem .625rem',
              borderRadius: 7,
              border: '1px solid var(--border-color)',
              fontSize: '.85rem',
              background: 'var(--bg-canvas)',
              minWidth: 130,
              color: 'var(--text-primary)',
            }}
          />
          <label style={{
            display: 'flex', alignItems: 'center', gap: '.375rem',
            fontSize: '.875rem', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            <input
              type="checkbox"
              checked={!!walletFilters.bankOnly}
              onChange={e => setWalletFilters({ bankOnly: e.target.checked })}
            />
            Bank details only
          </label>
          <Btn size="sm" variant="secondary" onClick={clearWalletFilters}>Clear</Btn>

          <div style={{ flex: 1 }} />

          {unredeemedWallets.length > 0 && (
            <>
              <Btn size="sm" variant="secondary"
                onClick={() => exportXLSX(exportRows, 'unredeemed_wallets')}>
                ↓ Excel
              </Btn>
              <Btn size="sm" variant="secondary"
                onClick={() => exportCSVLocal(exportRows, 'unredeemed_wallets')}>
                ↓ CSV
              </Btn>
              <Btn size="sm" variant="secondary"
                onClick={() => exportPDFLocal(exportRows, 'Unredeemed Wallets')}>
                ↓ PDF
              </Btn>
            </>
          )}
        </div>

        <Table
          columns={columns}
          rows={unredeemedWallets}
          loading={loading.wallets}
          empty="No users with unredeemed grocery coupon balance found 🎉"
        />
        <Pagination
          page={walletPage}
          pages={walletPagination.pages}
          onPage={setWalletPage}
        />
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const RewardPayout = () => {
  const [tab, setTab] = useState('summary');
  const {
    claimPagination, pendingClaims,
    walletPagination, unredeemedWallets,
    loading, refresh,
  } = usePayouts();

  const pendingCount   = claimPagination.total  ?? pendingClaims.length;
  const walletCount    = walletPagination.total  ?? unredeemedWallets.length;
  const isBusy         = loading.payouts || loading.claims || loading.summary || loading.wallets;

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
          {
            id: 'wallets',
            label: 'Unredeemed Wallets',
            // Show count badge so admins immediately see how many users
            // are sitting on unredeemed balance
            badge: walletCount > 0 ? walletCount : null,
            badgeColor: '#059669',   // green — informational, not urgent
          },
        ].map(t => (
          <button
            key={t.id}
            className={`rp-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge != null && (
              <span
                className="rp-tab-badge"
                style={t.badgeColor ? { background: t.badgeColor } : undefined}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'payouts' && <PayoutsTab />}
      {tab === 'claims'  && <PendingClaimsTab />}
      {tab === 'wallets' && <UnredeemedWalletsTab />}
    </>
  );
};

export default RewardPayout;