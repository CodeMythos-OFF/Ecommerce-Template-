import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { getOrders, submitReview } from "./api";
import { getCurrentUser } from "./cartService";

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewStates, setReviewStates] = useState({});

  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.email) {
      const getOrderHistory = async () => {
        try {
          const data = await getOrders(50, user.email);
          setOrders(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Failed to fetch orders:", error);
        } finally {
          setLoading(false);
        }
      };
      getOrderHistory();
    } else {
      setLoading(false);
    }
  }, []);

  const toggleReviewForm = (itemId, canReview) => {
    if (!canReview) return;
    setReviewStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        showForm: !prev[itemId]?.showForm,
      },
    }));
  };

  const setReviewRating = (itemId, rating) => {
    setReviewStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        rating,
      },
    }));
  };

  const setReviewComment = (itemId, comment) => {
    setReviewStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        comment,
      },
    }));
  };

  const handleSubmitReview = async (itemId, item, status, orderId) => {
    const reviewState = reviewStates[itemId] || {};
    const user = getCurrentUser();

    if (status?.toLowerCase() !== "delivered") {
      Swal.fire({
        icon: "info",
        title: "Not available yet",
        text: "You can review this product once it has been delivered.",
      });
      return;
    }

    if (!reviewState.rating) {
      Swal.fire({
        icon: "warning",
        title: "Select a rating",
        text: "Please choose 1–5 stars before submitting.",
      });
      return;
    }

    if (!user?.email) {
      Swal.fire({
        icon: "error",
        title: "Sign in required",
        text: "Please sign in to submit reviews.",
      });
      return;
    }

    const productId = item.id || item.productId || itemId;

    try {
      await submitReview({
        productId,
        rating: reviewState.rating,
        comment: reviewState.comment,
        userEmail: user.email,
        orderId,
      });

      setReviewStates((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          submitted: true,
          showForm: false,
        },
      }));

      window.dispatchEvent(new CustomEvent("productsUpdated"));

      Swal.fire({
        icon: "success",
        title: "Review Published!",
        html: `
          <div class="text-center">
            <strong>${reviewState.rating}/5</strong> saved for <em>${item.id}</em><br>
            <small class="text-muted mt-2">Product ratings updated across the site!</small>
          </div>
        `,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Review submission failed:", error);
      Swal.fire({
        icon: "error",
        title: "Failed to Save",
        text: error.message || "Please try again.",
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "order placed":
        return "bg-primary";
      case "processing":
        return "bg-info text-dark";
      case "shipped":
        return "bg-warning text-dark";
      case "delivered":
        return "bg-success";
      default:
        return "bg-secondary";
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading your orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <a href="#dashboard" onClick={() => (window.location.hash = "#dashboard")}>
              Your Account
            </a>
          </li>
          <li className="breadcrumb-item active">Your Orders</li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0">Your Orders</h2>
        <div className="w-25">
          <input type="text" className="form-control" placeholder="Search orders..." />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card shadow-sm border-0 text-center p-5">
          <div className="card-body">
            <i className="bi bi-bag-x text-muted" style={{ fontSize: "4rem" }}></i>
            <h4 className="mt-3 font-amazon-bold">No orders found</h4>
            <p className="text-muted">Looks like you haven't placed any orders in the last 3 months.</p>
            <button className="btn btn-warning px-4 shadow-sm" onClick={() => (window.location.hash = "#p")}>
              Continue Shopping
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          {orders.map((order) => {
            const orderId = order._id || order.id || "N/A";
            const displayId =
              typeof orderId === "string" ? orderId.slice(-8).toUpperCase() : String(orderId);
            const status = order.status || "Order Placed";
            const canReview = status.toLowerCase() === "delivered";

            return (
              <div key={orderId} className="col-12 mb-4">
                <div className="card shadow-sm border rounded-3 overflow-hidden">
                  <div className="card-header border-bottom py-3 px-4" style={{ backgroundColor: "#F0F2f2" }}>
                    <div className="row align-items-center">
                      <div className="col-md-2">
                        <small className="text-secondary d-block text-uppercase small fw-bold">Order Placed</small>
                        <span className="text-muted">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString("en-IN")
                            : "N/A"}
                        </span>
                      </div>
                      <div className="col-md-2">
                        <small className="text-secondary d-block text-uppercase small fw-bold">Total</small>
                        <span className="text-muted fw-bold">₹{order.total || "0"}</span>
                      </div>
                      <div className="col-md-3">
                        <small className="text-secondary d-block text-uppercase small fw-bold">Ship To</small>
                        <div className="dropdown">
                          <span className="text-primary cursor-pointer dropdown-toggle" data-bs-toggle="dropdown">
                            {order.address?.name || order.userName}
                          </span>
                        </div>
                      </div>
                      <div className="col-md-5 text-md-end">
                        <div className="text-secondary small">Order # {displayId}</div>
                        <div className="mt-1">
                          <span className={`badge ${getStatusColor(status)} px-3 py-2 rounded-pill`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-body p-0">
                    <div className="list-group list-group-flush">
                      {(order.cart || []).map((item, idx) => {
                        const itemId = item.id || `${orderId}-${idx}`;
                        const reviewState = reviewStates[itemId] || {};

                        return (
                          <div key={itemId} className="list-group-item p-4 border-0">
                            <div className="row">
                              <div className="col-md-2 col-3">
                                <img
                                  src={item.img}
                                  alt={item.id}
                                  className="img-fluid rounded"
                                  style={{ maxHeight: "100px", width: "100%", objectFit: "contain" }}
                                  onError={(e) => (e.target.src = "https://via.placeholder.com/100")}
                                />
                              </div>
                              <div className="col-md-7 col-9">
                                <h6 className="text-primary mb-1 fw-bold">{item.id}</h6>
                                <p className="text-muted small mb-2">{item.brand || "ShopMaster Selection"}</p>
                              </div>
                              <div className="col-md-3 mt-3 mt-md-0 d-grid gap-2 h-100">
                                <button className="btn btn-sm btn-outline-secondary rounded-pill">Track Package</button>
                                <button className="btn btn-sm btn-outline-secondary rounded-pill">Return Items</button>
                                {canReview ? (
                                  <button className="btn btn-sm btn-outline-secondary rounded-pill" type="button" onClick={() => toggleReviewForm(itemId, canReview)}>
                                    Write a product review
                                  </button>
                                ) : (
                                  <span className="small text-muted">Review will unlock after delivery.</span>
                                )}
                              </div>
                            </div>
                            {canReview && reviewState.showForm && (
                              <div className="mt-3 px-2">
                                <div className="p-3 border rounded review-form">
                                  <div className="d-flex align-items-center gap-1 mb-2 review-stars">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        className={`review-star-btn ${reviewState.rating >= star ? "active" : ""}`}
                                        onClick={() => setReviewRating(itemId, star)}
                                      >
                                        <i className="bi bi-star-fill"></i>
                                      </button>
                                    ))}
                                    {reviewState.rating > 0 && <span className="small text-muted ms-2">{reviewState.rating}/5</span>}
                                  </div>
                                  <textarea
                                    className="form-control form-control-sm mb-2"
                                    rows="2"
                                    placeholder="Quick feedback (optional)"
                                    value={reviewState.comment || ""}
                                    onChange={(e) => setReviewComment(itemId, e.target.value)}
                                  />
                                  <button
                                    className="btn btn-dark btn-sm"
                                    onClick={() => handleSubmitReview(itemId, item, status, orderId)}
                                  >
                                    Publish Review
                                  </button>
                                </div>
                              </div>
                            )}
                            {reviewState.submitted && !reviewState.showForm && (
                              <div className="mt-3 px-2">
                                <small className="text-success">
                                  ✅ You rated this item {reviewState.rating}/5.
                                  {reviewState.comment ? ` Comment: "${reviewState.comment}".` : ""}
                                </small>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;