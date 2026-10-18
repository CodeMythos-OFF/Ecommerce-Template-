import React, { useEffect, useState } from "react";
import { getProducts } from "./api";

const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000/api" : "/api";

export default function SellerStorefront({ email, onShowDetails }) {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/storefront/${encodeURIComponent(email || "")}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load this store");
        if (!cancelled) {
          setStore(data.seller);
          setProducts(Array.isArray(data.products) ? data.products : []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load this store");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (email) load();
    else { setError("Choose a seller to view their store"); setLoading(false); }
    return () => { cancelled = true; };
  }, [email]);

  if (loading) return <div className="container py-5 text-center"><div className="spinner-border" role="status" /><p className="mt-3">Loading seller storefront…</p></div>;
  if (error) return <div className="container py-5"><div className="alert alert-warning">{error}</div></div>;

  return (
    <main className="container py-4">
      <section className="rounded-4 p-4 p-md-5 mb-4 text-white" style={{ background: "linear-gradient(125deg,#10243d,#245a79)" }}>
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div><span className="badge bg-success mb-2">Verified seller</span><h1 className="h2 fw-bold mb-2">{store?.businessName}</h1><p className="mb-0 text-white-50">Seller: {store?.name}</p></div>
          <div className="text-md-end"><div className="fs-4 fw-bold">★ {store?.averageRating ? Number(store.averageRating).toFixed(1) : "New"}</div><div className="small text-white-50">{store?.reviewCount || 0} product review{store?.reviewCount === 1 ? "" : "s"}</div><div className="small mt-1">{products.length} active product{products.length === 1 ? "" : "s"}</div></div>
        </div>
      </section>
      <div className="d-flex align-items-center justify-content-between mb-3"><h2 className="h4 mb-0">Products from this store</h2><span className="text-muted small">Cash on Delivery</span></div>
      {!products.length ? <div className="alert alert-info">This seller has no active products yet.</div> : <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
        {products.map(product => <div className="col" key={product._id || product.id}>
          <button type="button" className="card h-100 shadow-sm text-start w-100 p-0 border-0" onClick={() => onShowDetails(product)} style={{ overflow: "hidden" }}>
            <img src={product.img} alt={product.id} loading="lazy" style={{ width: "100%", height: 210, objectFit: "cover" }} />
            <div className="card-body"><div className="small text-muted">{product.category}</div><h3 className="h6 fw-bold mt-1">{product.id}</h3><div className="fw-bold text-success">₹{Number(product.cost || 0).toLocaleString("en-IN")}</div><div className="small text-muted mt-2">★ {Number(product.averageRating || 0).toFixed(1)} · {product.reviewCount || 0} reviews</div></div>
          </button>
        </div>)}
      </div>}
    </main>
  );
}
