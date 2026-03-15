// Components/Admin/AdminContent.js — Content Moderation
import React, { useEffect, useState, useCallback, useRef } from 'react';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import {
  PageHeader, Card, Btn, Badge, Select, SearchBar,
  Table, Pagination, DateRangeFilter, AdminUIStyles,
} from './AdminUI';

const STATUS_OPTIONS = [
  { value: '',         label: 'All Statuses' },
  { value: 'queued',   label: 'Queued' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const statusColor = s => s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'yellow';

// ── Post Preview Modal ──────────────────────────────────────────────────────
const PostModal = ({ post, onClose, onApprove, onReject, onDelete }) => (
  <div className="cm-overlay" onClick={onClose}>
    <div className="cm-modal" onClick={e => e.stopPropagation()}>
      <div className="cm-modal-header">
        <div>
          <div className="cm-modal-user">{post.user_id?.name || 'Unknown'}</div>
          <div className="cm-modal-email">{post.user_id?.email}</div>
        </div>
        <button className="cm-close" onClick={onClose}>✕</button>
      </div>

      {post.media?.length > 0 && (
        <div className="cm-media-grid">
          {post.media.map((m, i) => (
            m.type === 'video'
              ? <video key={i} src={m.url} controls className="cm-media-item" />
              : <img   key={i} src={m.url} alt="post media" className="cm-media-item" />
          ))}
        </div>
      )}

      {post.post && <p className="cm-post-text">{post.post}</p>}

      <div className="cm-meta">
        <span>Status: <Badge color={statusColor(post.moderation?.status)}>{post.moderation?.status || 'queued'}</Badge></span>
        <span>Posted: {new Date(post.date).toLocaleString()}</span>
        <span>Visibility: {post.visibility}</span>
        <span>Likes: {post.likes?.length || 0}</span>
      </div>

      <div className="cm-modal-actions">
        {post.moderation?.status !== 'approved' &&
          <Btn variant="success" size="sm" onClick={() => onApprove(post._id)}>✓ Approve</Btn>}
        {post.moderation?.status !== 'rejected' &&
          <Btn variant="secondary" size="sm" onClick={() => onReject(post._id)}>✗ Reject</Btn>}
        <Btn variant="danger" size="sm" onClick={() => onDelete(post._id)}>Delete</Btn>
      </div>
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────────
const AdminContent = () => {
  const [posts,      setPosts]      = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [status,     setStatus]     = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const [preview,    setPreview]    = useState(null);

  const fetchPosts = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 20,
        ...(status   && { status }),
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo   && { to: dateTo }),
      });
      const res = await apiRequest.get(`/api/admin/posts?${params}`);
      setPosts(res.data.posts);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load posts'); }
    finally   { setLoading(false); }
  }, [status, dateFrom, dateTo, page]);

  useEffect(() => { setPage(1); }, [status, dateFrom, dateTo]);
  useEffect(() => { fetchPosts(page); }, [page, status, dateFrom, dateTo]);

  const moderate = async (postId, newStatus) => {
    try {
      await apiRequest.patch(`/api/admin/posts/${postId}/moderation`, { status: newStatus });
      toast.success(`Post ${newStatus}`);
      setPreview(null);
      fetchPosts(page);
    } catch { toast.error('Failed to moderate post'); }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await apiRequest.delete(`/api/admin/posts/${postId}`);
      toast.success('Post deleted');
      setPreview(null);
      fetchPosts(page);
    } catch { toast.error('Failed to delete post'); }
  };

  const columns = [
    {
      key: 'user_id', label: 'Author',
      render: p => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{p.user_id?.name || '—'}</span>
          <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{p.user_id?.email}</span>
        </div>
      ),
    },
    {
      key: 'post', label: 'Content',
      render: p => (
        <span className="cm-snippet">
          {p.post ? p.post.slice(0, 80) + (p.post.length > 80 ? '…' : '') : <em style={{ color: 'var(--text-secondary)' }}>[media only]</em>}
        </span>
      ),
    },
    {
      key: 'media', label: 'Media',
      render: p => p.media?.length > 0
        ? <Badge color="blue">{p.media.length} file{p.media.length > 1 ? 's' : ''}</Badge>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'moderation', label: 'Status',
      render: p => <Badge color={statusColor(p.moderation?.status)}>{p.moderation?.status || 'queued'}</Badge>,
    },
    {
      key: 'visibility', label: 'Visibility',
      render: p => <Badge color="default">{p.visibility}</Badge>,
    },
    {
      key: 'date', label: 'Posted',
      render: p => new Date(p.date).toLocaleDateString(),
    },
    {
      key: 'actions', label: 'Actions',
      render: p => (
        <div style={{ display: 'flex', gap: '.375rem' }}>
          <Btn size="sm" variant="ghost"    onClick={() => setPreview(p)}>View</Btn>
          {p.moderation?.status !== 'approved' &&
            <Btn size="sm" variant="success"  onClick={() => moderate(p._id, 'approved')}>✓</Btn>}
          {p.moderation?.status !== 'rejected' &&
            <Btn size="sm" variant="secondary" onClick={() => moderate(p._id, 'rejected')}>✗</Btn>}
          <Btn size="sm" variant="danger"   onClick={() => deletePost(p._id)}>Del</Btn>
        </div>
      ),
    },
  ];

  // Status summary counts
  const queuedCount   = posts.filter(p => (p.moderation?.status || 'queued') === 'queued').length;
  const approvedCount = posts.filter(p => p.moderation?.status === 'approved').length;
  const rejectedCount = posts.filter(p => p.moderation?.status === 'rejected').length;

  return (
    <>
      <AdminUIStyles />
      <PageHeader
        title="Content Moderation"
        subtitle={`${pagination.total?.toLocaleString() ?? '—'} total posts`}
        actions={
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <Badge color="yellow">{queuedCount} queued</Badge>
            <Badge color="green">{approvedCount} approved</Badge>
            <Badge color="red">{rejectedCount} rejected</Badge>
          </div>
        }
      />

      <Card style={{ marginBottom: '1rem' }}>
        <div className="ap-filter-bar">
          <Select value={status} onChange={v => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} placeholder="All Statuses" />
          <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
          <Btn size="sm" variant="secondary" onClick={() => { setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</Btn>
          <Btn size="sm" variant="primary"   onClick={() => fetchPosts(page)}>↻ Refresh</Btn>
        </div>
      </Card>

      <Card>
        <Table columns={columns} rows={posts} loading={loading} empty="No posts found" />
        <Pagination page={page} pages={pagination.pages} onPage={setPage} />
      </Card>

      {preview && (
        <PostModal
          post={preview}
          onClose={() => setPreview(null)}
          onApprove={id => moderate(id, 'approved')}
          onReject={id  => moderate(id, 'rejected')}
          onDelete={deletePost}
        />
      )}

      <style>{`
        .cm-snippet   { font-size:.875rem; color:var(--text-primary); max-width:280px; display:block; }
        .cm-overlay   { position:fixed; inset:0; background:rgba(0,0,0,.7); backdrop-filter:blur(4px); z-index:400; display:flex; align-items:center; justify-content:center; padding:1rem; }
        .cm-modal     { background:var(--bg-card); border:1px solid var(--border); border-radius:16px; max-width:560px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-pop); }
        .cm-modal-header { display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); }
        .cm-modal-user   { font-weight:700; font-size:.9375rem; color:var(--text-primary); }
        .cm-modal-email  { font-size:.8125rem; color:var(--text-secondary); }
        .cm-close        { background:var(--bg-canvas); border:1px solid var(--border); color:var(--text-secondary); width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:1rem; }
        .cm-media-grid   { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:.5rem; padding:1rem 1.5rem; }
        .cm-media-item   { width:100%; border-radius:8px; object-fit:cover; max-height:240px; }
        .cm-post-text    { padding:1rem 1.5rem; font-size:.9375rem; color:var(--text-primary); line-height:1.7; border-top:1px solid var(--border); }
        .cm-meta         { display:flex; gap:1rem; flex-wrap:wrap; padding:.875rem 1.5rem; font-size:.8125rem; color:var(--text-secondary); border-top:1px solid var(--border); align-items:center; }
        .cm-modal-actions{ display:flex; gap:.75rem; padding:1rem 1.5rem; border-top:1px solid var(--border); flex-wrap:wrap; }
      `}</style>
    </>
  );
};

export default AdminContent;