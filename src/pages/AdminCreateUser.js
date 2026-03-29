// pages/AdminCreateUser.js  (was Components/Admin/AdminCreateUser.js)
//
// Super-admin-only page — accessible ONLY after login at /admin/create-admin.
// Reached from:
//   • Home.js  → "Create New Admin" button in the super_admin quick-actions bar
//   • AdminLayout sidebar → "Create Admin" nav item
//
// What this page does:
//   ✅ Authenticated: sends super_admin JWT via apiRequest interceptor
//   ✅ Lets super_admin pick an adminRole (Finance, Rewards, Moderator, etc.)
//   ✅ Shows the full permission list for the selected role
//   ✅ Allows optional per-permission overrides via "Advanced Permissions" toggle
//   ✅ Calls POST /api/admin/create-admin (NOT the public /api/auth/createuser)
//   ✅ Skips referral — internal accounts are exempt
//   ✅ Does NOT log the new admin in; they log in separately

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiRequest from '../utils/apiRequest';
import { useAuth } from '../Context/AuthContext';

// ── Role metadata (matches backend ROLE_PRESETS in constants/permissions.js) ──
const ROLE_META = {
  finance_admin:   {
    icon: '💰', color: '#22c55e', label: 'Finance Admin',
    desc: 'Financial reports, payouts & export access',
  },
  rewards_admin:   {
    icon: '🎁', color: '#f59e0b', label: 'Rewards Admin',
    desc: 'Manage reward slabs, claims & undo redemptions',
  },
  moderator:       {
    icon: '📝', color: '#3b82f6', label: 'Moderator',
    desc: 'Approve, reject or delete user-generated content',
  },
  user_manager:    {
    icon: '👥', color: '#8b5cf6', label: 'User Manager',
    desc: 'Ban, suspend users and reset rewards',
  },
  analytics_admin: {
    icon: '📈', color: '#06b6d4', label: 'Analytics Admin',
    desc: 'View & export analytics and reports',
  },
};

const NICE = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── Password strength ─────────────────────────────────────────────────────────
function calcStrength(pw) {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z\d]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH_LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];

// ── Eye icons ─────────────────────────────────────────────────────────────────
const EyeOpen = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);
const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 3C5 3 1.73 7.11 1 10a11.8 11.8 0 003.2 4.4l-2.5 2.5 1.4 1.4 14-14-1.4-1.4-2.3 2.3A9.98 9.98 0 0010 3zm0 12c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.15l1.43 1.43A2.97 2.97 0 0010 13c.24 0 .48-.02.72-.05l1.43 1.43A4.98 4.98 0 0110 15z"/>
  </svg>
);

// ── Role Tile ─────────────────────────────────────────────────────────────────
const RoleTile = ({ role, selected, onClick }) => {
  const meta = ROLE_META[role.roleName] || { icon: '🛡️', color: '#64748b', label: NICE(role.roleName), desc: '' };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? `${meta.color}12` : 'var(--bg-canvas, #f8fafc)',
        border: `2px solid ${selected ? meta.color : 'var(--border, #e2e8f0)'}`,
        borderRadius: 14,
        padding: '18px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.18s ease',
        position: 'relative',
        boxShadow: selected ? `0 0 0 4px ${meta.color}20` : 'none',
        width: '100%',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 22, height: 22, borderRadius: '50%',
          background: meta.color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#fff', fontWeight: 800,
        }}>✓</div>
      )}
      <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{meta.icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #1e293b)', marginBottom: 4 }}>
        {meta.label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', lineHeight: 1.5, marginBottom: 10 }}>
        {role.description || meta.desc}
      </div>
      {/* Permission chips preview */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(role.permissions || []).slice(0, 3).map(p => (
          <span key={p} style={{
            fontSize: 10, fontWeight: 600,
            padding: '2px 7px', borderRadius: 5,
            background: `${meta.color}15`,
            color: meta.color,
            border: `1px solid ${meta.color}30`,
          }}>
            {p.replace(/_/g, ' ')}
          </span>
        ))}
        {(role.permissions || []).length > 3 && (
          <span style={{ fontSize: 10, color: 'var(--text-secondary, #64748b)', padding: '2px 0' }}>
            +{role.permissions.length - 3} more
          </span>
        )}
      </div>
    </button>
  );
};

