import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getProductReviews, submitReview, getOrders } from "./api";

const ProductReviews = ({ product, currentUser }) => {
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(Number(product?.averageRating || 0));
  const [reviewCount, setReviewCount] = useState(Number(product?.reviewCount || 0));
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState([]);

  const loadReviews = useCallback(async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const data = await getProductReviews(product.id);
      setReviews(data.reviews || []);
      setAverageRating(Number(data.averageRating || 0));
      setReviewCount(Number(data.reviewCount || 0));
    } catch (error) {
      Swal.fire({ icon: "error", title: "Couldn't load reviews", text: error.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [product?.id]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  useEffect(() => {
    if (!currentUser?.email || !product?.id) {
      setEligibleOrders([]);
      return;
    }
    getOrders(100, null, currentUser.email)
      .then((orders) => setEligibleOrders((orders || []).filter((order) =>
        String(order.status || '').toLowerCase() === 'delivered' &&
        (order.cart || []).some((item) => String(item.id) === String(product.id)) &&
        !((order.reviews || []).some((review) => String(review.productId) === String(product.id)))
      )))
      .catch(() => setEligibleOrders([]));
  }, [currentUser?.email, product?.id]);

  const distribution = useMemo(() => {
    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((review) => Number(review.rating) === star).length;
      return { star, count, percent: reviewCount ? Math.round((count / reviewCount) * 100) : 0 };
    });
  }, [reviews, reviewCount]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser?.email) {
      window.location.hash = "#login";
      return;
    }
    if (!rating) {
      Swal.fire({ icon: "warning", title: "Choose a rating", text: "Select between 1 and 5 stars." });
      return;
    }
    setSubmitting(true);
    try {
      const data = await submitReview({
        productId: product.id,
        orderId: document.getElementById("review-order-id")?.value
      , rating, comment });
      setAverageRating(Number(data.averageRating || 0));
      setReviewCount(Number(data.reviewCount || 0));
      setRating(0);
      setComment("");
      await loadReviews();
      Swal.fire({ icon: "success", title: "Review published", text: "Thanks for sharing your experience!", timer: 1600, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: "error", title: "Review not submitted", text: error.message || "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return <div className="container py-5"><div className="alert alert-warning">No product selected.</div></div>;

  return (
    <div className="container py-4">
      <button className="btn btn-link px-0 mb-3" onClick={() => window.history.back()}>
        <i className="bi bi-arrow-left"></i> Back to product
      </button>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
        <div className="row g-0 align-items-center">
          <div className="col-md-3 p-4 text-center">
            <img src={product.img} alt={product.id} className="img-fluid rounded-3" style={{ maxHeight: 220, objectFit: "contain" }} />
          </div>
          <div className="col-md-9 p-4">
            <div className="text-muted small text-uppercase">{product.category || "Product"}</div>
            <h1 className="fw-bold mb-2">{product.id}</h1>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="fs-3 text-warning">{"★".repeat(Math.floor(averageRating))}{"☆".repeat(5 - Math.floor(averageRating))}</span>
              <strong className="fs-4">{averageRating ? averageRating.toFixed(1) : "No rating"}</strong>
              <span className="text-muted">({reviewCount} review{reviewCount === 1 ? "" : "s"})</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div><h3 className="fw-bold mb-1">Customer reviews</h3><p className="text-muted mb-0">Verified purchases from ShopMaster customers.</p></div>
                <button className="btn btn-outline-primary btn-sm" onClick={loadReviews} disabled={loading}><i className="bi bi-arrow-clockwise"></i> Refresh</button>
              </div>

              {loading ? <div className="text-center py-5"><div className="spinner-border text-primary"></div></div> :
                reviews.length === 0 ? <div className="text-center py-5"><i className="bi bi-chat-square-heart text-muted" style={{ fontSize: "3rem" }}></i><h5 className="mt-3">No reviews yet</h5><p className="text-muted">Be the first customer to review this product.</p></div> :
                <div className="d-grid gap-3">{reviews.map((review) => (
                  <article key={review._id} className="border rounded-3 p-3">
                    <div className="d-flex justify-content-between gap-2">
                      <div><strong>{review.userName || "ShopMaster customer"}</strong><div className="text-warning">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div></div>
                      <small className="text-muted">{new Date(review.createdAt).toLocaleDateString("en-IN")}</small>
                    </div>
                    {review.verifiedPurchase && <span className="badge bg-success-subtle text-success mt-2"><i className="bi bi-patch-check-fill"></i> Verified purchase</span>}
                    {review.comment && <p className="mb-0 mt-2">{review.comment}</p>}
                  </article>
                ))}</div>
              }
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body p-4">
              <h5 className="fw-bold mb-3">Rating breakdown</h5>
              {distribution.map(({ star, count, percent }) => (
                <div className="d-flex align-items-center gap-2 mb-2" key={star}>
                  <span className="small" style={{ width: 30 }}>{star} ★</span>
                  <div className="progress flex-grow-1" style={{ height: 8 }}><div className="progress-bar" style={{ width: percent + "%" }}></div></div>
                  <small className="text-muted" style={{ width: 25 }}>{count}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <h5 className="fw-bold">Write a review</h5>
              <p className="text-muted small">Reviews are available only after a delivered purchase.</p>
              {!currentUser ? <button className="btn btn-primary w-100" onClick={() => window.location.hash = "#login"}>Sign in to review</button> :
                <form onSubmit={handleSubmit}>
                  <label className="form-label fw-semibold">Your rating</label>
                  <div className="d-flex gap-1 mb-3">
                    {[1,2,3,4,5].map((star) => <button type="button" key={star} className={"btn btn-sm " + (rating >= star ? "text-warning" : "text-muted")} onClick={() => setRating(star)}><i className="bi bi-star-fill fs-4"></i></button>)}
                  </div>
                  <label className="form-label fw-semibold">Delivered order</label>
                  {eligibleOrders.length > 0 ? (
                    <select id="review-order-id" className="form-select mb-3" required>
                      <option value="">Select an order</option>
                      {eligibleOrders.map((order) => <option key={order._id} value={order._id}>{order.trackingId || order._id} — {new Date(order.createdAt).toLocaleDateString("en-IN")}</option>)}
                    </select>
                  ) : (
                    <div className="alert alert-light border small">No eligible delivered order found for this product. You can review it after your order is delivered.</div>
                  )}

                  <label className="form-label fw-semibold">Comment</label>
                  <textarea className="form-control mb-3" rows="4" maxLength="1000" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell other customers about your experience..." />
                  <button className="btn btn-primary w-100" disabled={submitting || eligibleOrders.length === 0}>{submitting ? "Publishing..." : "Publish review"}</button>
                </form>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductReviews;
