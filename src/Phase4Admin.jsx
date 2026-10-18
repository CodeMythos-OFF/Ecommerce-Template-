import React, { useCallback, useEffect, useState } from 'react';
import './Phase4Admin.css';

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
const authHeaders = (extra = {}) => {
  const token = localStorage.getItem('shopmaster_session_token');
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options, headers: authHeaders(options.headers || {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const money = (value) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

export default function Phase4Admin({ currentUser }) {
  const [tab, setTab] = useState('analytics');
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    if (!currentUser?.isSuperAdmin) return;
    setLoading(true); setError('');
    try {
      if (tab === 'analytics') setAnalytics(await request('/admin/analytics'));
      if (tab === 'audit') setLogs(await request('/admin/audit-logs?limit=150'));
      if (tab === 'tickets') setTickets(await request('/support/tickets?limit=150'));
      if (tab === 'sellers') setSellers(await request('/sellers'));
    } catch (e) { setError(e.message || 'Could not load this section'); }
    finally { setLoading(false); }
  }, [tab, currentUser?.isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const updateTicket = async (ticket, updates) => {
    try {
      const saved = await request(`/support/tickets/${encodeURIComponent(ticket._id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
      });
      setTickets(items => items.map(item => item._id === saved._id ? saved : item));
    } catch (e) { setError(e.message); }
  };

  const updateSeller = async (seller) => {
    const draft = drafts[seller.email] || seller;
    try {
      const saved = await request(`/sellers/${encodeURIComponent(seller.email)}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, businessName: draft.businessName, phone: draft.phone || '', address: draft.address || '' })
      });
      setSellers(items => items.map(item => item.email === saved.email ? saved : item));
      setDrafts(items => { const next = { ...items }; delete next[seller.email]; return next; });
    } catch (e) { setError(e.message); }
  };

  const setSellerAccess = async (seller, approve) => {
    try {
      await request(`/sellers/${encodeURIComponent(seller.email)}/${approve ? 'approve' : 'revoke'}`, { method: 'PUT' });
      await load();
    } catch (e) { setError(e.message); }
  };

  if (!currentUser?.isSuperAdmin) return <div className="alert alert-warning">Phase 4 management is available to the super admin only.</div>;

  const maxDaily = Math.max(1, ...(analytics?.dailyOrders || []).map(item => item.orders || 0));
  const maxRevenue = Math.max(1, ...(analytics?.dailyOrders || []).map(item => item.revenue || 0));
  const ticketOpenCount = tickets.filter(ticket => !['Resolved', 'Closed'].includes(ticket.status)).length;

  return (
    <section className="phase4-admin">
      <header className="phase4-heading">
        <div><h3>Phase 4 · Operations Center</h3><p>Analytics, accountability, support, and seller controls.</p></div>
        <button className="btn btn-outline-primary" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </header>
      <div className="phase4-tabs">
        {[
          ['analytics', 'Analytics'], ['audit', 'Audit log'], ['tickets', `Support tickets`], ['sellers', 'Seller management']
        ].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'tickets' && ticketOpenCount > 0 && tab === 'tickets' ? ` · ${ticketOpenCount} open` : ''}</button>)}
      </div>
      {error && <div className="alert alert-danger d-flex justify-content-between align-items-center"><span>{error}</span><button className="btn-close" onClick={() => setError('')} aria-label="Dismiss error" /></div>}
      {loading && <p className="text-muted">Loading…</p>}

      {tab === 'analytics' && analytics && (
        <>
          <div className="phase4-metrics">
            <article><span>Lifetime orders</span><strong>{analytics.totals?.totalOrders || 0}</strong></article>
            <article><span>Lifetime revenue</span><strong>{money(analytics.totals?.totalRevenue)}</strong></article>
            <article><span>Average order value</span><strong>{money(analytics.totals?.averageOrderValue)}</strong></article>
            <article><span>Approved sellers</span><strong>{analytics.sellerCount || 0}</strong></article>
            <article><span>Active products</span><strong>{analytics.activeProductCount || 0}</strong></article>
            <article><span>Open tickets</span><strong>{(analytics.ticketCounts || []).filter(t => !['Resolved', 'Closed'].includes(t._id)).reduce((n, t) => n + t.count, 0)}</strong></article>
          </div>
          <div className="phase4-panels">
            <article className="phase4-card">
              <h4>Orders · last 30 days</h4>
              {(analytics.dailyOrders || []).length ? <div className="phase4-bars">{analytics.dailyOrders.map(day => <div className="phase4-bar-row" key={day._id} title={`${day._id}: ${day.orders} orders, ${money(day.revenue)}`}><time>{day._id.slice(5)}</time><div className="phase4-bar-track"><span style={{ width: `${Math.max(3, day.orders / maxDaily * 100)}%` }} /></div><b>{day.orders}</b></div>)}</div> : <p className="text-muted">No orders recorded in the last 30 days.</p>}
            </article>
            <article className="phase4-card">
              <h4>Order status</h4>
              {(analytics.statusCounts || []).length ? analytics.statusCounts.map(item => <div className="phase4-status-row" key={item._id}><span>{item._id || 'Unknown'}</span><strong>{item.count}</strong></div>) : <p className="text-muted">No order status data yet.</p>}
              <h4 className="mt-4">Top products by units</h4>
              {(analytics.topProducts || []).length ? analytics.topProducts.map(item => <div className="phase4-status-row" key={item._id}><span>{item._id}</span><strong>{item.units} units</strong></div>) : <p className="text-muted">No product sales yet.</p>}
            </article>
          </div>
          <p className="phase4-note">Revenue is calculated from recorded orders, not estimated visits. The chart shows order counts; hover a bar for its revenue.</p>
        </>
      )}

      {tab === 'audit' && (
        <div className="phase4-card">
          <div className="phase4-card-heading"><h4>Audit trail</h4><span>{logs.length} records</span></div>
          {logs.length === 0 ? <p className="text-muted">No audit entries yet. New support-ticket and seller-profile actions will appear here.</p> : <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>{logs.map(log => <tr key={log._id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actorName || log.actorEmail}<small className="d-block text-muted">{log.actorEmail}</small></td><td><code>{log.action}</code></td><td>{log.entityType}<small className="d-block text-muted">{log.entityId}</small></td><td>{JSON.stringify(log.details || {})}</td></tr>)}</tbody></table></div>}
        </div>
      )}

      {tab === 'tickets' && (
        <div className="phase4-ticket-list">
          {!tickets.length && !loading ? <div className="phase4-card"><h4>Support inbox is clear</h4><p className="text-muted">Customer-created tickets will appear here.</p></div> : tickets.map(ticket => <article className="phase4-card" key={ticket._id}>
            <div className="phase4-card-heading"><div><strong>{ticket.ticketNumber} · {ticket.subject}</strong><small className="d-block text-muted">{ticket.userName} · {ticket.userEmail} · {new Date(ticket.createdAt).toLocaleString()}</small></div><span className={`phase4-ticket-status status-${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span></div>
            <p className="phase4-ticket-message">{ticket.message}</p>
            <div className="phase4-ticket-controls">
              <label>Status<select className="form-select" value={ticket.status} onChange={e => updateTicket(ticket, { status: e.target.value })}>{['Open', 'In Progress', 'Resolved', 'Closed'].map(status => <option key={status}>{status}</option>)}</select></label>
              <label>Priority<select className="form-select" value={ticket.priority} onChange={e => updateTicket(ticket, { priority: e.target.value })}>{['Low', 'Normal', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              <label>Assigned to<input className="form-control" defaultValue={ticket.assignedTo || ''} onBlur={e => { if (e.target.value !== (ticket.assignedTo || '')) updateTicket(ticket, { assignedTo: e.target.value }); }} /></label>
            </div>
            <label className="d-block mt-3">Staff response<textarea className="form-control mt-1" rows="2" defaultValue={ticket.response || ''} placeholder="Add internal/customer response…" onBlur={e => { if (e.target.value !== (ticket.response || '')) updateTicket(ticket, { response: e.target.value }); }} /></label>
          </article>)}
        </div>
      )}

      {tab === 'sellers' && (
        <div className="phase4-sellers">
          {sellers.map(seller => {
            const draft = drafts[seller.email] || seller;
            return <article className="phase4-card" key={seller.email}>
              <div className="phase4-card-heading"><div><strong>{seller.businessName || 'Unnamed business'}</strong><small className="d-block text-muted">{seller.email}</small></div><span className={`phase4-ticket-status ${seller.isApproved ? 'status-resolved' : 'status-open'}`}>{seller.isSuperAdmin ? 'Super admin' : seller.isApproved ? 'Approved' : 'Pending / revoked'}</span></div>
              <div className="phase4-seller-fields">
                {[
                  ['name', 'Contact name'], ['businessName', 'Business name'], ['phone', 'Phone'], ['address', 'Business address']
                ].map(([key, label]) => <label key={key}>{label}<input className="form-control" value={draft[key] || ''} onChange={e => setDrafts(items => ({ ...items, [seller.email]: { ...seller, ...items[seller.email], [key]: e.target.value } }))} /></label>)}
              </div>
              <div className="phase4-seller-actions"><button className="btn btn-primary btn-sm" onClick={() => updateSeller(seller)}>Save profile</button>{!seller.isSuperAdmin && (seller.isApproved ? <button className="btn btn-outline-danger btn-sm" onClick={() => setSellerAccess(seller, false)}>Revoke access</button> : <button className="btn btn-outline-success btn-sm" onClick={() => setSellerAccess(seller, true)}>Approve seller</button>)}</div>
            </article>;
          })}
          {!sellers.length && !loading && <div className="phase4-card"><p className="text-muted mb-0">No seller records found.</p></div>}
        </div>
      )}
    </section>
  );
}
