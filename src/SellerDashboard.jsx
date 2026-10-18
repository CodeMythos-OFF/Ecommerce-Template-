import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getOrders, getStats, updateProduct } from "./api";
import "./SellerDashboard.css";

const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000/api" : "/api";
const authHeaders = (extra = {}) => {
  const token = localStorage.getItem("shopmaster_session_token");
  return { ...extra, ...(token ? { Authorization: "Bearer " + token } : {}) };
};
const money = (value) => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const TABS = ["Overview", "Sales", "Orders", "Products", "Inventory", "Customers", "Reviews", "Earnings", "Settings"];

export default function SellerDashboard({ currentUser }) {
  const [tab, setTab] = useState("Overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [reviews, setReviews] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [profile, setProfile] = useState({ name: "", businessName: "", phone: "", address: "" });
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!currentUser?.email) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const results = await Promise.all([
        fetch(API_URL + "/sellers/" + encodeURIComponent(currentUser.email) + "/products", { headers: authHeaders() }),
        getStats(currentUser.email),
        getOrders(200, currentUser.email)
      ]);
      const productResponse = results[0];
      const productData = await productResponse.json().catch(() => []);
      if (!productResponse.ok) throw new Error(productData.error || "Could not load seller inventory");
      const safeProducts = Array.isArray(productData) ? productData : [];
      const safeOrders = Array.isArray(results[2]) ? results[2] : [];
      setProducts(safeProducts); setStats(results[1] || {}); setOrders(safeOrders);
      setDrafts(Object.fromEntries(safeProducts.map(p => [p._id || p.id, { stock: String(p.stock ?? 0), isActive: p.isActive !== false }])));
      setProfile({ name: currentUser.sellerName || currentUser.name || "", businessName: currentUser.sellerBusinessName || "", phone: currentUser.sellerPhone || "", address: currentUser.sellerAddress || "" });
      const reviewResults = await Promise.all(safeProducts.slice(0, 30).map(async p => {
        try {
          const response = await fetch(API_URL + "/reviews/product/" + encodeURIComponent(p.id));
          const data = await response.json();
          return (data.reviews || []).map(review => ({ ...review, productId: p.id }));
        } catch { return []; }
      }));
      setReviews(reviewResults.flat().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) { setError(e.message || "Could not load seller dashboard"); }
    finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const sellerItems = useMemo(() => orders.flatMap(order => (order.products || [])
    .filter(item => String(item.sellerEmail || "").toLowerCase() === String(currentUser?.email || "").toLowerCase())
    .map(item => ({ ...item, orderId: order.trackingId || order._id, orderStatus: order.status || "Order Placed", orderDate: order.createdAt, customer: order.userName || "Customer", customerEmail: order.user || "" }))), [orders, currentUser?.email]);
  const filteredProducts = useMemo(() => products.filter(p => (p.id + " " + p.category + " " + (p.brand || "")).toLowerCase().includes(search.toLowerCase())), [products, search]);
  const filteredOrders = useMemo(() => orders.filter(o => {
    const mine = (o.products || []).some(p => String(p.sellerEmail || "").toLowerCase() === String(currentUser?.email || "").toLowerCase());
    return mine && (orderFilter === "All" || (o.status || "Order Placed") === orderFilter) &&
      (String(o.trackingId || "") + " " + String(o.userName || "") + " " + String(o.user || "")).toLowerCase().includes(search.toLowerCase());
  }), [orders, orderFilter, search, currentUser?.email]);
  const revenue = Number(stats.totalRevenue || sellerItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0));
  const unitsSold = sellerItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const lowStock = products.filter(p => Number(p.stock || 0) <= 5 && p.isActive !== false);
  const customers = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      const mine = (o.products || []).filter(p => String(p.sellerEmail || "").toLowerCase() === String(currentUser?.email || "").toLowerCase());
      if (mine.length && o.user) {
        const c = map.get(o.user) || { email: o.user, name: o.userName || "Customer", orders: 0, spent: 0, lastOrder: o.createdAt };
        c.orders += 1;
        c.spent += mine.reduce((sum,p) => sum + Number(p.price || 0) * Number(p.quantity || 0), 0);
        if (new Date(o.createdAt) > new Date(c.lastOrder || 0)) c.lastOrder = o.createdAt;
        map.set(o.user, c);
      }
    });
    return [...map.values()].sort((a,b) => b.spent - a.spent);
  }, [orders, currentUser?.email]);
  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate() - (6-i));
    const next = new Date(day); next.setDate(next.getDate()+1);
    return { label: day.toLocaleDateString("en-IN", { weekday: "short" }), amount: sellerItems.filter(item => item.orderDate && new Date(item.orderDate) >= day && new Date(item.orderDate) < next).reduce((sum,item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0) };
  });
  const maxSales = Math.max(1, ...lastSevenDays.map(day => day.amount));
  const averageRating = products.length ? products.reduce((sum,p) => sum + Number(p.averageRating || 0), 0) / products.length : 0;

  const saveInventory = async (product) => {
    const key = product._id || product.id; const draft = drafts[key] || {}; const stock = Number(draft.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) { setError("Stock must be a whole number from 0 to 1,000,000."); return; }
    setSavingId(key); setError(""); setNotice("");
    try { await updateProduct(product.id, { stock, isActive: Boolean(draft.isActive) }); setNotice("Inventory saved for " + product.id + "."); await load(); }
    catch (e) { setError(e.message || "Could not save inventory"); } finally { setSavingId(""); }
  };
  const saveProfile = async (event) => {
    event.preventDefault(); setSavingProfile(true); setError(""); setNotice("");
    try {
      const response = await fetch(API_URL + "/sellers/" + encodeURIComponent(currentUser.email) + "/profile", { method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(profile) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save seller profile");
      setNotice("Seller profile updated.");
    } catch (e) { setError(e.message || "Could not save seller profile"); } finally { setSavingProfile(false); }
  };

  if (!currentUser) return <div className="container py-5"><div className="alert alert-info">Sign in to access your seller dashboard.</div></div>;
  if (loading) return <div className="container py-5 text-center"><div className="spinner-border" role="status" /><p className="mt-3">Loading seller dashboard…</p></div>;

  const Stat = ({ label, value, note }) => <div className="col-6 col-xl-3"><div className="seller-stat"><div className="card-body p-3 p-md-4"><div className="small seller-muted">{label}</div><div className="stat-value mt-2">{value}</div>{note && <div className="small seller-muted mt-1">{note}</div>}</div></div></div>;
  const Panel = ({ title, subtitle, children, action }) => <section className="seller-panel mb-4"><div className="seller-panel-head d-flex flex-wrap justify-content-between align-items-center gap-2"><div><h2 className="h5 mb-1">{title}</h2>{subtitle && <p className="small seller-muted mb-0">{subtitle}</p>}</div>{action}</div><div className="seller-panel-body">{children}</div></section>;
  const ProductTable = ({ inventory = false }) => <div className="table-responsive"><table className="table seller-table align-middle"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th>{inventory && <th>Update inventory</th>}</tr></thead><tbody>{filteredProducts.map(p => { const key=p._id||p.id; const draft=drafts[key]||{stock:String(p.stock??0),isActive:p.isActive!==false}; return <tr key={key}><td><div className="d-flex align-items-center gap-2"><img className="seller-product-img" src={p.img} alt=""/><div><strong>{p.id}</strong><div className="small seller-muted">{p.category}</div></div></div></td><td>{money(p.cost)}</td><td><span className={Number(p.stock||0)<=5?"text-danger fw-bold":""}>{p.stock ?? 0}</span></td><td><span className={"badge " + (p.isActive!==false?"bg-success-subtle text-success":"bg-secondary-subtle text-secondary")}>{p.isActive!==false?"Active":"Hidden"}</span></td>{inventory && <td><div className="d-flex gap-2 align-items-center" style={{minWidth:190}}><input className="form-control form-control-sm" type="number" min="0" max="1000000" step="1" value={draft.stock} onChange={e=>setDrafts(prev=>({...prev,[key]:{...draft,stock:e.target.value}}))} aria-label={"Stock for " + p.id}/><button className="btn btn-sm btn-primary" disabled={savingId===key} onClick={()=>saveInventory(p)}>{savingId===key?"Saving…":"Save"}</button></div><label className="form-check form-switch mt-2 mb-0"><input className="form-check-input" type="checkbox" checked={Boolean(draft.isActive)} onChange={e=>setDrafts(prev=>({...prev,[key]:{...draft,isActive:e.target.checked}}))}/><span className="small">Publish listing</span></label></td>}</tr>})}</tbody></table>{!filteredProducts.length && <div className="seller-empty">No matching products.</div>}</div>;

  return <main className="seller-dashboard container py-4 py-md-5">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><div><div className="text-uppercase small seller-muted fw-bold">Seller workspace</div><h1 className="h2 fw-bold mb-1">{currentUser.sellerBusinessName || currentUser.name || "Seller"} dashboard</h1><p className="seller-muted mb-0">Sales, inventory, customers and store performance in one place.</p></div><button className="btn btn-outline-primary" onClick={load}>↻ Refresh data</button></div>
    <div className="seller-nav" role="tablist" aria-label="Seller dashboard sections">{TABS.map(item=><button key={item} type="button" role="tab" aria-selected={tab===item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    {lowStock.length>0 && <div className="seller-low-stock mb-4"><strong>⚠ Low inventory:</strong> {lowStock.length} active listing(s) have 5 or fewer units. <button className="btn btn-sm btn-link p-0 ms-1" onClick={()=>setTab("Inventory")}>Review inventory</button></div>}
    {["Overview","Sales","Earnings"].includes(tab) && <div className="row g-3 mb-4"><Stat label="Products" value={stats.totalProducts ?? products.length} note="Your listings"/><Stat label="Active listings" value={stats.activeProducts ?? products.filter(p=>p.isActive!==false).length} note="Visible in store"/><Stat label="Orders" value={stats.totalOrders ?? orders.length} note="Orders with your items"/><Stat label="Product revenue" value={money(revenue)} note="Gross product-line revenue"/></div>}
    {["Overview","Sales"].includes(tab) && <div className="row g-3 mb-4"><div className="col-lg-8"><Panel title="Sales over the last 7 days" subtitle="Gross product revenue based on order dates"><div className="seller-chart">{lastSevenDays.map(day=><div className="seller-chart-col" key={day.label} title={day.label + ": " + money(day.amount)}><div className="small seller-muted">{day.amount?money(day.amount):"—"}</div><div className="seller-chart-bar" style={{height:Math.max(3,day.amount/maxSales*100)+"%"}}/><div className="seller-chart-label">{day.label}</div></div>)}</div></Panel></div><div className="col-lg-4"><Panel title="Store snapshot"><div className="d-flex justify-content-between py-2 border-bottom"><span className="seller-muted">Units sold</span><strong>{unitsSold}</strong></div><div className="d-flex justify-content-between py-2 border-bottom"><span className="seller-muted">Customers</span><strong>{customers.length}</strong></div><div className="d-flex justify-content-between py-2 border-bottom"><span className="seller-muted">Average product rating</span><strong>{averageRating? "★ " + averageRating.toFixed(1):"No ratings"}</strong></div><div className="d-flex justify-content-between py-2"><span className="seller-muted">Low-stock listings</span><strong className={lowStock.length?"text-danger":""}>{lowStock.length}</strong></div></Panel></div></div>}
    {tab==="Overview" && <><Panel title="Inventory at a glance" subtitle="Your current listings"><ProductTable/></Panel><Panel title="Recent orders" subtitle="Latest orders containing your products" action={<button className="btn btn-sm btn-outline-primary" onClick={()=>setTab("Orders")}>View all</button>}><div className="small seller-muted">{orders.filter(o=>(o.products||[]).some(p=>String(p.sellerEmail||"").toLowerCase()===currentUser.email.toLowerCase())).slice(0,5).map(o=><div className="d-flex flex-wrap justify-content-between border-bottom py-2 gap-2" key={o._id||o.trackingId}><span><strong>{o.trackingId}</strong> · {o.userName||"Customer"}</span><span>{o.status||"Order Placed"} · {dateLabel(o.createdAt)}</span></div>)}</div></Panel></>}
    {tab==="Sales" && <Panel title="Product performance"><div className="table-responsive"><table className="table seller-table"><thead><tr><th>Product</th><th>Units sold</th><th>Gross sales</th><th>Rating</th></tr></thead><tbody>{products.map(p=>{const sold=sellerItems.filter(i=>i.name===p.id);return <tr key={p.id}><td>{p.id}</td><td>{sold.reduce((n,i)=>n+Number(i.quantity||0),0)}</td><td>{money(sold.reduce((n,i)=>n+Number(i.price||0)*Number(i.quantity||0),0))}</td><td>{p.averageRating?"★ "+Number(p.averageRating).toFixed(1)+" ("+(p.reviewCount||0)+")":"No reviews"}</td></tr>})}</tbody></table></div></Panel>}
    {tab==="Orders" && <Panel title="Orders containing your products" subtitle="Filter and search the shared order records" action={<select className="form-select form-select-sm" style={{width:170}} value={orderFilter} onChange={e=>setOrderFilter(e.target.value)}><option>All</option>{["Order Placed","Processing","Shipped","Out for Delivery","Delivered","Cancelled"].map(s=><option key={s}>{s}</option>)}</select>}><input className="form-control mb-3" placeholder="Search orders or customers…" value={search} onChange={e=>setSearch(e.target.value)}/>{filteredOrders.length?<div className="table-responsive"><table className="table seller-table"><thead><tr><th>Order</th><th>Customer</th><th>Your items</th><th>Status</th><th>Date</th></tr></thead><tbody>{filteredOrders.map(o=><tr key={o._id||o.trackingId}><td><strong>{o.trackingId||o._id}</strong></td><td>{o.userName||"Customer"}</td><td>{(o.products||[]).filter(p=>String(p.sellerEmail||"").toLowerCase()===currentUser.email.toLowerCase()).map(p=>p.name+" × "+p.quantity).join(", ")}</td><td><span className="badge bg-secondary">{o.status||"Order Placed"}</span></td><td>{dateLabel(o.createdAt)}</td></tr>)}</tbody></table></div>:<div className="seller-empty">No matching orders.</div>}</Panel>}
    {tab==="Products" && <Panel title="Product performance" subtitle="Search and review your own listings"><input className="form-control mb-3" placeholder="Search product, category or brand…" value={search} onChange={e=>setSearch(e.target.value)}/><ProductTable/></Panel>}
    {tab==="Inventory" && <Panel title="Inventory management" subtitle="Update available stock and publish or hide your own listings"><ProductTable inventory/></Panel>}
    {tab==="Customers" && <Panel title="Your customers" subtitle="Customer information derived from orders containing your products">{customers.length?<div className="table-responsive"><table className="table seller-table"><thead><tr><th>Customer</th><th>Orders</th><th>Product spend</th><th>Last order</th></tr></thead><tbody>{customers.map(c=><tr key={c.email}><td><strong>{c.name}</strong><div className="small seller-muted">{c.email}</div></td><td>{c.orders}</td><td>{money(c.spent)}</td><td>{dateLabel(c.lastOrder)}</td></tr>)}</tbody></table></div>:<div className="seller-empty">Customer details will appear after your first order.</div>}</Panel>}
    {tab==="Reviews" && <Panel title="Product reviews" subtitle="Reviews for your listings">{reviews.length?<div className="d-grid gap-3">{reviews.map((review,index)=><article className="border rounded-3 p-3" key={review._id||review.productId+"-"+index}><div className="d-flex flex-wrap justify-content-between gap-2"><div><strong>{review.productId}</strong><div className="small seller-muted">By {review.userName||"Customer"} · {dateLabel(review.createdAt)}</div></div><span className="badge bg-warning-subtle text-warning-emphasis">★ {review.rating}/5</span></div>{review.comment&&<p className="mb-0 mt-2">{review.comment}</p>}</article>)}</div>:<div className="seller-empty">No reviews for your products yet.</div>}</Panel>}
    {tab==="Earnings" && <><div className="alert alert-info">This is an estimate of product-line sales, not a payout balance. ShopMaster currently supports Cash on Delivery only.</div><Panel title="Recent product sales"><div className="table-responsive"><table className="table seller-table"><thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Line total</th><th>Date</th></tr></thead><tbody>{sellerItems.slice().sort((a,b)=>new Date(b.orderDate)-new Date(a.orderDate)).slice(0,100).map((item,index)=><tr key={item.orderId+"-"+item.name+"-"+index}><td>{item.orderId}</td><td>{item.name}</td><td>{item.quantity}</td><td>{money(Number(item.price||0)*Number(item.quantity||0))}</td><td>{dateLabel(item.orderDate)}</td></tr>)}</tbody></table></div></Panel></>}
    {tab==="Settings" && <Panel title="Seller profile" subtitle="Update your seller contact and storefront information"><form onSubmit={saveProfile} className="row g-3"><div className="col-md-6"><label className="form-label">Seller name</label><input className="form-control" maxLength="160" required value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/></div><div className="col-md-6"><label className="form-label">Business / brand name</label><input className="form-control" maxLength="160" required value={profile.businessName} onChange={e=>setProfile(p=>({...p,businessName:e.target.value}))}/></div><div className="col-md-6"><label className="form-label">Contact phone</label><input className="form-control" maxLength="40" value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}/></div><div className="col-12"><label className="form-label">Business address</label><textarea className="form-control" rows="3" maxLength="500" value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))}/></div><div className="col-12"><button className="btn btn-primary" disabled={savingProfile}>{savingProfile?"Saving…":"Save profile"}</button><div className="small seller-muted mt-2">Signed in as {currentUser.email}</div></div></form></Panel>}
  </main>;
}