// ── Permission checkbox list ───────────────────────────────────────────────────
const PermissionOverrides = ({ allPermissions, selected, onChange }) => (
  <div style={{ marginTop: 16 }}>
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
    }}>
      Override Permissions
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {allPermissions.map(perm => (
        <label key={perm} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
          background: selected.includes(perm) ? 'rgba(79,70,229,0.06)' : 'transparent',
          border: `1px solid ${selected.includes(perm) ? 'rgba(79,70,229,0.2)' : 'var(--border, #e2e8f0)'}`,
          transition: 'all 0.15s',
        }}>
          <input
            type="checkbox"
            checked={selected.includes(perm)}
            onChange={() => {
              onChange(
                selected.includes(perm)
                  ? selected.filter(p => p !== perm)
                  : [...selected, perm]
              );
            }}
            style={{ accentColor: '#4f46e5', width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-primary, #1e293b)', fontWeight: 500 }}>
            {perm.replace(/_/g, ' ')}
          </span>
        </label>
      ))}
    </div>
  </div>
);

// ── Input field ───────────────────────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      {label}
    </label>
    {children}
    {hint && <span style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', opacity: 0.75 }}>{hint}</span>}
  </div>
);

const TextInput = ({ type = 'text', value, onChange, placeholder, autoComplete, right }) => (
  <div style={{ position: 'relative' }}>
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} autoComplete={autoComplete}
      style={{
        width: '100%',
        padding: right ? '11px 44px 11px 14px' : '11px 14px',
        background: 'var(--bg-canvas, #f8fafc)',
        border: '1.5px solid var(--border, #e2e8f0)',
        borderRadius: 10, fontSize: 13,
        color: 'var(--text-primary, #1e293b)',
        fontFamily: 'inherit', outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
      }}
      onFocus={e => e.target.style.borderColor = '#4f46e5'}
      onBlur={e  => e.target.style.borderColor = 'var(--border, #e2e8f0)'}
    />
    {right && (
      <button type="button" onClick={right.onClick} style={{
        position: 'absolute', right: 10, top: '50%',
        transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-secondary, #64748b)', padding: 4,
        display: 'flex', alignItems: 'center',
      }}>
        {right.icon}
      </button>
    )}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const AdminCreateUser = () => {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const isSuperAdmin = user?.isSuperAdmin || user?.role === 'super_admin';

  const [roles,        setRoles]        = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [saving,       setSaving]       = useState(false);

  const [form, setForm] = useState({
    name: '', username: '', email: '', phone: '',
    password: '', confirmPassword: '',
  });
  const [selectedRoleId,      setSelectedRoleId]      = useState('');
  const [showAdvancedPerms,   setShowAdvancedPerms]   = useState(false);
  const [customPermissions,   setCustomPermissions]   = useState([]);
  const [showPw,              setShowPw]              = useState(false);
  const [showCPw,             setShowCPw]             = useState(false);
  const [pwStrength,          setPwStrength]          = useState(0);
  const [created,             setCreated]             = useState(null);

  // Redirect non-super-admins away immediately
  useEffect(() => {
    if (!isSuperAdmin) {
      toast.error('Access denied — Super Admin only');
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await apiRequest.get('/api/admin/roles');
      setRoles(res.data.roles || []);
    } catch {
      toast.error('Failed to load roles. Make sure you ran the RBAC migration script.');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  // When role changes, seed customPermissions to match role's permissions
  const selectedRole = roles.find(r => r._id === selectedRoleId) || null;
  useEffect(() => {
    setCustomPermissions(selectedRole?.permissions ?? []);
  }, [selectedRoleId, selectedRole?.permissions]);

  // Collect ALL unique permissions across all roles for the override grid
  const allPermissions = [...new Set(roles.flatMap(r => r.permissions || []))].sort();

  const handleChange = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    if (field === 'password') setPwStrength(calcStrength(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, username, email, phone, password, confirmPassword } = form;

    if (!name || !username || !email || !phone || !password || !confirmPassword)
      return toast.error('Please fill in all fields');
    if (password !== confirmPassword)
      return toast.error('Passwords do not match');
    if (password.length < 5)
      return toast.error('Password must be at least 5 characters');
    if (!selectedRoleId)
      return toast.error('Please select a role for this admin');

    setSaving(true);
    try {
      const payload = {
        name, username, email, phone, password,
        roleId: selectedRoleId,
        // Only send custom permissions if the user actually toggled overrides
        ...(showAdvancedPerms ? { permissions: customPermissions } : {}),
      };

      const res = await apiRequest.post('/api/admin/create-admin', payload);

      toast.success(`Admin account created for ${email}`);
      setCreated(res.data.user || { email, adminRole: selectedRole });

      // Reset form
      setForm({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
      setSelectedRoleId('');
      setShowAdvancedPerms(false);
      setCustomPermissions([]);
      setPwStrength(0);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create admin account');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div style={{ padding: '0 0 2rem' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => navigate('/admin/admins')}
            style={{
              background: 'none', border: '1.5px solid var(--border, #e2e8f0)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-secondary, #64748b)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            ← Back
          </button>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: '#f59e0b', background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 20, padding: '3px 10px',
          }}>
            ⭐ Super Admin Only
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #1e293b)', margin: 0 }}>
          Create Admin Account
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
          New admin accounts get scoped access based on their assigned role.
          They will log in at the standard login page using these credentials.
        </p>
      </div>

      {/* ── Success banner ── */}
      {created && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.25)',
          borderRadius: 14, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary, #1e293b)', marginBottom: 4, fontSize: 14 }}>
              ✅ Admin account created for <strong>{created.email}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>Role: <strong>{NICE(created.adminRole?.roleName || selectedRole?.roleName)}</strong></span>
              {created.username && <span>Username: <code style={{ fontSize: 11 }}>{created.username}</code></span>}
              <span style={{ color: '#f59e0b' }}>⚠️ Share credentials securely — shown once</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setCreated(null)} style={ghostBtnStyle}>
              Create Another
            </button>
            <button type="button" onClick={() => navigate('/admin/admins')} style={primaryBtnStyle}>
              View All Admins
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left: Form ── */}
        <div style={cardStyle}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Name + Username */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Full Name">
                <TextInput value={form.name} onChange={handleChange('name')}
                  placeholder="e.g. Priya Sharma" autoComplete="name"/>
              </Field>
              <Field label="Username">
                <TextInput value={form.username} onChange={handleChange('username')}
                  placeholder="e.g. priyasharma" autoComplete="off"/>
              </Field>
            </div>

            {/* Email */}
            <Field label="Email Address">
              <TextInput type="email" value={form.email} onChange={handleChange('email')}
                placeholder="admin@yourcompany.com" autoComplete="off"/>
            </Field>

            {/* Phone */}
            <Field label="Phone Number" hint="10-digit mobile number — used for account recovery">
              <TextInput type="tel" value={form.phone} onChange={handleChange('phone')}
                placeholder="9876543210" autoComplete="off"/>
            </Field>

            {/* Password */}
            <Field label="Password" hint="Min 5 characters. The admin will use this to log in.">
              <TextInput
                type={showPw ? 'text' : 'password'}
                value={form.password} onChange={handleChange('password')}
                placeholder="Create a strong password" autoComplete="new-password"
                right={{ onClick: () => setShowPw(v => !v), icon: showPw ? <EyeOpen/> : <EyeOff/> }}
              />
              {form.password && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{
                      height: '100%', width: `${(pwStrength / 4) * 100}%`,
                      background: STRENGTH_COLORS[pwStrength], borderRadius: 2, transition: 'all 0.3s',
                    }}/>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: STRENGTH_COLORS[pwStrength] }}>
                    {STRENGTH_LABELS[pwStrength]}
                  </span>
                </div>
              )}
            </Field>

            {/* Confirm password */}
            <Field label="Confirm Password">
              <TextInput
                type={showCPw ? 'text' : 'password'}
                value={form.confirmPassword} onChange={handleChange('confirmPassword')}
                placeholder="Re-enter password" autoComplete="new-password"
                right={{ onClick: () => setShowCPw(v => !v), icon: showCPw ? <EyeOpen/> : <EyeOff/> }}
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Passwords do not match</span>
              )}
            </Field>

            {/* Advanced permissions toggle */}
            {selectedRoleId && allPermissions.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPerms(v => !v)}
                  style={{
                    background: 'none', border: '1.5px dashed var(--border, #e2e8f0)',
                    borderRadius: 8, padding: '8px 14px',
                    cursor: 'pointer', fontSize: 12,
                    color: 'var(--text-secondary, #64748b)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    width: '100%',
                  }}
                >
                  {showAdvancedPerms ? '▾' : '▸'}
                  {showAdvancedPerms ? 'Hide' : 'Advanced:'} Customize permissions for this account
                </button>
                {showAdvancedPerms && (
                  <PermissionOverrides
                    allPermissions={allPermissions}
                    selected={customPermissions}
                    onChange={setCustomPermissions}
                  />
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6, borderTop: '1.5px solid var(--border, #e2e8f0)' }}>
              <button type="button" onClick={() => navigate('/admin/admins')} style={ghostBtnStyle}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !selectedRoleId || !form.name || !form.email || !form.password || form.password !== form.confirmPassword}
                style={{
                  ...primaryBtnStyle,
                  opacity: (saving || !selectedRoleId || !form.name || !form.email || !form.password || form.password !== form.confirmPassword) ? 0.55 : 1,
                  cursor:  (saving || !selectedRoleId || !form.name || !form.email || !form.password || form.password !== form.confirmPassword) ? 'not-allowed' : 'pointer',
                }}
              >
                {saving
                  ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', marginRight: 6 }}/> Creating…</>
                  : '✅ Create Admin Account'
                }
              </button>
            </div>

          </form>
        </div>

        {/* ── Right: Role selector ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-secondary, #64748b)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              marginBottom: 14,
            }}>
              Select Role *
            </div>

            {rolesLoading ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>
                Loading roles…
              </div>
            ) : roles.length === 0 ? (
              <div style={{
                padding: '1rem', background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>No roles found</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                  Run <code style={{ fontSize: 11, padding: '1px 5px', background: '#f1f5f9', borderRadius: 4 }}>
                    node scripts/migrateRBAC.js
                  </code> to seed the default roles.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {roles.map(role => (
                  <RoleTile
                    key={role._id}
                    role={role}
                    selected={selectedRoleId === role._id}
                    onClick={() => setSelectedRoleId(role._id === selectedRoleId ? '' : role._id)}
                  />
                ))}
              </div>
            )}

            {/* Role summary */}
            {selectedRole && (
              <div style={{
                marginTop: 14, padding: '12px 14px',
                background: 'rgba(79,70,229,0.06)',
                border: '1px solid rgba(79,70,229,0.15)',
                borderRadius: 10, fontSize: 12,
                color: 'var(--text-secondary, #64748b)',
              }}>
                <strong style={{ color: 'var(--text-primary, #1e293b)' }}>
                  {(ROLE_META[selectedRole.roleName] || {}).icon}{' '}
                  {NICE(selectedRole.roleName)}
                </strong>
                {' '}selected —{' '}
                {showAdvancedPerms
                  ? `${customPermissions.length} custom permissions`
                  : `${selectedRole.permissions?.length || 0} permissions`
                } will be granted.
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          /* stack columns on mobile */
        }
      `}</style>
    </div>
  );
};

// ── Shared button styles ──────────────────────────────────────────────────────
const cardStyle = {
  background: 'var(--bg-card, #ffffff)',
  border: '1.5px solid var(--border, #e2e8f0)',
  borderRadius: 16,
  padding: '1.5rem',
};

const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  color: '#fff', border: 'none',
  borderRadius: 9, padding: '10px 20px',
  fontSize: 13, fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', gap: 6,
  transition: 'opacity 0.2s',
};

const ghostBtnStyle = {
  background: 'none',
  color: 'var(--text-secondary, #64748b)',
  border: '1.5px solid var(--border, #e2e8f0)',
  borderRadius: 9, padding: '10px 18px',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
};

export default AdminCreateUser;