import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getOrders, submitReview } from "./api";

const STATUS_STEPS = ["Order Placed", "Processing", "Shipped", "Delivered"];

const OrderHistory = ({ currentUser }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [reviewStates, setReviewStates] = useState({});

  const loadOrders = useCallback(async (refresh = false) => {
    if (!currentUser?.email) { setOrders([]); setLoading(false); return; }
    try {
      if (refresh) setRefreshing(true); else setLoading(true);
      const data = await getOrders(50, null, currentUser.email);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      Swal.fire({ icon: "error", title: "Couldn’t load orders", text: error.message || "Please try again." });
    } finally { setLoading(false); setRefreshing(false); }
  }, [currentUser?.email]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const id = String(order._id || order.id || order.trackingId || "").toLowerCase();
      const status = String(order.status || "Order Placed").toLowerCase();
      const items = (order.cart || []).map((item) => `${item.id || ""} ${item.brand || ""}`).join(" ").toLowerCase();
      return id.includes(term) || status.includes(term) || items.includes(term);
    });
  }, [orders, search]);

  const setReview = (key, patch) => setReviewStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const submitItemReview = async (key, item, status, orderId) => {
    const state = reviewStates[key] || {};
    if (status.toLowerCase() !== "delivered") return Swal.fire({ icon: "info", title: "Not available yet", text: "Reviews unlock after delivery." });
    if (!state.rating) return Swal.fire({ icon: "warning", title: "Select a rating", text: "Choose 1–5 stars first." });
    try {
      await submitReview({ productId: item.id || item.productId || key, rating: state.rating, comment: state.comment || "", userEmail: currentUser.email, orderId });
      setReview(key, { submitted: true, showForm: false });
      window.dispatchEvent(new CustomEvent("productsUpdated"));
      Swal.fire({ icon: "success", title: "Review published", timer: 1500, showConfirmButton: false });
    } catch (error) { Swal.fire({ icon: "error", title: "Failed to save review", text: error.message || "Please try again." }); }
  };

  const statusColor = (status) => ({ "order placed": "bg-primary", processing: "bg-info text-dark", shipped: "bg-warning text-dark", delivered: "bg-success" }[String(status).toLowerCase()] || "bg-secondary");

  if (loading) return <div className="container py-5 text-center"><div className="spinner-border text-primary" role="status"></div><p className="text-muted mt-3">Loading your order history...</p></div>;

  return <div className="container py-4 order-history-page">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><div className="text-muted small">ACCOUNT / ORDERS</div><h2 className="fw-bold mb-1">Your Orders</h2><p className="text-muted mb-0">{orders.length} order{orders.length === 1 ? "" : "s"} in your account</p></div>
      <div className="d-flex gap-2"><div className="input-group"><span className="input-group-text"><i className="bi bi-search"></i></span><input className="form-control" type="search" placeholder="Search orders" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="btn btn-outline-primary" onClick={() => loadOrders(true)} disabled={refreshing}><i className={refreshing ? "bi bi-arrow-repeat" : "bi bi-arrow-clockwise"}></i></button></div>
    </div>
    <div className="alert alert-light border"><i className="bi bi-shield-check text-success me-2"></i><strong>Private order history.</strong> Only orders from your signed-in account are shown.</div>
    {filteredOrders.length === 0 ? <div className="card shadow-sm border-0 text-center p-5"><i className="bi bi-bag-x text-muted" style={{ fontSize: "4rem" }}></i><h4 className="mt-3">{search ? "No matching orders" : "No orders yet"}</h4><p className="text-muted">{search ? "Try another search." : "Your purchases will appear here."}</p><button className="btn btn-primary" onClick={() => (window.location.hash = "#p")}>Continue Shopping</button></div> :
      filteredOrders.map((order) => {
        const orderId = order._id || order.id || "N/A";
        const status = order.status || "Order Placed";
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        const expanded = expandedOrder === orderId;
        const statusIndex = Math.max(0, STATUS_STEPS.indexOf(status));
        return <article key={orderId} className="card shadow-sm border-0 rounded-4 overflow-hidden mb-4">
          <div className="card-header bg-white p-3 p-md-4"><div className="row g-3 align-items-center">
            <div className="col-6 col-md-2"><small className="text-muted d-block text-uppercase fw-bold">Order placed</small><strong>{orderDate ? orderDate.toLocaleDateString("en-IN") : "N/A"}</strong></div>
            <div className="col-6 col-md-2"><small className="text-muted d-block text-uppercase fw-bold">Total</small><strong>₹{Number(order.total || 0).toLocaleString("en-IN")}</strong></div>
            <div className="col-6 col-md-3"><small className="text-muted d-block text-uppercase fw-bold">Ship to</small>{order.address?.name || order.userName || "N/A"}</div>
            <div className="col-6 col-md-5 text-md-end"><small className="text-muted d-block">Order # {order.trackingId || String(orderId).slice(-8).toUpperCase()}</small><span className={"badge " + statusColor(status) + " px-3 py-2 rounded-pill mt-1"}>{status}</span></div>
          </div></div>
          <div className="card-body p-3 p-md-4">
            <div className="row g-2 mb-4">{STATUS_STEPS.map((step, index) => <div className="col" key={step}><div className={"small text-center " + (index <= statusIndex ? "fw-bold text-primary" : "text-muted")}><div className={"rounded-pill mb-1 " + (index <= statusIndex ? "bg-primary" : "bg-light")} style={{ height: "6px" }}></div>{step}</div></div>)}</div>
            {(order.cart || []).map((item, index) => {
              const key = orderId + "-" + (item.id || index); const state = reviewStates[key] || {}; const delivered = status.toLowerCase() === "delivered";
              return <div className="border rounded-3 p-3 mb-3" key={key}><div className="row g-3 align-items-center">
                <div className="col-4 col-md-2"><img src={item.img} alt={item.id || "Product"} className="img-fluid rounded-3" style={{ height: "110px", width: "100%", objectFit: "contain" }} /></div>
                <div className="col-8 col-md-6"><h6 className="fw-bold mb-1">{item.id || "Product"}</h6><div className="text-muted small">{item.brand || "ShopMaster Selection"}</div><div className="mt-2">₹{Number(item.cost || 0).toLocaleString("en-IN")} × {item.quantity || 1}</div></div>
                <div className="col-12 col-md-4 d-flex flex-wrap gap-2 justify-content-md-end"><button className="btn btn-sm btn-outline-primary" onClick={() => setExpandedOrder(expanded ? null : orderId)}><i className={"bi " + (expanded ? "bi-chevron-up" : "bi-eye")}></i> {expanded ? "Hide details" : "View details"}</button>{delivered ? <button className="btn btn-sm btn-outline-secondary" onClick={() => setReview(key, { showForm: !state.showForm })}><i className="bi bi-star"></i> Review</button> : <span className="small text-muted align-self-center">Review after delivery</span>}</div>
              </div>{state.showForm && delivered && <div className="mt-3 p-3 bg-light rounded-3"><div className="d-flex gap-1 mb-2">{[1,2,3,4,5].map((star) => <button key={star} type="button" className={"btn btn-sm " + (state.rating >= star ? "text-warning" : "text-muted")} onClick={() => setReview(key, { rating: star })}><i className="bi bi-star-fill"></i></button>)}</div><textarea className="form-control mb-2" rows="2" placeholder="Optional feedback" value={state.comment || ""} onChange={(e) => setReview(key, { comment: e.target.value })} /><button className="btn btn-dark btn-sm" onClick={() => submitItemReview(key, item, status, orderId)}>Publish Review</button></div>}{state.submitted && <small className="text-success d-block mt-2">✓ Review submitted: {state.rating}/5</small>}</div>;
            })}
            {expanded && <div className="row g-3 mt-1"><div className="col-md-6"><div className="p-3 bg-light rounded-3 h-100"><h6 className="fw-bold">Delivery address</h6><div>{order.address?.name || order.userName}</div><div>{order.address?.street}</div><div>{order.address?.city}, {order.address?.state} - {order.address?.pincode}</div><div>{order.address?.phone}</div></div></div><div className="col-md-6"><div className="p-3 bg-light rounded-3 h-100"><h6 className="fw-bold">Order summary</h6><div className="d-flex justify-content-between"><span>Subtotal</span><strong>₹{Number(order.subtotal || 0).toLocaleString("en-IN")}</strong></div><div className="d-flex justify-content-between"><span>Shipping</span><strong>₹{Number(order.shippingAmount || 0).toLocaleString("en-IN")}</strong></div><div className="d-flex justify-content-between border-top pt-2 mt-2"><span>Total</span><strong className="text-success">₹{Number(order.total || 0).toLocaleString("en-IN")}</strong></div></div></div></div>}
          </div>
        </article>;
      })}
  </div>;
};

export default OrderHistory;