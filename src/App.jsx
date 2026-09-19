import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Navigation from "./Navigation";
import Auth from "./Auth";
import AdminPanel from "./AdminPanel";
import OrderHistory from "./OrderHistory";
import "./App.css";
import { getCart, saveCart, addToCart, removeFromCart, getCurrentUser } from "./cartService";
import { trackView, createOrder, getProducts } from "./api";
import { getAddresses, addAddress, deleteAddress, getLocationAddress } from "./addressService";
import Swal from "sweetalert2";

const ADMIN_EMAIL = "rohan.sivaa@gmail.com";

const ROUTES = {
  "#dashboard": "dashboard",
  "#orderhistory": "orderhistory",
  "#admin": "admin",
  "#Cart": "Cart",
  "#home": "home",
  "#p": "p",
  "#pdetails": "pdetails",
  "#login": "login",
};

const resolveRoute = (hash) => ROUTES[hash] || "home";

const getBrandName = (product) => {
  return (product.brand || product.sellerBusinessName || product.sellerName || "").trim();
};

const BootScreen = () => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "linear-gradient(135deg, #0d233d 0%, #162e54 65%, #1a4a80 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "24px",
        padding: "3rem",
        maxWidth: "480px",
        width: "100%",
        boxShadow: "0 30px 60px rgba(6, 11, 25, 0.55)",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.25rem",
          fontWeight: 700,
          letterSpacing: "0.1rem",
          marginBottom: "1rem",
          color: "#ffd54f",
        }}
      >
        SM
      </div>
      <h1
        style={{
          color: "white",
          fontSize: "2.4rem",
          lineHeight: "1.1",
          marginBottom: "0.5rem",
        }}
      >
        ShopMaster
      </h1>
      <p
        style={{
          color: "rgba(255, 255, 255, 0.8)",
          marginBottom: "2rem",
          fontSize: "1rem",
        }}
      >
        Curated products, real reviews, zero compromise. Preparing a premium shopping experience just for you.
      </p>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ height: "6px", background: "rgba(255, 255, 255, 0.2)", borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              width: "68%",
              height: "100%",
              background: "linear-gradient(90deg, #ffd54f, #ff8a65)",
              animation: "pulseProgress 2s ease-in-out infinite",
            }}
          ></div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.85rem",
          color: "rgba(255,255,255,0.65)",
        }}
      >
        <div>
          <strong style={{ color: "#fff" }}>Catalog</strong>
          <div>Syncing live inventory</div>
        </div>
        <div>
          <strong style={{ color: "#fff" }}>Reviews</strong>
          <div>Fetching verified ratings</div>
        </div>
      </div>
      <style>{`
        @keyframes pulseProgress {
          0% { transform: scaleX(0.82); opacity: 0.8; }
          50% { transform: scaleX(0.92); opacity: 1; }
          100% { transform: scaleX(0.82); opacity: 0.8; }
        }
      `}</style>
    </div>
  </div>
);

