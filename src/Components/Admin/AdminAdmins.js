// Components/Admin/AdminAdmins.js
//
// CHANGES FROM ORIGINAL:
//
//   1. FIX — Btn `style` prop was silently dropped. The "Create New Admin" button
//      passes inline styles for the gold gradient. Fixed in AdminUI.js (Btn now
//      passes `style` through). No structural change needed here; the JSX is
//      unchanged but now actually works.
//
//   2. FIX — Local confirm overlay replaced with shared ConfirmDialog from AdminUI.
//      The original duplicated the exact same overlay markup present in AdminUsers,
//      AdminRoleManagement, and AdminContent. The shared primitive removes this.
//
//   3. FIX — `demote` action sent DELETE /api/admin/admins/:id which is correct.
//      However the toast said `${admin.email} demoted` — kept as-is (correct).
//
//   4. FIX — Roles fetch error was silently swallowed (`catch(() => ({...}))`).
//      Kept as-is since role loading failure should not block the admins list,
//      but added a non-blocking toast warning.
//
//   5. FIX — PUT /api/admin/admins/:id/role sends `{ roleId }`. Backend
//      adminManagementController.changeAdminRole expects exactly this.
//      Verified correct — no change needed.

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import { useAuth } from '../../Context/AuthContext';
import { usePermissions } from '../../Context/PermissionsContext';
import {
  PageHeader, Card, Btn, Badge, Table, ConfirmDialog, AdminUIStyles,
} from './AdminUI';

