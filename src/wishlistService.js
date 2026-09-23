/**
 * Wishlist Service
 * Persists each signed-in user's wishlist in localStorage.
 */

const getWishlistKey = (userEmail) => userEmail ? `wishlist_${String(userEmail).toLowerCase()}` : null;

export const getWishlist = (userEmail) => {
  const key = getWishlistKey(userEmail);
  if (!key) return [];
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error loading wishlist:", error);
    return [];
  }
};

export const saveWishlist = (userEmail, products) => {
  const key = getWishlistKey(userEmail);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(products));
  } catch (error) {
    console.error("Error saving wishlist:", error);
  }
};

export const isInWishlist = (userEmail, productId) => {
  return getWishlist(userEmail).some((item) => String(item.id) === String(productId));
};

export const toggleWishlist = (userEmail, product) => {
  if (!userEmail || !product?.id) return getWishlist(userEmail);
  const current = getWishlist(userEmail);
  const exists = current.some((item) => String(item.id) === String(product.id));
  const updated = exists
    ? current.filter((item) => String(item.id) !== String(product.id))
    : [...current, product];
  saveWishlist(userEmail, updated);
  window.dispatchEvent(new Event("wishlistChanged"));
  return updated;
};

export const removeFromWishlist = (userEmail, productId) => {
  if (!userEmail) return [];
  const updated = getWishlist(userEmail).filter((item) => String(item.id) !== String(productId));
  saveWishlist(userEmail, updated);
  window.dispatchEvent(new Event("wishlistChanged"));
  return updated;
};
