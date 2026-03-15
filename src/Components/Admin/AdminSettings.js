// Components/Admin/AdminSettings.js — Settings & Platform Info
import React, { useEffect, useState } from 'react';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import { useAuth } from '../../Context/AuthContext';
import {
  PageHeader, Card, StatCard, Btn, Badge, AdminUIStyles,
} from './AdminUI';

const Section = ({ title, children }) => (
  <Card style={{ marginBottom: '1rem' }}>
    <div className="st-section-title">{title}</div>
    {children}
  </Card>
);

const Row = ({ label, value, mono }) => (
  <div className="st-row">
    <span className="st-label">{label}</span>
    <span className={`st-value ${mono ? 'st-mono' : ''}`}>{value ?? '—'}</span>
  </div>
);

const AdminSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiRequest.get('/api/admin/settings')
      .then(r => setSettings(r.data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const envBadge = env => {
    if (env === 'production') return <Badge color="green">Production</Badge>;
    if (env === 'development') return <Badge color="yellow">Development</Badge>;
    return <Badge color="default">{env}</Badge>;
  };

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Settings"
        subtitle="Platform configuration and system information"
      />

      {/* Platform stats */}
      {settings && (
        <div className="ap-stats-grid" style={{ marginBottom: '1.5rem' }}>
          <StatCard label="Total Users"   value={settings.stats?.totalUsers?.toLocaleString()}  icon="👤" color="#4f46e5" />
          <StatCard label="Active Subs"   value={settings.stats?.activeSubs?.toLocaleString()}  icon="◈"  color="#10b981" />
          <StatCard label="Banned Users"  value={settings.stats?.bannedCount?.toLocaleString()} icon="⊗"  color="#ef4444" />
        </div>
      )}

      {/* Platform Info */}
      <Section title="Platform Information">
        {loading
          ? <div className="ap-spinner-wrap"><div className="ap-spinner" style={{ width: 32, height: 32 }} /></div>
          : (
            <div className="st-grid">
              <Row label="Platform"    value={settings?.platform} />
              <Row label="Version"     value={settings?.version} mono />
              <Row label="Environment" value={envBadge(settings?.environment)} />
              <Row label="API Base"    value={process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL} mono />
            </div>
          )
        }
      </Section>

      {/* Session Info */}
      <Section title="Your Session">
        <div className="st-grid">
          <Row label="Email"   value={user?.email} />
          <Row label="Role"    value={<Badge color="purple">Admin</Badge>} />
          <Row label="User ID" value={user?.id} mono />
        </div>
      </Section>

      {/* Reward JSON config */}
      <Section title="Reward Configuration">
        <p className="st-desc">
          Reward slabs are configured via JSON files on the server.
          Use the API endpoints below to view or update them.
        </p>
        <div className="st-code-list">
          {[
            ['GET', '/api/admin/rewards/:type/:plan', 'View reward slabs (type: referral|post|streak, plan: 2500|3500|4500)'],
            ['PUT', '/api/admin/rewards/:type/:plan', 'Update reward slabs (body: array of slab objects)'],
          ].map(([method, path, desc]) => (
            <div key={path} className="st-code-row">
              <span className={`st-method st-${method.toLowerCase()}`}>{method}</span>
              <code className="st-path">{path}</code>
              <span className="st-desc-inline">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* API Reference */}
      <Section title="Admin API Reference">
        <p className="st-desc">All routes are protected by JWT + admin role middleware.</p>
        <div className="st-code-list">
          {[
            ['GET',    '/api/admin/analytics',              'Platform analytics & KPIs'],
            ['GET',    '/api/admin/users',                  'Paginated user list'],
            ['GET',    '/api/admin/users/:id',              'User detail with stats'],
            ['PATCH',  '/api/admin/users/:id/status',       'Ban / unban / activate'],
            ['DELETE', '/api/admin/users/:id',              'Delete user'],
            ['POST',   '/api/admin/users/:id/reset-rewards','Reset user rewards'],
            ['GET',    '/api/admin/rewards',                'Reward activities'],
            ['GET',    '/api/admin/reward-claims',          'Reward claims log'],
            ['POST',   '/api/admin/undo-reward',            'Undo a reward'],
            ['GET',    '/api/admin/posts',                  'Posts for moderation'],
            ['PATCH',  '/api/admin/posts/:id/moderation',   'Approve / reject post'],
            ['DELETE', '/api/admin/posts/:id',              'Delete post'],
            ['GET',    '/api/admin/reports/users',          'User report'],
            ['GET',    '/api/admin/reports/financial',      'Financial report'],
            ['GET',    '/api/admin/reports/rewards',        'Rewards report'],
            ['GET',    '/api/admin/admins',                 'List admins'],
            ['POST',   '/api/admin/admins',                 'Promote user to admin'],
            ['DELETE', '/api/admin/admins/:id',             'Demote admin'],
            ['GET',    '/api/admin/logs',                   'Activity audit logs'],
            ['GET',    '/api/admin/settings',               'Platform settings'],
          ].map(([method, path, desc]) => (
            <div key={path} className="st-code-row">
              <span className={`st-method st-${method.toLowerCase()}`}>{method}</span>
              <code className="st-path">{path}</code>
              <span className="st-desc-inline">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <style>{`
        .st-section-title { font-size:.9375rem; font-weight:700; color:var(--text-primary); margin-bottom:1rem; letter-spacing:-.01em; }
        .st-grid  { display:flex; flex-direction:column; gap:.375rem; }
        .st-row   { display:flex; justify-content:space-between; align-items:center; padding:.5rem .75rem; border-radius:8px; font-size:.875rem; }
        .st-row:nth-child(odd) { background:var(--bg-canvas); }
        .st-label { color:var(--text-secondary); font-weight:500; }
        .st-value { color:var(--text-primary); font-weight:600; text-align:right; }
        .st-mono  { font-family:'DM Mono',monospace; font-size:.8125rem; }
        .st-desc  { font-size:.875rem; color:var(--text-secondary); line-height:1.6; margin-bottom:.875rem; }
        .st-code-list { display:flex; flex-direction:column; gap:.375rem; }
        .st-code-row  { display:flex; align-items:center; gap:.75rem; padding:.5rem .75rem; background:var(--bg-canvas); border-radius:8px; flex-wrap:wrap; }
        .st-method { font-size:.6875rem; font-weight:800; padding:.2rem .5rem; border-radius:5px; text-transform:uppercase; letter-spacing:.06em; font-family:'DM Mono',monospace; flex-shrink:0; }
        .st-get    { background:rgba(16,185,129,.12); color:#10b981; }
        .st-post   { background:rgba(79,70,229,.12);  color:var(--accent); }
        .st-patch  { background:rgba(245,158,11,.12); color:#f59e0b; }
        .st-delete { background:rgba(239,68,68,.12);  color:#ef4444; }
        .st-path   { font-family:'DM Mono',monospace; font-size:.8125rem; color:var(--text-primary); flex-shrink:0; }
        .st-desc-inline { font-size:.8125rem; color:var(--text-secondary); flex:1; }
        @media(max-width:600px) { .st-code-row { flex-direction:column; align-items:flex-start; } }
      `}</style>
    </>
  );
};

export default AdminSettings;