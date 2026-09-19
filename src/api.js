// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://shopmaster-backend.vercel.app/api';

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

export const createOrder = async (orderData) => {
  try {
    if (!orderData || !orderData.user || !orderData.userName) {
      throw new Error('Invalid order data: missing user information');
    }

    const response = await fetchWithRetry(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create order');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating order:', error.message);
    const stats = JSON.parse(localStorage.getItem('adminStats') || '{}');
    const today = new Date().toLocaleDateString();

    stats.totalOrders = (stats.totalOrders || 0) + 1;
    stats.ordersHistory = stats.ordersHistory || [];

    if (!stats.lastOrderDate || stats.lastOrderDate !== today) {
      stats.todayOrders = 1;
      stats.lastOrderDate = today;
    } else {
      stats.todayOrders = (stats.todayOrders || 0) + 1;
    }

    stats.ordersHistory = [
      {
        id: Date.now(),
        date: new Date().toISOString(),
        user: orderData.user,
        userName: orderData.userName,
        items: orderData.items,
        total: orderData.total,
        cart: orderData.products || orderData.cart || [],
        address: orderData.address
      },
      ...stats.ordersHistory
    ].slice(0, 50);

    localStorage.setItem('adminStats', JSON.stringify(stats));
    return { order: orderData, stats };
  }
};

export const getStats = async (sellerEmail = null) => {
  try {
    const url = sellerEmail
      ? `${API_URL}/stats?sellerEmail=${encodeURIComponent(sellerEmail)}`
      : `${API_URL}/stats`;
    const response = await fetchWithRetry(url);
    if (!response.ok) throw new Error('Failed to get stats');
    return await response.json();
  } catch (error) {
    console.error('Error getting stats:', error.message);
    const stats = JSON.parse(localStorage.getItem('adminStats') || '{}');
    return {
      totalViews: stats.totalViews || 0,
      totalOrders: stats.totalOrders || 0,
      todayViews: stats.todayViews || 0,
      todayOrders: stats.todayOrders || 0,
      totalProducts: 0,
      activeProducts: 0,
      totalRevenue: 0
    };
  }
};

export const getOrders = async (limit = 50, sellerEmail = null) => {
  try {
    let url = `${API_URL}/orders?limit=${limit}`;
    if (sellerEmail) {
      url += `&sellerEmail=${encodeURIComponent(sellerEmail)}`;
    }
    const response = await fetchWithRetry(url);
    if (!response.ok) throw new Error('Failed to get orders');
    return await response.json();
  } catch (error) {
    console.error('Error getting orders:', error.message);
    const stats = JSON.parse(localStorage.getItem('adminStats') || '{}');
    return stats.ordersHistory || [];
  }
};

export const deleteOrder = async (orderId) => {
  try {
    if (!orderId) throw new Error('Order ID is required');

    const response = await fetchWithRetry(`${API_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE'
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
  try {
    let url = `${API_URL}/products`;
    if (sellerEmail) {
      url += `?sellerEmail=${encodeURIComponent(sellerEmail)}`;
    }
    const response = await fetchWithRetry(url);
    if (!response.ok) throw new Error('Failed to get products');
    return await response.json();
  } catch (error) {
    console.error('Error getting products:', error.message);
    const products = JSON.parse(localStorage.getItem('products') || '[]');
    return Array.isArray(products) ? products : [];
  }
};

export const addProduct = async (productData) => {
  try {
    if (!productData.id || !productData.cost) {
      throw new Error('Missing required product fields: id and cost');
    }

    if (!productData.sellerEmail) {
      productData.sellerEmail = 'rohan.sivaa@gmail.com';
    }

    const response = await fetchWithRetry(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add product');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding product:', error.message);
    throw error;
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    if (!productId) throw new Error('Product ID is required');

    if (!productData.sellerEmail) {
      productData.sellerEmail = 'rohan.sivaa@gmail.com';
    }

    const response = await fetchWithRetry(`${API_URL}/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update product');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating product:', error.message);
    throw error;
  }
};

export const deleteProduct = async (productId, sellerEmail = 'rohan.sivaa@gmail.com') => {
  try {
    if (!productId) throw new Error('Product ID is required');

    const response = await fetchWithRetry(
      `${API_URL}/products/${encodeURIComponent(productId)}?sellerEmail=${encodeURIComponent(sellerEmail)}`,
      { method: 'DELETE' }
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
    const response = await fetchWithRetry(`${API_URL}/sellers`);
    if (!response.ok) throw new Error('Failed to get sellers');
    return await response.json();
  } catch (error) {
    console.error('Error getting all sellers:', error.message);
    return [];
  }
};

export const approveSeller = async (email) => {
  try {
    if (!email) throw new Error('Email is required');

    const response = await fetchWithRetry(`${API_URL}/sellers/${encodeURIComponent(email)}/approve`, {
      method: 'PUT'
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

export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    if (!orderId || !newStatus) {
      throw new Error('Order ID and new status are required');
    }

    const response = await fetchWithRetry(`${API_URL}/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

export const submitReview = async ({ productId, rating, comment = '', userEmail, orderId }) => {
  if (!productId || !rating) throw new Error('Product ID and rating are required');

  try {
    const response = await fetchWithRetry(`${API_URL}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, rating, comment, userEmail, orderId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit review');
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting review:', error.message);
    const fallback = JSON.parse(localStorage.getItem('productReviews') || '{}');
    fallback[productId] = fallback[productId] || [];
    fallback[productId].push({
      rating,
      comment,
      userEmail,
      orderId,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('productReviews', JSON.stringify(fallback));
    return { fallback: true, reviews: fallback[productId] };
  }
};