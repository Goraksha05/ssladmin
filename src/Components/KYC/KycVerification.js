/**
 * Components/KYC/KycVerification.jsx
 *
 * BUG FIX: Was using `const { token } = useAuth()` but AuthContext exposes
 * `authtoken`, not `token`. This caused all KYC submit requests to send
 * Authorization: Bearer undefined → 401 on every attempt.
 * Fixed: destructure `authtoken` from useAuth().
 *
 * REDESIGN: Refined editorial dark-card aesthetic, DM Serif Display headlines,
 * monochrome ink palette with indigo accent.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ShieldCheck, ShieldAlert, ShieldX, Upload,
  Clock, FileText, CreditCard, Landmark, Camera, X,
  RefreshCw, ArrowLeft, BadgeCheck, AlertCircle, Loader2, Eye,
} from 'lucide-react';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../../Context/AuthContext';
import { useKyc } from '../../Context/KycContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';
const MAX_MB   = 10;
const ACCEPT_DOC = 'image/jpeg,image/png,image/webp,application/pdf';
const ACCEPT_IMG = 'image/jpeg,image/png,image/webp';

const DOC_FIELDS = [
  { name: 'aadhaar', label: 'Aadhaar Card',   sub: 'Front side — all text and photo must be visible',          Icon: FileText,  accept: ACCEPT_DOC, hint: 'JPG · PNG · PDF · max 10 MB' },
  { name: 'pan',     label: 'PAN Card',        sub: 'Clear scan or photograph',                                 Icon: CreditCard,accept: ACCEPT_DOC, hint: 'JPG · PNG · PDF · max 10 MB' },
  { name: 'bank',    label: 'Bank Passbook',   sub: 'First page — name, account no. and IFSC visible',          Icon: Landmark,  accept: ACCEPT_DOC, hint: 'JPG · PNG · PDF · max 10 MB' },
  { name: 'selfie',  label: 'Live Selfie',     sub: 'Clear face photo — no sunglasses, masks or filters',       Icon: Camera,    accept: ACCEPT_IMG, hint: 'JPG · PNG · WEBP · max 10 MB' },
];

const T = {
  ff_head: "'DM Serif Display', Georgia, serif",
  ff_body: "'DM Sans', 'Plus Jakarta Sans', sans-serif",
  ink:     '#0d1117',
  slate:   '#1e2a3a',
  muted:   '#64748b',
  border:  '#e2e8f0',
  accent:  '#1d4ed8',
  accentL: '#dbeafe',
  ok:      '#059669',
  okL:     '#d1fae5',
  warn:    '#d97706',
  warnL:   '#fef3c7',
  danger:  '#dc2626',
  dangerL: '#fee2e2',
  surface: '#ffffff',
  bg:      '#f8fafc',
};

// ── DocSlot ─────────────────────────────────────────────────────────────────
const DocSlot = ({ field, file, preview, onFile, onRemove, error, index }) => {
  const inputRef = useRef();
  const { Icon } = field;
  const isImage  = file && file.type !== 'application/pdf';
  const isPdf    = file && file.type === 'application/pdf';

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(field.name, f);
  }, [field.name, onFile]);

  return (
    <div style={{ animationDelay: `${index * 80}ms`, animation: 'fadeSlideUp 0.45s ease both' }}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        style={{
          border:       file ? `2px solid ${T.accent}` : `2px dashed ${error ? T.danger : '#cbd5e1'}`,
          borderRadius: 16,
          background:   file ? '#f0f7ff' : T.surface,
          cursor:       file ? 'default' : 'pointer',
          transition:   'border-color 0.2s, background 0.2s',
          overflow:     'hidden',
          position:     'relative',
        }}
      >
        {isImage && preview && (
          <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
            <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5))' }} />
          </div>
        )}
        {isPdf && (
          <div style={{ height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', gap: 6 }}>
            <FileText size={32} color={T.accent} />
            <span style={{ fontSize: 11, color: T.muted, fontFamily: T.ff_body, fontWeight: 600 }}>PDF Document</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: file ? '14px 16px' : '20px 20px' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: file ? T.accentL : T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={21} color={file ? T.accent : '#94a3b8'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, fontFamily: T.ff_body, color: T.ink }}>{field.label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted, fontFamily: T.ff_body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file ? file.name : field.sub}
            </p>
            {!file && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8', fontFamily: T.ff_body }}>{field.hint}</p>}
          </div>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {isImage && preview && (
                <a href={preview} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: T.bg, border: `1px solid ${T.border}`, color: T.muted, textDecoration: 'none' }}>
                  <Eye size={14} />
                </a>
              )}
              <button onClick={(e) => { e.stopPropagation(); onRemove(field.name); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: T.dangerL, border: `1px solid #fca5a5`, color: T.danger, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: T.bg, border: `1px solid ${T.border}` }}>
              <Upload size={15} color="#94a3b8" />
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept={field.accept} style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) onFile(field.name, e.target.files[0]); }} />
      </div>
      {error && (
        <p style={{ margin: '5px 0 0 4px', fontSize: 12, color: T.danger, fontFamily: T.ff_body, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
};

const ScoreRing = ({ score }) => {
  if (score == null || score <= 0) return null;
  const pct   = Math.round(score * 100);
  const color = pct >= 85 ? T.ok : pct >= 55 ? T.accent : T.danger;
  const label = pct >= 85 ? 'Auto-approved' : pct >= 55 ? 'Manual review queued' : 'Below threshold';
  const r = 22, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '12px 18px' }}>
      <svg width={54} height={54} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={27} cy={27} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <circle cx={27} cy={27} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x={27} y={27} dominantBaseline="central" textAnchor="middle" fontSize={13} fontWeight={800} fill={color}
          style={{ transform: 'rotate(90deg)', transformOrigin: '27px 27px', fontFamily: T.ff_body }}>{pct}</text>
      </svg>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: T.ff_body }}>KYC Score</p>
        <p style={{ margin: 0, fontSize: 12, color: T.muted, fontFamily: T.ff_body }}>{label}</p>
      </div>
    </div>
  );
};

const VerifiedScreen = ({ kycData }) => (
  <div style={{ textAlign: 'center', padding: '48px 32px', animation: 'fadeSlideUp 0.5s ease both' }}>
    <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 0 12px rgba(16,185,129,0.08)' }}>
      <BadgeCheck size={42} color={T.ok} />
    </div>
    <h2 style={{ margin: '0 0 8px', fontSize: 26, fontFamily: T.ff_head, color: T.ink, fontWeight: 400 }}>Identity Verified</h2>
    <p style={{ margin: '0 0 20px', color: T.muted, fontSize: 14, fontFamily: T.ff_body }}>
      Your identity has been confirmed. You now have full access to all platform features, including rewards, referrals, and the verified badge.
    </p>
    {kycData?.verifiedAt && (
      <span style={{ display: 'inline-block', fontSize: 12, color: T.ok, background: T.okL, padding: '5px 14px', borderRadius: 20, fontFamily: T.ff_body, fontWeight: 600 }}>
        Verified on {new Date(kycData.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
    )}
    <div style={{ marginTop: 24 }}><ScoreRing score={kycData?.score} /></div>
  </div>
);

const PendingScreen = ({ onRefresh, loading }) => (
  <div style={{ textAlign: 'center', padding: '48px 32px', animation: 'fadeSlideUp 0.5s ease both' }}>
    <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
      <Clock size={42} color={T.accent} />
    </div>
    <h2 style={{ margin: '0 0 8px', fontSize: 26, fontFamily: T.ff_head, color: T.ink, fontWeight: 400 }}>Under Review</h2>
    <p style={{ margin: '0 auto 24px', color: T.muted, fontSize: 14, fontFamily: T.ff_body, maxWidth: 380 }}>
      Your documents have been submitted and are being reviewed by our team. This typically takes 1–3 business days.
    </p>
    <button onClick={onRefresh} disabled={loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 22, background: 'transparent', border: `1.5px solid ${T.border}`, color: T.accent, fontSize: 13, fontWeight: 700, fontFamily: T.ff_body, cursor: 'pointer' }}>
      <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
      Refresh Status
    </button>
  </div>
);

const STATUS_PILL = {
  not_started: { label: 'Not Started',   bg: 'rgba(100,116,139,0.2)', color: '#94a3b8', dot: '#64748b' },
  required:    { label: 'Action Needed', bg: 'rgba(217,119,6,0.2)',  color: '#fbbf24', dot: '#f59e0b' },
  submitted:   { label: 'Under Review',  bg: 'rgba(59,130,246,0.2)', color: '#93c5fd', dot: '#3b82f6' },
  verified:    { label: 'Verified ✓',   bg: 'rgba(5,150,105,0.2)',  color: '#6ee7b7', dot: '#059669' },
  rejected:    { label: 'Rejected',      bg: 'rgba(220,38,38,0.2)',  color: '#fca5a5', dot: '#dc2626' },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_PILL[status] || STATUS_PILL.not_started;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: cfg.bg, color: cfg.color, padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: T.ff_body, letterSpacing: '0.03em' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0, boxShadow: `0 0 6px ${cfg.dot}` }} />
      {cfg.label}
    </span>
  );
};

// ── Main KycVerification ──────────────────────────────────────────────────────
const KycVerification = () => {
  // BUG FIX: AuthContext exposes `authtoken`, NOT `token`.
  // Using `token` here always returned undefined → every submit was a 401.
  const { authtoken }                                   = useAuth();
  const { kycData, status, loading: ctxLoading, refetch } = useKyc();
  const navigate                                        = useNavigate();

  const [files,      setFiles]      = useState({ aadhaar: null, pan: null, bank: null, selfie: null });
  const [previews,   setPreviews]   = useState({ aadhaar: '',   pan: '',   bank: '',   selfie: '' });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'verified' || status === 'submitted') {
      setFiles({ aadhaar: null, pan: null, bank: null, selfie: null });
      setPreviews({ aadhaar: '', pan: '', bank: '', selfie: '' });
    }
  }, [status]);

  const handleFile = useCallback((name, f) => {
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${name} must be under ${MAX_MB} MB.`); return; }
    setFiles(p => ({ ...p, [name]: f }));
    setPreviews(p => ({ ...p, [name]: f.type !== 'application/pdf' ? URL.createObjectURL(f) : '' }));
    setErrors(p => ({ ...p, [name]: null }));
  }, []);

  const removeFile = useCallback((name) => {
    setFiles(p => ({ ...p, [name]: null }));
    setPreviews(p => ({ ...p, [name]: '' }));
  }, []);

  const validate = () => {
    const errs = {};
    DOC_FIELDS.forEach(({ name }) => { if (!files[name]) errs[name] = 'This document is required.'; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) { toast.error('Please upload all four documents.'); return; }
    setSubmitting(true);
    const toastId = toast.loading('Submitting KYC documents…');
    try {
      const fd = new FormData();
      fd.append('aadhaar', files.aadhaar);
      fd.append('pan',     files.pan);
      fd.append('bank',    files.bank);
      fd.append('selfie',  files.selfie);

      // BUG FIX: use authtoken (correct key from AuthContext), not token (undefined)
      const res = await apiRequest.post(`${BACKEND}/api/kyc/submit`, fd, {
        headers: { Authorization: `Bearer ${authtoken}` },
        timeout: 120_000,
      });

      const { decision } = res.data || {};
      toast.update(toastId, {
        render: decision === 'auto_approve'
          ? '✅ Identity verified automatically!'
          : "✅ Documents submitted — we'll review them within 1–3 business days.",
        type: 'success', isLoading: false, autoClose: 7000,
      });
      await refetch();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Submission failed. Please try again.';
      toast.update(toastId, { render: `❌ ${msg}`, type: 'error', isLoading: false, autoClose: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit  = ['not_started', 'required', 'rejected'].includes(status);
  const allSelected = DOC_FIELDS.every(f => !!files[f.name]);

  return (
    <div style={{ fontFamily: T.ff_body, maxWidth: 680, margin: '0 auto', padding: '0 0 60px' }}>

      <button onClick={() => navigate('/profile')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.muted, fontSize: 13, fontWeight: 600, fontFamily: T.ff_body, cursor: 'pointer', padding: '0 0 20px', letterSpacing: '0.01em' }}>
        <ArrowLeft size={15} /> Back to profile
      </button>

      {/* Hero */}
      <div style={{ borderRadius: 20, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '32px 32px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden', animation: 'fadeSlideUp 0.4s ease both' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,0.2)', border: '1.5px solid rgba(59,130,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={27} color="#60a5fa" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.ff_head, color: '#f1f5f9', fontWeight: 400, letterSpacing: '-0.02em' }}>Identity Verification</h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(148,163,184,0.9)', fontFamily: T.ff_body }}>
              Complete KYC to unlock rewards, referrals and your verified badge
            </p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {status === 'verified' && (
        <div style={{ background: T.surface, borderRadius: 20, border: `1.5px solid ${T.border}` }}>
          <VerifiedScreen kycData={kycData} />
        </div>
      )}

      {status === 'submitted' && (
        <div style={{ background: T.surface, borderRadius: 20, border: `1.5px solid ${T.border}` }}>
          <PendingScreen onRefresh={refetch} loading={ctxLoading} />
        </div>
      )}

      {status === 'rejected' && kycData?.rejectionReason && (
        <div style={{ background: T.dangerL, border: `1.5px solid #fca5a5`, borderRadius: 16, padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
          <ShieldX size={20} color={T.danger} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#991b1b', fontSize: 14, fontFamily: T.ff_body }}>KYC Rejected</p>
            <p style={{ margin: '4px 0 0', color: '#b91c1c', fontSize: 13, fontFamily: T.ff_body }}>{kycData.rejectionReason}</p>
            <p style={{ margin: '6px 0 0', color: T.danger, fontSize: 12, fontFamily: T.ff_body }}>Please re-upload correct documents below.</p>
          </div>
        </div>
      )}

      {status === 'required' && (
        <div style={{ background: T.warnL, border: `1.5px solid #fcd34d`, borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
          <ShieldAlert size={20} color={T.warn} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, color: '#78350f', fontSize: 14, fontWeight: 600, fontFamily: T.ff_body }}>KYC is required to claim rewards. Please complete verification below.</p>
        </div>
      )}

      {canSubmit && (
        <form onSubmit={handleSubmit}>
          <div style={{ background: T.surface, borderRadius: 20, border: `1.5px solid ${T.border}`, padding: '26px 26px 22px', marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontFamily: T.ff_head, color: T.ink, fontWeight: 400 }}>Upload Documents</h2>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: T.muted, fontFamily: T.ff_body }}>
              Accepted: JPG, PNG, PDF · Max {MAX_MB} MB each. All documents must be clearly legible.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {DOC_FIELDS.map((field, i) => (
                <DocSlot key={field.name} field={field} file={files[field.name]} preview={previews[field.name]}
                  onFile={handleFile} onRemove={removeFile} error={errors[field.name]} index={i} />
              ))}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 22, animation: 'fadeSlideUp 0.45s ease 0.35s both' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#475569', fontFamily: T.ff_body }}>📋 Tips for faster approval</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: T.muted, fontSize: 13, lineHeight: 1.9, fontFamily: T.ff_body }}>
              <li>All text and numbers must be clearly readable — avoid glare and blur.</li>
              <li>Your selfie must show your face clearly with even lighting.</li>
              <li>The name on PAN / Aadhaar must match your registered account name.</li>
              <li>Do not upload expired or damaged documents.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 22, animation: 'fadeSlideUp 0.45s ease 0.42s both' }}>
            <ShieldCheck size={14} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 12, color: '#1e40af', fontFamily: T.ff_body, lineHeight: 1.5 }}>
              Your documents are encrypted in transit and at rest, and are used only for identity verification. We never share them with third parties.
            </p>
          </div>

          <button type="submit" disabled={submitting || !allSelected}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: submitting || !allSelected ? '#e2e8f0' : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
              color: submitting || !allSelected ? '#94a3b8' : '#fff',
              fontSize: 15, fontWeight: 700, fontFamily: T.ff_body,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              transition: 'all 0.2s', letterSpacing: '0.01em',
              boxShadow: submitting || !allSelected ? 'none' : '0 4px 18px rgba(29,78,216,0.35)',
              animation: 'fadeSlideUp 0.45s ease 0.5s both',
            }}>
            {submitting ? (
              <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />Submitting — please wait…</>
            ) : (
              <><ShieldCheck size={18} />{status === 'rejected' ? 'Resubmit Documents' : 'Submit KYC Documents'}</>
            )}
          </button>
        </form>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default KycVerification;