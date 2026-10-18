import React, { useCallback, useEffect, useState } from "react";
import { getOrders, getStats, updateProduct } from "./api";

const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000/api" : "/api";
const authHeaders = () => {
  const token = localStorage.getItem("shopmaster_session_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function SellerDashboard({ currentUser }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!currentUser?.email) return;
    setLoading(true); setError("");
    try {
      const [productResponse, sellerStats, sellerOrders] = await Promise.all([
        fetch(`${API_URL}/sellers/${encodeURIComponent(currentUser.email)}/products`, { headers: authHeaders() }),
        getStats(currentUser.email),
        getOrders(100, currentUser.email)
      ]);
      const productData = await productResponse.json().catch(() => []);
      if (!productResponse.ok) throw new Error(productData.error || "Could not load seller inventory");
      setProducts(Array.isArray(productData) ? productData : []);
      setStats(sellerStats || {});
      setOrders(Array.isArray(sellerOrders) ? sellerOrders : []);
      setDrafts(Object.fromEntries((Array.isArray(productData) ? productData : []).map(p => [p._id || p.id, { stock: String(p.stock ?? 0), isActive: p.isActive !== false }])));
    } catch (e) { setError(e.message || "Could not load seller dashboard"); }
    finally { setLoading(false); }
  }, [currentUser?.email]);

  useEffect(() => { load(); }, [load]);

  const saveInventory = async (product) => {
    const key = product._id || product.id;
    const draft = drafts[key] || {};
    const stock = Number(draft.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) { setError("Stock must be a whole number from 0 to 1,000,000."); return; }
    setSavingId(key); setError(""); setNotice("");
    try {
      await updateProduct(product.id, { stock, isActive: Boolean(draft.isActive) });
      setNotice(`Inventory saved for ${product.id}.`);
      await load();
    } catch (e) { setError(e.message || "Could not save inventory"); }
    finally { setSavingId(""); }
  };

  if (!currentUser) return <div className="container py-5"><div className="alert alert-info">Sign in to access your seller dashboard.</div></div>;
  if (loading) return <div className="container py-5 text-center"><div className="spinner-border" role="status" /><p className="mt-3">Loading seller dashboard…</p></div>;

  return <main className="container py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><div><div className="text-uppercase small text-muted fw-bold">Seller workspace</div><h1 className="h2 fw-bold mb-1">{currentUser.name || "Seller"} dashboard</h1><p className="text-muted mb-0">Manage your listings, inventory and seller orders.</p></div><button className="btn btn-outline-primary" onClick={load}>↻ Refresh</button></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="row g-3 mb-4">
      {[["Products", stats.totalProducts ?? products.length],["Active listings", stats.activeProducts ?? products.filter(p=>p.isActive).length],["Orders", stats.totalOrders ?? orders.length],["Product revenue", `₹${Number(stats.totalRevenue || 0).toLocaleString("en-IN")}`]].map(([label,value])=><div className="col-6 col-xl-3" key={label}><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="small text-muted">{label}</div><div className="h3 fw-bold mt-2 mb-0">{value}</div></div></div></div>)}
    </div>
    <section className="card border-0 shadow-sm mb-4"><div className="card-header bg-white py-3"><h2 className="h5 mb-0">Inventory management</h2><p className="small text-muted mb-0 mt-1">Update stock and hide or publish your own listings.</p></div>
      <div className="card-body">
      {!products.length ? <div className="alert alert-info mb-0">No products found for this seller. Add products from the product management page when seller access is approved.</div> :
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Product</th><th>Price</th><th style={{minWidth:110}}>Stock</th><th>Status</th><th></th></tr></thead><tbody>
      {products.map(p=>{const key=p._id||p.id;const draft=drafts[key]||{stock:String(p.stock??0),isActive:p.isActive!==false};return <tr key={key}><td><div className="d-flex align-items-center gap-2"><img src={p.img} alt="" style={{width:48,height:48,objectFit:"cover",borderRadius:8}}/><div><strong>{p.id}</strong><div className="small text-muted">{p.category}</div></div></div></td><td>₹{Number(p.cost||0).toLocaleString("en-IN")}</td><td><input className="form-control form-control-sm" type="number" min="0" max="1000000" step="1" value={draft.stock} onChange={e=>setDrafts(prev=>({...prev,[key]:{...draft,stock:e.target.value}}))} aria-label={`Stock for ${p.id}`} /></td><td><label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={Boolean(draft.isActive)} onChange={e=>setDrafts(prev=>({...prev,[key]:{...draft,isActive:e.target.checked}}))}/><span className="small">{draft.isActive?"Active":"Hidden"}</span></label></td><td><button className="btn btn-sm btn-primary" disabled={savingId===key} onClick={()=>saveInventory(p)}>{savingId===key?"Saving…":"Save"}</button></td></tr>})}
      </tbody></table></div>}
      </div>
    </section>
    <section className="card border-0 shadow-sm"><div className="card-header bg-white py-3"><h2 className="h5 mb-0">Recent orders containing your products</h2></div><div className="card-body">
      {!orders.length ? <p className="text-muted mb-0">No seller orders yet.</p> : <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.slice(0,20).map(o=><tr key={o._id||o.trackingId}><td><strong>{o.trackingId || o._id}</strong></td><td>{o.userName || "Customer"}</td><td>{(o.products||[]).filter(p=>String(p.sellerEmail||"").toLowerCase()===currentUser.email.toLowerCase()).map(p=>`${p.name} × ${p.quantity}`).join(", ") || "—"}</td><td><span className="badge bg-secondary">{o.status || "Order Placed"}</span></td><td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>}
    </div></section>
  </main>;
}
