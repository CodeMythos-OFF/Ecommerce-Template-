import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getWishlist, removeFromWishlist } from "./wishlistService";

const WishlistCard = ({ product, onShowDetails, onAddCart, onRemove }) => {
  const rating = Number(product.averageRating || product.rating || 0);
  const brand = product.brand || product.sellerBusinessName || product.sellerName || "";

  return (
    <article className="card border-0 shadow-sm h-100 overflow-hidden">
      <div className="position-relative">
        <img
          src={product.img}
          alt={product.id}
          className="card-img-top"
          style={{ height: 230, objectFit: "cover", cursor: "pointer" }}
          loading="lazy"
          onClick={() => onShowDetails(product)}
        />
        <button
          type="button"
          className="btn btn-light rounded-circle shadow-sm position-absolute top-0 end-0 m-3"
          aria-label={`Remove ${product.id} from wishlist`}
          onClick={() => onRemove(product)}
        >
          <i className="bi bi-heart-fill text-danger"></i>
        </button>
      </div>
      <div className="card-body d-flex flex-column p-4">
        {brand && <div className="small text-uppercase text-muted fw-semibold mb-1">{brand}</div>}
        <h5 className="fw-bold mb-2" style={{ cursor: "pointer" }} onClick={() => onShowDetails(product)}>
          {product.id}
        </h5>
        {rating > 0 && (
          <div className="mb-2">
            <span className="text-warning">{"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}</span>
            <small className="text-muted ms-1">{rating.toFixed(1)}</small>
          </div>
        )}
        <div className="fw-bold fs-5 mb-3">₹{product.cost}</div>
        <div className="mt-auto d-grid gap-2">
          <button type="button" className="btn btn-primary" onClick={() => onAddCart(product)}>
            <i className="bi bi-cart-plus me-1"></i> Add to Cart
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => onShowDetails(product)}>
            View Product
          </button>
        </div>
      </div>
    </article>
  );
};

const Wishlist = ({ currentUser, products = [], onShowDetails, onAddCart }) => {
  const [items, setItems] = useState([]);

  const syncWishlist = () => {
    setItems(getWishlist(currentUser?.email));
  };

  useEffect(() => {
    syncWishlist();
    const handleChange = () => syncWishlist();
    window.addEventListener("wishlistChanged", handleChange);
    return () => window.removeEventListener("wishlistChanged", handleChange);
  }, [currentUser?.email]);

  const resolvedItems = useMemo(() => {
    const catalog = new Map((products || []).map((product) => [String(product.id), product]));
    return items.map((saved) => catalog.get(String(saved.id)) || saved);
  }, [items, products]);

  const handleRemove = (product) => {
    const updated = removeFromWishlist(currentUser.email, product.id);
    setItems(updated);
    Swal.fire({
      icon: "success",
      title: "Removed from Wishlist",
      text: product.id,
      timer: 1200,
      showConfirmButton: false,
      toast: true,
      position: "top-end",
    });
  };

  if (!currentUser) {
    return (
      <div className="container py-5">
        <div className="card border-0 shadow-sm rounded-4 text-center p-5">
          <div className="display-4 text-danger mb-3"><i className="bi bi-heart"></i></div>
          <h2 className="fw-bold">Your Wishlist</h2>
          <p className="text-muted mb-4">Sign in to save products you want to come back to later.</p>
          <button className="btn btn-primary px-4" onClick={() => { window.location.hash = "#login"; }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <div className="text-danger fw-semibold small text-uppercase">Saved for later</div>
          <h1 className="fw-bold mb-1">My Wishlist</h1>
          <p className="text-muted mb-0">{resolvedItems.length} saved product{resolvedItems.length === 1 ? "" : "s"}</p>
        </div>
        {resolvedItems.length > 0 && (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={() => {
              resolvedItems.forEach((product) => removeFromWishlist(currentUser.email, product.id));
              setItems([]);
            }}
          >
            <i className="bi bi-trash3 me-1"></i> Clear Wishlist
          </button>
        )}
      </div>

      {resolvedItems.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 text-center p-5">
          <div className="display-3 text-danger mb-3"><i className="bi bi-heart"></i></div>
          <h3 className="fw-bold">Your wishlist is empty</h3>
          <p className="text-muted mb-4">Tap the heart on any product to save it here.</p>
          <button type="button" className="btn btn-primary px-4" onClick={() => { window.location.hash = "#p"; }}>
            Browse Products
          </button>
        </div>
      ) : (
        <div className="row g-4">
          {resolvedItems.map((product) => (
            <div className="col-12 col-sm-6 col-lg-4 col-xl-3" key={product.id}>
              <WishlistCard
                product={product}
                onShowDetails={onShowDetails}
                onAddCart={onAddCart}
                onRemove={handleRemove}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