const ProductCard = React.memo(({ product, quantity, onShowDetails, onAddCart, onRemoveCart, variant = "grid" }) => {
  const brandText = getBrandName(product);
  const shippingText = product.shippingEtaText || product.shippingText || product.shipping || "";
  const mrp = product.mrp;
  const showMrp = typeof mrp === "number" && mrp > product.cost;
  const rating = product.averageRating || product.rating || 0;

  return (
    <div className={variant === "slider" ? "product-slide" : "col"}>
      <div
        className={`card h-100 shadow-sm ${variant === "slider" ? "product-card-slider" : ""}`}
        style={{ cursor: "pointer" }}
        onClick={() => onShowDetails(product)}
      >
        <img
          src={product.img}
          className="card-img-top"
          alt={product.id}
          style={{ height: "250px", objectFit: "cover" }}
          loading="lazy"
        />
        <div className="card-body d-flex flex-column">
          {brandText ? <div className="product-brand">{brandText}</div> : null}
          <h5 className="card-title">{product.id}</h5>
          {rating > 0 && (
            <div className="product-rating mb-2">
              <span className="text-warning">
                {"★".repeat(Math.floor(rating))}
                {"☆".repeat(5 - Math.floor(rating))}
              </span>
              <small className="text-muted ms-1">{rating.toFixed(1)}</small>
            </div>
          )}
          <div className="product-price-row">
            <span className="product-price">₹{product.cost}</span>
            <small className="text-muted ms-1" style={{ fontSize: '0.75rem', fontWeight: 300 }}>+18% GST</small>
            {showMrp ? <span className="product-mrp">₹{mrp}</span> : null}
          </div>
          {shippingText ? <div className="product-shipping">{shippingText}</div> : null}
          <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
            {quantity === 0 ? (
              <button className="btn btn-primary w-100" onClick={() => onAddCart(product)}>
                Add To Cart
              </button>
            ) : (
              <div className="btn-group w-100" role="group">
                <button className="btn btn-outline-danger" onClick={() => onRemoveCart(product)}>
                  -
                </button>
                <button className="btn btn-outline-secondary" disabled>
                  {quantity}
                </button>
                <button className="btn btn-outline-success" onClick={() => onAddCart(product)}>
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = "ProductCard";

const ProductSlider = React.memo(({ title, products, cartItems, onShowDetails, onAddCart, onRemoveCart, onViewAll }) => {
  const trackRef = useRef(null);

  const scrollByAmount = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(260, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="category-section">
      <div className="category-header">
        <h3 className="category-title">{title}</h3>
        <button className="btn btn-link category-viewall" onClick={onViewAll} type="button">
          View all
        </button>
      </div>
      <div className="slider-wrap">
        <button className="slider-btn slider-btn-left" type="button" aria-label="Previous" onClick={() => scrollByAmount(-1)}>
          ‹
        </button>
        <div className="slider-track" ref={trackRef}>
          {products.map((product) => {
            const quantity = cartItems.filter((item) => item.id === product.id).length;
            return (
              <ProductCard
                key={`${title}-${product.id}`}
                product={product}
                quantity={quantity}
                onShowDetails={onShowDetails}
                onAddCart={onAddCart}
                onRemoveCart={onRemoveCart}
                variant="slider"
              />
            );
          })}
        </div>
        <button className="slider-btn slider-btn-right" type="button" aria-label="Next" onClick={() => scrollByAmount(1)}>
          ›
        </button>
      </div>
    </section>
  );
});

ProductSlider.displayName = "ProductSlider";

function App() {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [activePage, setActivePage] = useState(resolveRoute(window.location.hash));
  const [currentUser, setCurrentUser] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [tempMinPrice, setTempMinPrice] = useState("");
  const [tempMaxPrice, setTempMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const productsData = await getProducts();
      setProducts(productsData);
      setProductsLoading(false);
    } catch (error) {
      console.error("Error loading products:", error);
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsAdmin(user.email === ADMIN_EMAIL);
      const savedCart = getCart(user.email);
      setCartItems(savedCart);
    }
    setAuthChecked(true);
    loadProducts();
    trackView();
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3600);
    const handleProductsUpdated = () => {
      loadProducts();
    };
    window.addEventListener("productsUpdated", handleProductsUpdated);
    return () => {
      clearTimeout(loadingTimer);
      window.removeEventListener("productsUpdated", handleProductsUpdated);
    };
  }, [loadProducts]);

  useEffect(() => {
    const handleUserChange = () => {
      const user = getCurrentUser();
      setCurrentUser(user);
      setIsAdmin(user ? user.email === ADMIN_EMAIL : false);
      if (user) {
        setCartItems(getCart(user.email));
      } else {
        setCartItems([]);
      }
    };
    window.addEventListener("userChanged", handleUserChange);
    return () => window.removeEventListener("userChanged", handleUserChange);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    const enforceRoute = () => {
      const nextPage = resolveRoute(window.location.hash);
      if (nextPage === "admin" && !isAdmin) {
        Swal.fire({
          icon: "error",
          title: "Access Denied",
          text: "Admin area requires a privileged account.",
        });
        window.location.hash = "#home";
        setActivePage("home");
        return;
      }
      setActivePage(nextPage);
    };
    enforceRoute();
    window.addEventListener("hashchange", enforceRoute);
    return () => window.removeEventListener("hashchange", enforceRoute);
  }, [authChecked, isAdmin]);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((p) => (p.category || "").trim()).filter(Boolean))),
    [products]
  );

  const brands = useMemo(() => {
    const brandSet = new Set();
    products.forEach((product) => {
      const brandName = getBrandName(product);
      if (brandName) brandSet.add(brandName);
    });
    return Array.from(brandSet);
  }, [products]);

  const productMaxPrice = useMemo(() => {
    if (products.length === 0) return 100000;
    return Math.max(...products.map((p) => p.cost));
  }, [products]);

  const handlePageChange = useCallback(
    (pageId) => {
      if (pageId === "admin" && !isAdmin) {
        Swal.fire({
          icon: "error",
          title: "Admin access only",
          text: "Sign in using the registered admin account to continue.",
        });
        window.location.hash = "#home";
        setActivePage("home");
        return;
      }
      setActivePage(pageId);
      window.location.hash = `#${pageId}`;
      if (pageId !== "pdetails") {
        setSelectedProduct(null);
      }
    },
    [isAdmin]
  );

  const toggleCategory = useCallback((category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const toggleBrand = useCallback((brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  }, []);

  const applyPriceFilter = useCallback(() => {
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
  }, [tempMinPrice, tempMaxPrice]);

  const clearAllFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setMinRating(0);
    setMinPrice("");
    setMaxPrice("");
    setTempMinPrice("");
    setTempMaxPrice("");
    setSearch("");
    setSortBy("featured");
  }, []);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      const matchesSearch = product.id.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(product.category);
      const productBrand = getBrandName(product);
      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(productBrand);
      const prodRating = product.averageRating || product.rating || 0;
      const matchesRating = prodRating >= minRating;
      const min = minPrice === "" ? 0 : parseFloat(minPrice);
      const max = maxPrice === "" ? Infinity : parseFloat(maxPrice);
      const matchesPrice = product.cost >= min && product.cost <= max;
      return matchesSearch && matchesCategory && matchesBrand && matchesPrice && matchesRating;
    });

    switch (sortBy) {
      case "price-asc":
        filtered.sort((a, b) => a.cost - b.cost);
        break;
      case "price-desc":
        filtered.sort((a, b) => b.cost - a.cost);
        break;
      case "newest":
        filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case "rating":
        filtered.sort(
          (a, b) => (b.averageRating || b.rating || 0) - (a.averageRating || a.rating || 0)
        );
        break;
      default:
        break;
    }
    return filtered;
  }, [
    products,
    search,
    selectedCategories,
    selectedBrands,
    minRating,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  const showProductDetails = useCallback(
    (product) => {
      setSelectedProduct(product);
      handlePageChange("pdetails");
    },
    [handlePageChange]
  );

  const handleAddToCart = useCallback(
    (product) => {
      if (!currentUser) {
        Swal.fire({
          icon: "warning",
          title: "Please Sign In",
          text: "You need to sign in to add items to your cart",
          confirmButtonText: "Sign In",
        }).then((result) => {
          if (result.isConfirmed) {
            handlePageChange("login");
          }
        });
        return;
      }
      const updatedCart = addToCart(currentUser.email, product, cartItems);
      setCartItems(updatedCart);
      Swal.fire({
        icon: "success",
        title: "Added to Cart!",
        text: `${product.id} added to your cart`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: "top-end",
      });
    },
    [currentUser, cartItems, handlePageChange]
  );

  const handleRemoveFromCart = useCallback(
    (product) => {
      if (!currentUser) return;
      const updatedCart = removeFromCart(currentUser.email, product, cartItems);
      setCartItems(updatedCart);
    },
    [currentUser, cartItems]
  );

  const { groupedCart, subtotal, gstAmount, totalPrice } = useMemo(() => {
    const grouped = cartItems.reduce((acc, item) => {
      const existingItem = acc.find((i) => i.id === item.id);
      if (existingItem) {
        existingItem.quantity++;
      } else {
        acc.push({ ...item, quantity: 1 });
      }
      return acc;
    }, []);
    const sub = grouped.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const gst = Math.round(sub * 0.18);
    const total = sub + gst;
    return { groupedCart: grouped, subtotal: sub, gstAmount: gst, totalPrice: total };
  }, [cartItems]);

  const handleCheckout = useCallback(async () => {
    if (!currentUser || cartItems.length === 0) return;
    const savedAddresses = getAddresses(currentUser.email);
    const { value: formValues } = await Swal.fire({
      title: "Delivery Address",
      html: `
        <div style="text-align: left;">
          ${savedAddresses.length > 0 ? `
            <div class="mb-3">
              <label class="form-label fw-bold">Select Saved Address</label>
              <select id="swal-address-select" class="form-select">
                <option value="">-- Or Enter New Address --</option>
                ${savedAddresses
                  .map((addr) => `<option value="${addr.id}">${addr.name || "Address"} - ${addr.street}, ${addr.city}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="text-center my-2">OR</div>
          ` : ""}
          <button id="use-location-btn" class="btn btn-info w-100 mb-3">
            <i class="bi bi-geo-alt-fill"></i> Use My Current Location
          </button>
          <div class="mb-3">
            <label class="form-label fw-bold">Full Name *</label>
            <input id="swal-name" class="form-control" placeholder="Your Name" required>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Phone Number *</label>
            <input id="swal-phone" class="form-control" type="tel" placeholder="10-digit number" maxlength="10" required>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Street/House No *</label>
            <input id="swal-street" class="form-control" placeholder="Street address" required>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label fw-bold">City *</label>
              <input id="swal-city" class="form-control" placeholder="City" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label fw-bold">State *</label>
              <input id="swal-state" class="form-control" placeholder="State" required>
            </div>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label fw-bold">PIN Code *</label>
              <input id="swal-pincode" class="form-control" placeholder="6-digit PIN" maxlength="6" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label fw-bold">Country</label>
              <input id="swal-country" class="form-control" value="India" required>
            </div>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="swal-save-address">
            <label class="form-check-label" for="swal-save-address">
              Save this address for future orders
            </label>
          </div>
        </div>
      `,
      width: "600px",
      showCancelButton: true,
      confirmButtonText: "Place Order",
      cancelButtonText: "Cancel",
      focusConfirm: false,
      didOpen: () => {
        const addressSelect = document.getElementById("swal-address-select");
        if (addressSelect) {
          addressSelect.addEventListener("change", (e) => {
            const selectedId = parseInt(e.target.value);
            const selected = savedAddresses.find((a) => a.id === selectedId);
            if (selected) {
              document.getElementById("swal-name").value = selected.name || "";
              document.getElementById("swal-phone").value = selected.phone || "";
              document.getElementById("swal-street").value = selected.street || "";
              document.getElementById("swal-city").value = selected.city || "";
              document.getElementById("swal-state").value = selected.state || "";
              document.getElementById("swal-pincode").value = selected.pincode || "";
              document.getElementById("swal-country").value = selected.country || "India";
            }
          });
        }
        const locationBtn = document.getElementById("use-location-btn");
        locationBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          locationBtn.disabled = true;
          locationBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Getting location...';
          try {
            const locationAddress = await getLocationAddress();
            document.getElementById("swal-street").value = locationAddress.street || "";
            document.getElementById("swal-city").value = locationAddress.city || "";
            document.getElementById("swal-state").value = locationAddress.state || "";
            document.getElementById("swal-pincode").value = locationAddress.pincode || "";
            document.getElementById("swal-country").value = locationAddress.country || "India";
            locationBtn.innerHTML = '<i class="bi bi-check-circle"></i> Location Loaded!';
            locationBtn.classList.remove("btn-info");
            locationBtn.classList.add("btn-success");
          } catch (error) {
            Swal.showValidationMessage(error.message);
            locationBtn.disabled = false;
            locationBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Use My Current Location';
          }
        });
      },
      preConfirm: () => {
        const name = document.getElementById("swal-name").value;
        const phone = document.getElementById("swal-phone").value;
        const street = document.getElementById("swal-street").value;
        const city = document.getElementById("swal-city").value;
        const state = document.getElementById("swal-state").value;
        const pincode = document.getElementById("swal-pincode").value;
        const country = document.getElementById("swal-country").value;
        const saveAddress = document.getElementById("swal-save-address").checked;
        if (!name || !phone || !street || !city || !state || !pincode) {
          Swal.showValidationMessage("Please fill all required fields");
          return false;
        }
        if (phone.length !== 10 || !/^\d+$/.test(phone)) {
          Swal.showValidationMessage("Please enter a valid 10-digit phone number");
          return false;
        }
        if (pincode.length !== 6 || !/^\d+$/.test(pincode)) {
          Swal.showValidationMessage("Please enter a valid 6-digit PIN code");
          return false;
        }
        return { name, phone, street, city, state, pincode, country, saveAddress };
      },
    });

    if (!formValues) return;
    if (formValues.saveAddress) {
      addAddress(currentUser.email, formValues);
    }
    try {
      const orderData = {
        user: currentUser.email,
        userName: currentUser.name,
        items: cartItems.length,
        subtotal: subtotal,
        gstAmount: gstAmount,
        total: totalPrice,
        products: groupedCart.map((item) => ({
          name: item.id,
          quantity: item.quantity,
          price: item.cost,
          sellerEmail: item.sellerEmail || "rohan.sivaa@gmail.com",
          sellerName: item.sellerName || "Rohan",
        })),
        cart: groupedCart.map((item) => ({
          id: item.id,
          cost: item.cost,
          img: item.img,
          brand: item.brand || item.sellerBusinessName || item.sellerName,
          category: item.category,
          quantity: item.quantity,
        })),
        address: {
          name: formValues.name,
          phone: formValues.phone,
          street: formValues.street,
          city: formValues.city,
          state: formValues.state,
          pincode: formValues.pincode,
          country: formValues.country,
        },
      };

      await createOrder(orderData);

      Swal.fire({
        icon: "success",
        title: "Order Placed!",
        html: `
          <p>Your order of <strong>₹${totalPrice}</strong> has been placed successfully!</p>
          <div class="text-start mt-3 p-3" style="background: #f8f9fa; border-radius: 8px;">
            <small class="text-muted d-block mb-1"><strong>Checkout Summary:</strong></small>
            <div class="d-flex justify-content-between small"><span>Subtotal:</span><span>₹${subtotal}</span></div>
            <div class="d-flex justify-content-between small"><span>GST (18%):</span><span>₹${gstAmount}</span></div>
            <div class="d-flex justify-content-between fw-bold border-top mt-1 pt-1"><span>Total:</span><span>₹${totalPrice}</span></div>
            <small class="text-muted d-block mt-2"><strong>Delivery Address:</strong></small>
            <small>${formValues.name}</small><br>
            <small>${formValues.phone}</small><br>
            <small>${formValues.street}, ${formValues.city}</small><br>
            <small>${formValues.state} - ${formValues.pincode}</small>
          </div>
          <small class="text-muted d-block mt-3">☁️ Order saved to database & email sent!</small>
        `,
        confirmButtonText: "OK",
      }).then(() => {
        setCartItems([]);
        saveCart(currentUser.email, []);
        handlePageChange("home");
      });
    } catch (error) {
      console.error("Error saving order:", error);
      Swal.fire({
        icon: "error",
        title: "Order Failed",
        text: error.message || "Failed to place order. Please try again.",
        confirmButtonText: "OK",
      });
    }
  }, [currentUser, cartItems, totalPrice, subtotal, gstAmount, groupedCart, handlePageChange]);

  const handleSignInSuccess = useCallback(
    (userData) => {
      setCurrentUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      setCartItems(getCart(userData.email));
      Swal.fire({
        icon: "success",
        title: "Welcome!",
        text: `Successfully signed in as ${userData.name}`,
        timer: 2000,
        showConfirmButton: false,
      });
    },
    []
  );

  const handleSignInFailure = useCallback(() => {
    Swal.fire({
      icon: "error",
      title: "Sign In Failed",
      text: "There was an error signing in. Please try again.",
    });
  }, []);

  const handleSignOut = useCallback(() => {
    Swal.fire({
      title: "Sign Out?",
      text: "Are you sure you want to sign out?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, sign out",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        sessionStorage.removeItem("authUser");
        sessionStorage.removeItem("authToken");
        setCurrentUser(null);
        setCartItems([]);
        setIsAdmin(false);
        window.dispatchEvent(new Event("userChanged"));
        Swal.fire({
          icon: "success",
          title: "Signed Out",
          text: "You have been signed out successfully",
          timer: 1500,
          showConfirmButton: false,
        });
        setTimeout(() => handlePageChange("home"), 1500);
      }
    });
  }, [handlePageChange]);

  const sectionCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => (p.category || "").trim()).filter(Boolean)));
    return cats.slice(0, 6);
  }, [products]);

  const getProductsForCategory = useCallback(
    (category) => {
      const items = products.filter((p) => p.category === category).slice(0).reverse().slice(0, 12);
      return items;
    },
    [products]
  );

  if (isLoading) {
    return <BootScreen />;
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    minRating > 0 ||
    minPrice !== "" ||
    maxPrice !== "" ||
    search !== "";

  return (
    <>
      <Navigation
        activePage={activePage}
        onPageChange={handlePageChange}
        cartCount={cartItems.length}
        isAdmin={isAdmin}
        search={search}
        setSearch={setSearch}
      />

      <div id="admin" className={`page ${activePage === "admin" ? "active" : ""}`}>
        {isAdmin ? (
          <AdminPanel />
        ) : (
          <div className="container py-5">
            <div className="alert alert-danger text-center">
              Admin access is restricted. Sign in with a privileged account to continue.
            </div>
          </div>
        )}
      </div>

      <div id="p" className={`page ${activePage === "p" ? "active" : ""}`}>
        <div className="container my-4">
          <h2 className="text-center mb-4">Products</h2>
          <div className="d-flex justify-content-center mb-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: "600px" }}
            />
          </div>
          <button className="mobile-filter-toggle" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
            <i className="bi bi-funnel"></i> Filters{" "}
            {hasActiveFilters &&
              `(${selectedCategories.length +
                selectedBrands.length +
                (minRating > 0 ? 1 : 0) +
                (minPrice || maxPrice ? 1 : 0)})`}
          </button>
          <div className={`filter-overlay ${mobileFiltersOpen ? "active" : ""}`} onClick={() => setMobileFiltersOpen(false)}></div>
          <div className="products-container">
            <aside className={`filter-sidebar ${mobileFiltersOpen ? "mobile-open" : ""}`}>
              {/* Filter Modal Header */}
              <div className="filter-modal-header">
                <h4 className="filter-modal-title">🎯 Filters</h4>
                <button className="filter-close-btn" onClick={() => setMobileFiltersOpen(false)}>✕</button>
              </div>
              
              {/* Filter Content Scrollable Area */}
              <div className="filter-content-scroll">
              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={clearAllFilters}>
                  <i className="bi bi-x-circle"></i> Clear All Filters
                </button>
              )}
              {categories.length > 0 && (
                <div className="filter-section">
                  <h3 className="filter-section-title">Category</h3>
                  {categories.map((category) => (
                    <div key={category} className="filter-option">
                      <input
                        type="checkbox"
                        id={`cat-${category}`}
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <label htmlFor={`cat-${category}`}>{category}</label>
                    </div>
                  ))}
                </div>
              )}
              {brands.length > 0 && (
                <div className="filter-section">
                  <h3 className="filter-section-title">Brand</h3>
                  {brands.map((brand) => (
                    <div key={brand} className="filter-option">
                      <input
                        type="checkbox"
                        id={`brand-${brand}`}
                        checked={selectedBrands.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                      />
                      <label htmlFor={`brand-${brand}`}>{brand}</label>
                    </div>
                  ))}
                </div>
              )}
              <div className="filter-section">
                <h3 className="filter-section-title">Customer Rating</h3>
                {[4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="filter-option">
                    <input
                      type="radio"
                      name="rating"
                      id={`rating-${rating}`}
                      checked={minRating === rating}
                      onChange={() => setMinRating(rating)}
                    />
                    <label htmlFor={`rating-${rating}`}>
                      <span className="text-warning">
                        {"★".repeat(rating)}
                        {"☆".repeat(5 - rating)}
                      </span>
                      <span className="ms-1">& Up</span>
                    </label>
                  </div>
                ))}
                {minRating > 0 && (
                  <div className="filter-option">
                    <input
                      type="radio"
                      name="rating"
                      id="rating-all"
                      checked={minRating === 0}
                      onChange={() => setMinRating(0)}
                    />
                    <label htmlFor="rating-all">All Ratings</label>
                  </div>
                )}
              </div>
              <div className="filter-section">
                <h3 className="filter-section-title">Price</h3>
                <div className="price-input-group">
                  <input
                    type="number"
                    className="price-input"
                    placeholder="Min"
                    value={tempMinPrice}
                    onChange={(e) => setTempMinPrice(e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="number"
                    className="price-input"
                    placeholder="Max"
                    value={tempMaxPrice}
                    onChange={(e) => setTempMaxPrice(e.target.value)}
                  />
                </div>
                <button className="price-go-btn" onClick={applyPriceFilter}>
                  Go
                </button>
                {(minPrice || maxPrice) && (
                  <div className="mt-2" style={{ fontSize: "0.875rem", color: "#565959" }}>
                    ₹{minPrice || 0} - ₹{maxPrice || productMaxPrice.toLocaleString()}
                  </div>
                )}
              </div>
              </div>
              {/* Filter Modal Footer */}
              <div className="filter-modal-footer">
                <button className="btn-filter-clear" onClick={() => { clearAllFilters(); setMobileFiltersOpen(false); }}>Clear</button>
                <button className="btn-filter-apply" onClick={() => setMobileFiltersOpen(false)}>Apply</button>
              </div>
            </aside>
            <div className="products-main">
              <div className="products-header">
                <span className="results-count">
                  {filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""}
                </span>
                <select className="sort-dropdown" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                  <option value="newest">Newest Arrivals</option>
                </select>
              </div>
              {productsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading products...</span>
                  </div>
                  <p className="mt-3 text-muted">Loading products from MongoDB...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="alert alert-info text-center" role="alert">
                  {products.length === 0 ? (
                    <>
                      <i className="bi bi-box-seam" style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}></i>
                      <h5>No products available</h5>
                      <p className="mb-0">
                        {isAdmin ? "Go to Admin Panel to add products." : "Please check back later."}
                      </p>
                    </>
                  ) : (
                    "No products found matching your filters."
                  )}
                </div>
              ) : (
                <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                  {filteredProducts.map((product) => {
                    const quantity = cartItems.filter((item) => item.id === product.id).length;
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        quantity={quantity}
                        onShowDetails={showProductDetails}
                        onAddCart={handleAddToCart}
                        onRemoveCart={handleRemoveFromCart}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`page ${activePage === "pdetails" ? "active" : ""}`} id="pdetails">
        {selectedProduct && (
          <div className="container my-5">
            <div className="row justify-content-center">
              <div className="col-md-8">
                <div className="card shadow">
                  <div className="row g-0">
                    <div className="col-md-6">
                      <img
                        src={selectedProduct.img}
                        className="img-fluid rounded-start p-3"
                        alt={selectedProduct.id}
                        loading="lazy"
                      />
                    </div>
                    <div className="col-md-6">
                      <div className="card-body">
                        <h3 className="card-title">{selectedProduct.id}</h3>
                        {(selectedProduct.averageRating || selectedProduct.rating) > 0 && (
                          <div className="mb-2">
                            <span className="text-warning" style={{ fontSize: "1.2rem" }}>
                              {"★".repeat(Math.floor(selectedProduct.averageRating || selectedProduct.rating || 0))}
                              {"☆".repeat(5 - Math.floor(selectedProduct.averageRating || selectedProduct.rating || 0))}
                            </span>
                            <span className="ms-2 text-muted">
                              ({(selectedProduct.averageRating || selectedProduct.rating || 0).toFixed(1)} out of 5)
                            </span>
                          </div>
                        )}
                        <p className="card-text">{selectedProduct.description}</p>
                        <p className="card-text">
                          <small className="text-muted">Category: {selectedProduct.category}</small>
                        </p>
                        {(selectedProduct.brand || selectedProduct.sellerBusinessName || selectedProduct.sellerName) && (
                          <p className="card-text">
                            <small className="text-muted">Brand: {getBrandName(selectedProduct)}</small>
                          </p>
                        )}
                        <p className="card-text">
                          <small className="text-muted">Year: {selectedProduct.year || "N/A"}</small>
                        </p>
                        <div className="mb-3">
                          <h4 className="text-success mb-0">₹{selectedProduct.cost}</h4>
                          <small className="text-muted" style={{ fontWeight: 300 }}>+18% GST (Calculated at checkout)</small>
                        </div>
                        {typeof selectedProduct.mrp === "number" && selectedProduct.mrp > selectedProduct.cost ? (
                          <p className="mb-3">
                            <small className="text-muted">
                              MRP: <span style={{ textDecoration: "line-through" }}>₹{selectedProduct.mrp}</span>
                            </small>
                          </p>
                        ) : null}
                        {(selectedProduct.shippingEtaText || selectedProduct.shippingText || selectedProduct.shipping) && (
                          <p className="mb-3">
                            <small className="text-muted">
                              {selectedProduct.shippingEtaText || selectedProduct.shippingText || selectedProduct.shipping}
                            </small>
                          </p>
                        )}
                        <button className="btn btn-primary btn-lg w-100" onClick={() => handleAddToCart(selectedProduct)}>
                          Add to Cart
                        </button>
                        <button className="btn btn-secondary w-100 mt-2" onClick={() => handlePageChange("p")}>
                          Back to Products
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="home" className={`page ${activePage === "home" ? "active" : ""}`}>
        <div className="body">
          <div className="container">
            <div className="text-center py-5">
              <h1 className="display-3 fw-bold mb-3">Welcome To ShopMaster</h1>
              <p className="lead mb-4">Your Single-Seller Marketplace</p>
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                <button className="btn btn-primary btn-lg px-5" onClick={() => handlePageChange("p")}>
                  Shop Now
                </button>
              </div>
            </div>
            {productsLoading ? (
              <div className="text-center pb-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 text-muted">Loading categories...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="alert alert-info text-center" role="alert">
                No products to show yet.
              </div>
            ) : (
              <div className="pb-5">
                {sectionCategories.map((cat) => {
                  const catProducts = getProductsForCategory(cat);
                  if (catProducts.length === 0) return null;
                  return (
                    <ProductSlider
                      key={cat}
                      title={`Shop By ${cat}`}
                      products={catProducts}
                      cartItems={cartItems}
                      onShowDetails={showProductDetails}
                      onAddCart={handleAddToCart}
                      onRemoveCart={handleRemoveFromCart}
                      onViewAll={() => {
                        setSelectedCategories([cat]);
                        handlePageChange("p");
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="login" className={`page ${activePage === "login" ? "active" : ""}`}>
        <div className="container my-5">
          <div className="row justify-content-center">
            <div className="col-md-6 col-lg-5">
              <div className="card shadow">
                <div className="card-body p-5 text-center">
                  <h2 className="card-title mb-3">Sign In to ShopMaster</h2>
                  <p className="text-muted mb-4">Choose your preferred sign-in method</p>
                  <div className="d-flex justify-content-center mb-4">
                    <Auth onSignInSuccess={handleSignInSuccess} onSignInFailure={handleSignInFailure} />
                  </div>
                  <div className="mt-4">
                    <p className="small text-muted">
                      <i className="bi bi-shield-check"></i> Secure sign-in with Google or Microsoft
                    </p>
                    <p className="small text-muted">Your cart and preferences are saved automatically</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="Cart" className={`page ${activePage === "Cart" ? "active" : ""}`}>
        <div className="container my-4">
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="card shadow">
                <div className="card-body">
                  <h2 className="card-title mb-4">Your Cart</h2>
                  {!currentUser ? (
                    <div className="alert alert-info text-center" role="alert">
                      Please{" "}
                      <a href="#" onClick={() => handlePageChange("login")} className="alert-link">
                        sign in
                      </a>{" "}
                      to view your cart.
                    </div>
                  ) : cartItems.length === 0 ? (
                    <div className="alert alert-warning" role="alert">
                      Your cart is empty.
                    </div>
                  ) : (
                    <>
                      <ul className="list-group mb-3">
                        {groupedCart.map((item) => (
                          <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                              <span>
                                {item.id}
                                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                              </span>
                            </div>
                            <span className="badge bg-success rounded-pill fs-6">₹{item.cost * item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="cart-summary border-top pt-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted">Subtotal:</span>
                          <span className="fw-bold">₹{subtotal}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted">GST (18%):</span>
                          <span className="fw-bold">₹{gstAmount}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
                          <h4 className="mb-0">Total:</h4>
                          <h4 className="text-success mb-0">₹{totalPrice}</h4>
                        </div>
                      </div>
                      <button className="btn btn-primary w-100 mt-3 btn-lg" onClick={handleCheckout}>
                        Proceed to Checkout
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="dashboard" className={`page ${activePage === "dashboard" ? "active" : ""}`}>
        <div className="container py-5">
          <div className="row">
            <div className="col-lg-4 mb-4">
              <div className="card shadow-sm border-0 text-center py-5 h-100">
                <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3 mx-auto avatar-frame" style={{ width: "120px", height: "120px" }}>
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser?.name ? `${currentUser.name.split(" ")[0]} avatar` : "User avatar"}
                      className="avatar-img rounded-circle"
                      loading="lazy"
                    />
                  ) : (
                    <i className="bi bi-person text-secondary" style={{ fontSize: "3rem" }}></i>
                  )}
                </div>
                <h4 className="fw-bold mb-1">{currentUser?.name}</h4>
                <p className="text-muted small mb-4">{currentUser?.email}</p>
                <button className="btn btn-outline-danger btn-sm px-4 rounded-pill" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </div>
            <div className="col-lg-8">
              <div className="row g-3">
                <div className="col-md-6" onClick={() => handlePageChange("orderhistory")} style={{ cursor: "pointer" }}>
                  <div className="card shadow-sm border-0 h-100 action-card hover-lift">
                    <div className="card-body d-flex align-items-center p-4">
                      <div className="icon-box bg-primary-soft text-primary me-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-box-seam" viewBox="0 0 16 16">
                          <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2zm3.564 1.426L5.596 5 8 5.961 14.154 3.5zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"/>
                        </svg>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-1">Your Orders</h6>
                        <p className="text-muted small mb-0">Track, return, or buy again</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6" onClick={() => handlePageChange("Cart")} style={{ cursor: "pointer" }}>
                  <div className="card shadow-sm border-0 h-100 action-card hover-lift">
                    <div className="card-body d-flex align-items-center p-4">
                      <div className="icon-box bg-success-soft text-success me-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-cart" viewBox="0 0 16 16">
                          <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M3.102 4l1.313 7h8.17l1.313-7zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
                        </svg>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-1">View Cart</h6>
                        <p className="text-muted small mb-0">{cartItems.length} items in your bag</p>
                      </div>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="col-md-6" onClick={() => handlePageChange("admin")} style={{ cursor: "pointer" }}>
                    <div className="card shadow-sm border-0 h-100 action-card hover-lift">
                      <div className="card-body d-flex align-items-center p-4">
                        <div className="icon-box bg-warning-soft text-warning me-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-shield-lock" viewBox="0 0 16 16">
                            <path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/>
                          </svg>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-1">Admin Panel</h6>
                          <p className="text-muted small mb-0">Store management tools</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="orderhistory" className={`page ${activePage === "orderhistory" ? "active" : ""}`}>
        {currentUser ? (
          <OrderHistory />
        ) : (
          <div className="container my-5">
            <div className="text-center">
              <h2>Please sign in to view your order history</h2>
              <Auth onSignInSuccess={handleSignInSuccess} onSignInFailure={handleSignInFailure} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;