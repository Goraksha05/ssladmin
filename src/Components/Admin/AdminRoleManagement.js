// Components/Admin/AdminRoleManagement.js
// Full role management UI — super_admin only.
// Create / edit / delete AdminRole documents.
// Permission tokens fetched from /api/admin/permissions and rendered as grouped checkboxes.

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import {
  PageHeader, Card, Btn, Badge, Table, AdminUIStyles,
} from './AdminUI';

// ── Permission token display metadata ────────────────────────────────────────
const MODULE_META = {
  Users:     { color: 'blue',   icon: '👥', keys: ['view_users','ban_users','suspend_users','reset_rewards'] },
  Rewards:   { color: 'purple', icon: '🎁', keys: ['view_rewards','manage_rewards','undo_rewards','approve_reward_claims'] },
  Financial: { color: 'green',  icon: '💰', keys: ['view_financial_reports','export_financial_reports','manage_payouts'] },
  Posts:     { color: 'yellow', icon: '📝', keys: ['moderate_posts','delete_posts','approve_posts','reject_posts'] },
  Analytics: { color: 'blue',   icon: '📈', keys: ['view_analytics','view_reports','export_reports'] },
  Admin:     { color: 'red',    icon: '🛡️', keys: ['manage_admins','manage_roles','view_audit_logs'] },
};

const NICE_NAME = (perm) =>
  perm.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── RoleFormModal ─────────────────────────────────────────────────────────────
