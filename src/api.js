// API configuration
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

// Retry helper
const fetchWithRetry = async (url, options = {}, retries = 2) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry attempt ${3 - retries} for ${url}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

const getAuthHeaders = (extra = {}) => {
  const token = localStorage.getItem('shopmaster_session_token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const checkBackendHealth = async () => {
  try {
    const response = await fetchWithRetry(`${API_URL}/health`);
    return response.ok;
  } catch (error) {
    console.warn('Backend health check failed:', error?.message || error);
    return false;
  }
};

export const trackView = async () => {
  try {
    const response = await fetchWithRetry(`${API_URL}/stats/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to track view');
    return await response.json();
  } catch (error) {
    console.error('Error tracking view:', error.message);
    const stats = JSON.parse(localStorage.getItem('adminStats') || '{}');
    const today = new Date().toLocaleDateString();

    if (!stats.lastViewDate || stats.lastViewDate !== today) {
      stats.todayViews = 1;
      stats.lastViewDate = today;
    } else {
      stats.todayViews = (stats.todayViews || 0) + 1;
    }

    stats.totalViews = (stats.totalViews || 0) + 1;
    localStorage.setItem('adminStats', JSON.stringify(stats));
    return stats;
  }
};

export const getCoupons = async () => {
  const response = await fetchWithRetry(`${API_URL}/coupons`, { headers: getAuthHeaders() });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data.error || 'Failed to load coupons');
  return data;
};

export const addCoupon = async (coupon) => {
  const response = await fetchWithRetry(`${API_URL}/coupons`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(coupon)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to add coupon');
  return data;
};

export const updateCoupon = async (id, coupon) => {
  const response = await fetchWithRetry(`${API_URL}/coupons/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(coupon)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to update coupon');
  return data;
};

export const deleteCoupon = async (id) => {
  const response = await fetchWithRetry(`${API_URL}/coupons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to delete coupon');
  return data;
};

export const validateCoupon = async (code, subtotal) => {
  try {
    const response = await fetchWithRetry(`${API_URL}/coupons/validate`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ code, subtotal })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Invalid coupon code');
    return data;
  } catch (error) {
    console.error('Error validating coupon:', error.message);
    throw error;
  }
};

export const createOrder = async (orderData) => {
  if (!orderData?.user || !orderData?.userName) {
    throw new Error('Invalid order data: missing user information');
  }

  const response = await fetchWithRetry(`${API_URL}/orders`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(orderData)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to create order');
  return data;
};

export const getStats = async (sellerEmail = null) => {
  let url = sellerEmail
    ? `${API_URL}/stats?sellerEmail=${encodeURIComponent(sellerEmail)}`
    : `${API_URL}/stats`;
  const response = await fetchWithRetry(url, { headers: getAuthHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to get stats');
  return data;
};

export const getOrders = async (limit = 50, sellerEmail = null, userEmail = null) => {
  let url = `${API_URL}/orders?limit=${limit}`;
  if (sellerEmail) url += `&sellerEmail=${encodeURIComponent(sellerEmail)}`;
  if (userEmail) url += `&userEmail=${encodeURIComponent(userEmail)}`;
  const response = await fetchWithRetry(url, { headers: getAuthHeaders() });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data.error || 'Failed to get orders');
  return Array.isArray(data) ? data : [];
};

export const deleteOrder = async (orderId, pin = '') => {
  try {
    if (!orderId) throw new Error('Order ID is required');

    const response = await fetchWithRetry(`${API_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(pin ? { 'X-Super-Admin-Pin': pin } : {})
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete order');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting order:', error.message);
    throw error;
  }
};

export const getProducts = async (sellerEmail = null) => {
  let url = `${API_URL}/products`;
  if (sellerEmail) url += `?sellerEmail=${encodeURIComponent(sellerEmail)}`;
  const response = await fetchWithRetry(url);
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data.error || 'Failed to get products');
  return Array.isArray(data) ? data : [];
};

export const addProduct = async (productData) => {
  if (!productData?.id || productData.cost === undefined || productData.cost === '') {
    throw new Error('Missing required product fields: name and price');
  }
  const response = await fetchWithRetry(`${API_URL}/products`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(productData)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to add product');
  return data;
};

export const updateProduct = async (productId, productData) => {
  if (!productId) throw new Error('Product ID is required');
  const response = await fetchWithRetry(`${API_URL}/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(productData)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to update product');
  return data;
};

export const deleteProduct = async (productId, pin = '', sellerEmail = '') => {
  try {
    if (!productId) throw new Error('Product ID is required');

    const response = await fetchWithRetry(
      `${API_URL}/products/${encodeURIComponent(productId)}`,
      { method: 'DELETE', headers: getAuthHeaders({ ...(pin ? { 'X-Super-Admin-Pin': pin } : {}), ...(sellerEmail ? { 'X-Product-Seller-Email': sellerEmail } : {}) }) }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete product');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting product:', error.message);
    throw error;
  }
};

export const applyAsSeller = async (sellerData) => {
  try {
    const response = await fetchWithRetry(`${API_URL}/sellers/apply`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sellerData)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit seller application');
    }

    return data;
  } catch (error) {
    console.error('Error applying as seller:', error.message);
    throw error;
  }
};

export const getSeller = async (email) => {
  try {
    if (!email) throw new Error('Email is required');

    const response = await fetchWithRetry(`${API_URL}/sellers/${encodeURIComponent(email)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to get seller information');
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting seller:', error.message);
    return null;
  }
};

export const registerSeller = async (sellerData) => {
  try {
    if (!sellerData.email || !sellerData.name || !sellerData.businessName) {
      throw new Error('Missing required seller fields');
    }

    const response = await fetchWithRetry(`${API_URL}/sellers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sellerData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register seller');
    }

    return await response.json();
  } catch (error) {
    console.error('Error registering seller:', error.message);
    throw error;
  }
};

export const getAllSellers = async () => {
  try {
    const response = await fetchWithRetry(`${API_URL}/sellers`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to get sellers');
    return await response.json();
  } catch (error) {
    console.error('Error getting all sellers:', error.message);
    throw error;
  }
};

export const approveSeller = async (email) => {
  try {
    if (!email) throw new Error('Email is required');

    const response = await fetchWithRetry(`${API_URL}/sellers/${encodeURIComponent(email)}/approve`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve seller');
    }

    return await response.json();
  } catch (error) {
    console.error('Error approving seller:', error.message);
    throw error;
  }
};

export const revokeSeller = async (email) => {
  try {
    if (!email) throw new Error('Email is required');

    const response = await fetchWithRetry(`${API_URL}/sellers/${encodeURIComponent(email)}/revoke`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke seller access');
    }

    return await response.json();
  } catch (error) {
    console.error('Error revoking seller:', error.message);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    if (!orderId || !newStatus) {
      throw new Error('Order ID and new status are required');
    }

    const response = await fetchWithRetry(`${API_URL}/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update order status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating order status:', error.message);
    throw error;
  }
};

export const submitReview = async ({ productId, rating, comment = '', orderId }) => {
  if (!productId || !rating || !orderId) throw new Error('Product, rating, and order are required');
  const response = await fetchWithRetry(`${API_URL}/reviews`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ productId, rating, comment, orderId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to submit review');
  return data;
};

export const getMicrosoftEmailStatus = async () => {
  const response = await fetchWithRetry(`${API_URL}/email/status`, { headers: getAuthHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to get email status');
  return data;
};
export const getMicrosoftEmailTemplates = async () => {
  const response = await fetchWithRetry(`${API_URL}/email/templates`, { headers: getAuthHeaders() });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data.error || 'Failed to get email templates');
  return data;
};
export const updateMicrosoftEmailTemplate = async (key, template) => {
  const response = await fetchWithRetry(`${API_URL}/email/templates/${encodeURIComponent(key)}`, { method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(template) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to update email template');
  return data;
};
export const sendMicrosoftTestEmail = async (to) => {
  const response = await fetchWithRetry(`${API_URL}/email/test`, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ to }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to send test email');
  return data;
};


export const getProductReviews = async (productId) => {
  const response = await fetchWithRetry(`${API_URL}/reviews/product/${encodeURIComponent(productId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to load reviews');
  return data;
};


