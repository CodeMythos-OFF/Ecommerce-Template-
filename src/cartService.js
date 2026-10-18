/**
 * Cart Service
 * Manages cart persistence with user authentication
 */

// Get cart from sessionStorage for logged-in user
export const getCart = (userEmail) => {
  if (!userEmail) return [];
  
  try {
    const cartKey = `cart_${userEmail}`;
    // Keep carts across browser restarts while retaining the sessionStorage fallback.
    const savedCart = localStorage.getItem(cartKey) || sessionStorage.getItem(cartKey);
    return savedCart ? JSON.parse(savedCart) : [];
  } catch (error) {
    console.error('Error loading cart:', error);
    return [];
  }
};

// Save cart to sessionStorage for logged-in user
export const saveCart = (userEmail, cartItems) => {
  if (!userEmail) return;
  
  try {
    const cartKey = `cart_${userEmail}`;
    const serialized = JSON.stringify(cartItems);
    localStorage.setItem(cartKey, serialized);
    sessionStorage.setItem(cartKey, serialized);
  } catch (error) {
    console.error('Error saving cart:', error);
  }
};

// Add item to cart
export const addToCart = (userEmail, product, currentCart) => {
  if (!userEmail) return currentCart;
  
  const updatedCart = [...currentCart, product];
  saveCart(userEmail, updatedCart);
  return updatedCart;
};

// Remove item from cart
export const removeFromCart = (userEmail, product, currentCart) => {
  if (!userEmail) return currentCart;
  
  const itemIndex = currentCart.findIndex(item => item.id === product.id);
  if (itemIndex === -1) return currentCart;
  
  const updatedCart = [...currentCart];
  updatedCart.splice(itemIndex, 1);
  saveCart(userEmail, updatedCart);
  return updatedCart;
};

// Clear cart
export const clearCart = (userEmail) => {
  if (!userEmail) return;
  
  try {
    const cartKey = `cart_${userEmail}`;
    localStorage.removeItem(cartKey);
    sessionStorage.removeItem(cartKey);
  } catch (error) {
    console.error('Error clearing cart:', error);
  }
};

// Get current logged-in user (works for both Google and Microsoft)
export const getCurrentUser = () => {
  try {
    const userData = sessionStorage.getItem('authUser');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};