const RoleFormModal = ({ role, onClose, onSaved }) => {
  const isEdit = !!role;
  const [roleName,     setRoleName]     = useState(role?.roleName     ?? '');
  const [description,  setDescription]  = useState(role?.description  ?? '');
  const [permissions,  setPermissions]  = useState(role?.permissions  ?? []);
  const [saving,       setSaving]       = useState(false);

  const togglePerm = (p) =>
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleModule = (keys) => {
    const allOn = keys.every(k => permissions.includes(k));
    if (allOn) setPermissions(prev => prev.filter(p => !keys.includes(p)));
    else       setPermissions(prev => [...new Set([...prev, ...keys])]);
  };

  const save = async () => {
    if (!roleName.trim()) return toast.warn('Role name is required');
    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest.put(`/api/admin/roles/${role._id}`, { permissions, description });
        toast.success('Role updated');
      } else {
        await apiRequest.post('/api/admin/roles', { roleName: roleName.trim(), permissions, description });
        toast.success('Role created');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rm-overlay">
      <div className="rm-modal">
        <div className="rm-modal-header">
          <h3 className="rm-modal-title">{isEdit ? `Edit: ${role.roleName}` : 'Create New Role'}</h3>
          <button className="rm-close" onClick={onClose}>✕</button>
        </div>

        <div className="rm-body">
          {!isEdit && (
            <div className="rm-field">
              <label className="rm-label">Role Name</label>
              <input
                className="rm-input"
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
                placeholder="e.g. finance_admin"
              />
            </div>
          )}
          <div className="rm-field">
            <label className="rm-label">Description</label>
            <input
              className="rm-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description"
            />
          </div>

          <div className="rm-field">
            <label className="rm-label">Permissions</label>
            <div className="rm-perm-grid">
              {Object.entries(MODULE_META).map(([module, { color, icon, keys }]) => {
                const allChecked = keys.every(k => permissions.includes(k));
                return (
                  <div key={module} className="rm-module-card">
                    <div className="rm-module-header" onClick={() => toggleModule(keys)}>
                      <span className="rm-module-icon">{icon}</span>
                      <span className="rm-module-name">{module}</span>
                      <input
                        type="checkbox"
                        className="rm-check"
                        checked={allChecked}
                        onChange={() => toggleModule(keys)}
                        onClick={e => e.stopPropagation()}
                        title={`Toggle all ${module} permissions`}
                      />
                    </div>
                    <div className="rm-perms-list">
                      {keys.map(k => (
                        <label key={k} className="rm-perm-row">
                          <input
                            type="checkbox"
                            className="rm-check"
                            checked={permissions.includes(k)}
                            onChange={() => togglePerm(k)}
                          />
                          <span className="rm-perm-name">{NICE_NAME(k)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rm-count">
            <Badge color="blue">{permissions.length} permission{permissions.length !== 1 ? 's' : ''} selected</Badge>
          </div>
        </div>

        <div className="rm-footer">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary"   size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Role' : 'Create Role'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminRoleManagement = () => {
  const [roles,    setRoles]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);   // false | 'create' | roleObject
  const [confirm,  setConfirm]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest.get('/api/admin/roles');
      setRoles(res.data.roles);
    } catch { toast.error('Failed to load roles'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteRole = (role) => {
    setConfirm({
      msg: `Delete role "${role.roleName}"? All admins with this role will lose it.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiRequest.delete(`/api/admin/roles/${role._id}`);
          toast.success('Role deleted');
          load();
        } catch (e) {
          toast.error(e?.response?.data?.message || 'Failed to delete');
        }
      },
    });
  };

  const columns = [
    {
      key: 'roleName', label: 'Role',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div className="rm-avatar">{(r.roleName?.[0] ?? 'R').toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text-primary)' }}>
              {r.roleName.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{r.description || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'permissions', label: 'Permissions',
      render: r => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem', maxWidth: 320 }}>
          {r.permissions.slice(0, 4).map(p => (
            <Badge key={p} color="blue">{NICE_NAME(p)}</Badge>
          ))}
          {r.permissions.length > 4 && (
            <Badge color="default">+{r.permissions.length - 4} more</Badge>
          )}
          {r.permissions.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>No permissions</span>}
        </div>
      ),
    },
    {
      key: 'createdAt', label: 'Created',
      render: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
    },
    {
      key: 'actions', label: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <Btn size="sm" variant="secondary" onClick={() => setModal(r)}>Edit</Btn>
          <Btn size="sm" variant="danger"    onClick={() => deleteRole(r)}>Delete</Btn>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Roles & Permissions"
        subtitle={`${roles.length} role${roles.length !== 1 ? 's' : ''} configured`}
        actions={<Btn size="sm" onClick={() => setModal('create')}>+ New Role</Btn>}
      />

      <Card style={{ marginBottom: '1rem', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.18)' }}>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.25rem' }}>⭐</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.875rem', marginBottom: '.25rem', color: 'var(--text-primary)' }}>
              Super Admin Access
            </div>
            <div style={{ fontSize: '.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Super admins bypass all permission checks. This page is only visible to super admins.
              Roles created here can be assigned to regular admins.
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Table columns={columns} rows={roles} loading={loading} empty="No roles configured yet" />
      </Card>

      {(modal === 'create' || (modal && typeof modal === 'object')) && (
        <RoleFormModal
          role={modal === 'create' ? null : modal}
          onClose={() => setModal(false)}
          onSaved={load}
        />
      )}

      {confirm && (
        <div className="rm-overlay">
          <div className="rm-modal" style={{ maxWidth: 400 }}>
            <div className="rm-modal-header">
              <h3 className="rm-modal-title">Confirm Delete</h3>
              <button className="rm-close" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)', margin: '1rem 0 1.5rem', lineHeight: 1.6 }}>
              {confirm.msg}
            </p>
            <div className="rm-footer">
              <Btn variant="secondary" size="sm" onClick={() => setConfirm(null)}>Cancel</Btn>
              <Btn variant="danger"    size="sm" onClick={confirm.onConfirm}>Delete</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);z-index:400;display:flex;align-items:center;justify-content:center;padding:1rem}
        .rm-modal{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:1.75rem;max-width:680px;width:100%;box-shadow:var(--shadow-pop);max-height:90vh;overflow-y:auto}
        .rm-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem}
        .rm-modal-title{font-size:1.0625rem;font-weight:700;color:var(--text-primary)}
        .rm-close{background:var(--bg-canvas);border:1px solid var(--border);color:var(--text-secondary);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem}
        .rm-body{display:flex;flex-direction:column;gap:1.25rem}
        .rm-field{display:flex;flex-direction:column;gap:.5rem}
        .rm-label{font-size:.8125rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em}
        .rm-input{background:var(--bg-canvas);border:1px solid var(--border);border-radius:8px;padding:.625rem .875rem;font-family:inherit;font-size:.875rem;color:var(--text-primary);outline:none}
        .rm-input:focus{border-color:var(--accent)}
        .rm-perm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem}
        .rm-module-card{background:var(--bg-canvas);border:1px solid var(--border);border-radius:10px;overflow:hidden}
        .rm-module-header{display:flex;align-items:center;gap:.625rem;padding:.625rem .875rem;cursor:pointer;background:var(--bg-secondary);border-bottom:1px solid var(--border)}
        .rm-module-header:hover{background:var(--bg-tertiary)}
        .rm-module-icon{font-size:1rem}
        .rm-module-name{font-size:.8125rem;font-weight:700;color:var(--text-primary);flex:1;text-transform:uppercase;letter-spacing:.04em}
        .rm-perms-list{padding:.5rem .875rem .75rem;display:flex;flex-direction:column;gap:.375rem}
        .rm-perm-row{display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.8125rem;color:var(--text-secondary)}
        .rm-perm-row:hover{color:var(--text-primary)}
        .rm-perm-name{flex:1}
        .rm-check{accent-color:var(--accent);cursor:pointer}
        .rm-count{display:flex;justify-content:flex-end}
        .rm-footer{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--border)}
        .rm-avatar{width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.875rem;flex-shrink:0}
      `}</style>
    </>
  );
};

export default AdminRoleManagement;