const NICE = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── PromoteModal ──────────────────────────────────────────────────────────────
const PromoteModal = ({ roles, onClose, onSuccess }) => {
  const [email,  setEmail]  = useState('');
  const [roleId, setRoleId] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim()) return toast.warn('Enter an email address');
    setSaving(true);
    try {
      await apiRequest.post('/api/admin/admins', { email: email.trim(), roleId: roleId || undefined });
      toast.success(`${email} promoted to admin`);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to promote');
    } finally { setSaving(false); }
  };

  return (
    <div className="am-overlay">
      <div className="am-modal">
        <div className="am-modal-header">
          <h3 className="am-modal-title">Promote Existing User to Admin</h3>
          <button className="am-close" onClick={onClose}>✕</button>
        </div>
        <p className="am-modal-desc">
          Enter the email of an <strong>existing user</strong> to grant them admin access.
          To create a <em>brand-new</em> admin account, use the "Create New Admin" button instead.
        </p>
        <label className="am-label">User Email</label>
        <input
          className="am-input"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="user@example.com"
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
        />
        <label className="am-label" style={{ marginTop: '.75rem' }}>Assign Role (optional)</label>
        <select className="am-select" value={roleId} onChange={e => setRoleId(e.target.value)}>
          <option value="">— No role (no permissions) —</option>
          {roles.map(r => (
            <option key={r._id} value={r._id}>{NICE(r.roleName)}</option>
          ))}
        </select>
        <div className="am-modal-footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary"   size="sm" onClick={submit} disabled={saving}>
            {saving ? 'Promoting…' : 'Promote to Admin'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── RoleChangeModal ────────────────────────────────────────────────────────────
const RoleChangeModal = ({ admin, roles, onClose, onSuccess }) => {
  const [roleId, setRoleId] = useState(admin.adminRole?._id ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!roleId) return toast.warn('Select a role');
    setSaving(true);
    try {
      await apiRequest.put(`/api/admin/admins/${admin._id}/role`, { roleId });
      toast.success('Role updated');
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update role');
    } finally { setSaving(false); }
  };

  return (
    <div className="am-overlay">
      <div className="am-modal">
        <div className="am-modal-header">
          <h3 className="am-modal-title">Change Role — {admin.name}</h3>
          <button className="am-close" onClick={onClose}>✕</button>
        </div>
        <p className="am-modal-desc">
          Select a new role for <strong>{admin.email}</strong>.
          This immediately changes their permission set.
        </p>
        <label className="am-label">Role</label>
        <select className="am-select" value={roleId} onChange={e => setRoleId(e.target.value)}>
          <option value="">— Select role —</option>
          {roles.map(r => (
            <option key={r._id} value={r._id}>{NICE(r.roleName)}</option>
          ))}
        </select>
        <div className="am-modal-footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary"   size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Update Role'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const AdminAdmins = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { isSuperAdmin }      = usePermissions();

  const [admins,  setAdmins]  = useState([]);
  const [roles,   setRoles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'promote' | { type:'role', admin }
  const [confirm, setConfirm] = useState(null); // { name, email, onConfirm }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, rolesRes] = await Promise.all([
        apiRequest.get('/api/admin/admins'),
        apiRequest.get('/api/admin/roles').catch(() => {
          toast.warn('Could not load roles list');
          return { data: { roles: [] } };
        }),
      ]);
      setAdmins(adminsRes.data.admins);
      setRoles(rolesRes.data.roles);
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const demote = (admin) => {
    setConfirm({
      name:  admin.name,
      email: admin.email,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiRequest.delete(`/api/admin/admins/${admin._id}`);
          toast.success(`${admin.email} demoted`);
          load();
        } catch (e) {
          toast.error(e?.response?.data?.message || 'Failed to demote');
        }
      },
    });
  };

  const columns = [
    {
      key: 'name', label: 'Admin',
      render: a => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <div className={`am-avatar ${a.role === 'super_admin' ? 'am-avatar-super' : ''}`}>
            {a.role === 'super_admin' ? '⭐' : (a.name?.[0] ?? 'A').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text-primary)' }}>{a.name}</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{a.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role',
      render: a => a.role === 'super_admin'
        ? <Badge color="yellow">⭐ Super Admin</Badge>
        : a.adminRole
          ? <Badge color="purple">{NICE(a.adminRole.roleName)}</Badge>
          : <Badge color="default">No Role</Badge>,
    },
    {
      key: 'permissions', label: 'Permissions',
      render: a => {
        if (a.role === 'super_admin') return <Badge color="yellow">All (*)</Badge>;
        const perms = a.adminRole?.permissions ?? [];
        if (!perms.length) return <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>None</span>;
        return (
          <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
            {perms.length} permission{perms.length !== 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      key: 'lastActive', label: 'Last Active',
      render: a => a.lastActive ? new Date(a.lastActive).toLocaleDateString() : '—',
    },
    {
      key: 'actions', label: 'Actions',
      render: a => {
        const isSelf  = a._id === currentUser?.id || a.email === currentUser?.email;
        const isSuper = a.role === 'super_admin';
        if (isSelf)  return <Badge color="blue">You</Badge>;
        if (isSuper) return <Badge color="yellow">Protected</Badge>;
        if (!isSuperAdmin) return <Badge color="default">—</Badge>;
        return (
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <Btn size="sm" variant="secondary" onClick={() => setModal({ type: 'role', admin: a })}>
              Change Role
            </Btn>
            <Btn size="sm" variant="danger" onClick={() => demote(a)}>Demote</Btn>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <AdminUIStyles />

      <PageHeader
        title="Admin Management"
        subtitle={`${admins.length} administrator${admins.length !== 1 ? 's' : ''}`}
        actions={isSuperAdmin && (
          <div style={{ display: 'flex', gap: '.625rem', flexWrap: 'wrap' }}>
            {/* FIX: Btn now passes `style` through so this gold gradient renders */}
            <Btn
              size="sm"
              onClick={() => navigate('/admin/create-admin')}
              style={{
                background: 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)',
                color: '#1e293b',
                border: 'none',
                boxShadow: '0 2px 10px rgba(251,191,36,.35)',
              }}
            >
              ✦ Create New Admin
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => setModal('promote')}>
              + Promote Existing User
            </Btn>
          </div>
        )}
      />

      <Card style={{ marginBottom: '1rem', background: 'rgba(79,70,229,.06)', border: '1px solid rgba(79,70,229,.15)' }}>
        <div style={{ display: 'flex', gap: '.875rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.25rem' }}>ℹ</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.875rem', marginBottom: '.25rem', color: 'var(--text-primary)' }}>
              Role-Based Admin Access
            </div>
            <div style={{ fontSize: '.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Create New Admin</strong> registers a fresh account with admin role and permissions in one step.{' '}
              <strong>Promote Existing User</strong> grants admin role to someone who already has an account.
              Super admins have full access and are protected from modification.
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Table columns={columns} rows={admins} loading={loading} empty="No admins found" />
      </Card>

      {modal === 'promote' && (
        <PromoteModal roles={roles} onClose={() => setModal(null)} onSuccess={load} />
      )}
      {modal?.type === 'role' && (
        <RoleChangeModal admin={modal.admin} roles={roles} onClose={() => setModal(null)} onSuccess={load} />
      )}

      {/* FIX: use shared ConfirmDialog instead of ad-hoc overlay */}
      {confirm && (
        <ConfirmDialog
          msg={`Remove admin access from ${confirm.name} (${confirm.email})?`}
          detail="They will lose all admin privileges immediately."
          confirmLabel="Demote"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <style>{`
        .am-avatar{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9375rem;flex-shrink:0}
        .am-avatar-super{background:linear-gradient(135deg,#f59e0b,#ef4444)!important;font-size:1.1rem}
        .am-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:400;display:flex;align-items:center;justify-content:center;padding:1rem}
        .am-modal{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:1.75rem;max-width:460px;width:100%;box-shadow:var(--shadow-pop)}
        .am-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
        .am-modal-title{font-size:1.0625rem;font-weight:700;color:var(--text-primary)}
        .am-close{background:var(--bg-canvas);border:1px solid var(--border);color:var(--text-secondary);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem}
        .am-modal-desc{font-size:.875rem;color:var(--text-secondary);line-height:1.6;margin-bottom:1.25rem}
        .am-label{display:block;font-size:.8125rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.375rem}
        .am-input,.am-select{width:100%;background:var(--bg-canvas);border:1px solid var(--border);border-radius:8px;padding:.625rem .875rem;font-family:inherit;font-size:.875rem;color:var(--text-primary);outline:none;margin-bottom:.75rem;box-sizing:border-box}
        .am-input:focus,.am-select:focus{border-color:var(--accent)}
        .am-modal-footer{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1rem}
      `}</style>
    </>
  );
};

export default AdminAdmins;