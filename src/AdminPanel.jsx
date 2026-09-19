import React, { useState, useEffect, useCallback } from 'react';
import {
  getStats,
  getOrders,
  checkBackendHealth,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  deleteOrder,
  updateOrderStatus
} from './api';
import './AdminPanel.css';
import Swal from 'sweetalert2';

const AdminPanel = () => {
  const [stats, setStats] = useState({
    totalViews: 0,
    totalOrders: 0,
    todayViews: 0,
    todayOrders: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalRevenue: 0
  });
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [productLoading, setProductLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);

  const [newProduct, setNewProduct] = useState({
    id: '',
    year: new Date().getFullYear(),
    cost: '',
    img: '',
    category: '',
    brand: '',
    description: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = await checkBackendHealth();
      setBackendOnline(isOnline);

      try {
        const [statsData, ordersData, productsData] = await Promise.all([
          getStats(),
          getOrders(50),
          getProducts()
        ]);
        setStats(statsData || {});
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (apiError) {
        console.error('Error loading from API:', apiError);
        setStats({});
        setOrders([]);
        setProducts([]);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading admin data:', error);
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 30 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loadData]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid File',
          text: 'Please select an image file (JPG, PNG, WEBP, etc.)'
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'File Too Large',
          text: 'Image size should be less than 5MB'
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setNewProduct((prev) => ({ ...prev, img: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (
      !newProduct.id?.trim() ||
      !newProduct.cost ||
      !newProduct.img ||
      !newProduct.category?.trim() ||
      !newProduct.description?.trim()
    ) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: 'Please fill in all required fields and upload an image'
      });
      return;
    }

    const cost = parseFloat(newProduct.cost);
    if (isNaN(cost) || cost <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Price',
        text: 'Please enter a valid price'
      });
      return;
    }

    setProductLoading(true);
    try {
      const productData = {
        ...newProduct,
        cost,
        year: parseInt(newProduct.year),
        brand: newProduct.brand?.trim() || undefined
      };

      if (editingProduct) {
        await updateProduct(editingProduct, productData);
        Swal.fire({
          icon: 'success',
          title: 'Product Updated!',
          text: `${newProduct.id} has been updated successfully`,
          timer: 2000
        });
        setEditingProduct(null);
      } else {
        await addProduct(productData);
        Swal.fire({
          icon: 'success',
          title: 'Product Added!',
          text: `${newProduct.id} has been added successfully`,
          timer: 2000
        });
      }

      setNewProduct({
        id: '',
        year: new Date().getFullYear(),
        cost: '',
        img: '',
        category: '',
        brand: '',
        description: ''
      });
      setImagePreview(null);

      await loadData();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to save product. Please try again.'
      });
    } finally {
      setProductLoading(false);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product.id || product._id);
    setNewProduct({
      id: product.id || '',
      year: product.year || new Date().getFullYear(),
      cost: product.cost || '',
      img: product.img || '',
      category: product.category || '',
      brand: product.brand || '',
      description: product.description || ''
    });
    setImagePreview(product.img || null);
    setActiveTab('products');
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setNewProduct({
      id: '',
      year: new Date().getFullYear(),
      cost: '',
      img: '',
      category: '',
      brand: '',
      description: ''
    });
    setImagePreview(null);
  };

  const handleDeleteProduct = async (productId) => {
    if (!productId) return;

    const result = await Swal.fire({
      title: 'Delete Product?',
      text: `Are you sure you want to delete "${productId}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setProductLoading(true);
      try {
        await deleteProduct(productId);
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Product has been deleted successfully',
          timer: 2000
        });
        await loadData();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to delete product. Please try again.'
        });
      } finally {
        setProductLoading(false);
      }
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!orderId) return;

    const orderToDelete = orders.find((o) => (o._id || o.id) === orderId);
    const displayId = typeof orderId === 'string' ? orderId.slice(-6) : String(orderId).slice(-6);

    const result = await Swal.fire({
      title: 'Delete Order?',
      html: `
        <p>Are you sure you want to delete this order?</p>
        <div style="text-align: left; margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
          <strong>Order #${displayId}</strong><br/>
          <small>Customer: ${orderToDelete?.userName || 'Unknown'}</small><br/>
          <small>Total: ₹${orderToDelete?.total || 0}</small>
        </div>
        <p style="color: #dc3545; margin-top: 10px;"><strong>Warning:</strong> This will permanently delete the order from the database. This action cannot be undone.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete permanently!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await deleteOrder(orderId);
        setOrders((prevOrders) => prevOrders.filter((o) => (o._id || o.id) !== orderId));
        setStats((prevStats) => ({
          ...prevStats,
          totalOrders: Math.max(0, (prevStats.totalOrders || 0) - 1)
        }));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          html: 'Order has been permanently deleted from database.',
          timer: 2000
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to delete order. Please try again.'
        });
      }
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      Swal.fire('Updated!', 'Order status has been updated.', 'success');
      await loadData();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update order status', 'error');
    }
  };

  const getRecentOrders = () => {
    return Array.isArray(orders) ? orders.slice(0, 10) : [];
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    try {
      return lastUpdated.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  const toggleOrderDetails = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="admin-panel">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h2>Admin Dashboard</h2>
          <small className="text-muted">
            {backendOnline ? (
              <span className="text-success">☁️ MongoDB Connected - Cross-browser sync enabled</span>
            ) : (
              <span className="text-warning">⚠️ Using local storage - Backend offline</span>
            )}
          </small>
          {lastUpdated && (
            <div>
              <small className="text-muted">Last updated: {formatLastUpdated()} • Auto-refresh: Every 30 min</small>
            </div>
          )}
        </div>
        <button className="btn btn-info btn-sm" onClick={loadData} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Refreshing...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise"></i> Refresh Now
            </>
          )}
        </button>
      </div>

      <div className="admin-tabs mb-4">
        <button className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setActiveTab('dashboard')}>
          <i className="bi bi-speedometer2"></i> Dashboard
        </button>
        <button className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setActiveTab('orders')}>
          <i className="bi bi-cart-check"></i> Orders
        </button>
        <button className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setActiveTab('products')}>
          <i className="bi bi-box-seam"></i> Products
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <i className="bi bi-box-seam"></i>
              </div>
              <div className="stat-details">
                <h3>{stats.totalProducts || products.length || 0}</h3>
                <p>Total Products</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <i className="bi bi-cart-check"></i>
              </div>
              <div className="stat-details">
                <h3>{orders.length || 0}</h3>
                <p>Total Orders</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                <i className="bi bi-currency-rupee"></i>
              </div>
              <div className="stat-details">
                <h3>₹{stats.totalRevenue || 0}</h3>
                <p>Total Revenue</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="stat-details">
                <h3>{stats.activeProducts || (products?.filter((p) => p.isActive)?.length) || 0}</h3>
                <p>Active Products</p>
              </div>
            </div>
          </div>

          <div className="recent-orders">
            <h3>Recent Orders ({orders.length || 0} total)</h3>
            {getRecentOrders().length === 0 ? (
              <div className="alert alert-info">
                No orders yet. Orders will appear here when customers complete checkout.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getRecentOrders().map((order) => {
                      const orderId = order._id || order.id || 'N/A';
                      const displayId = typeof orderId === 'string' ? orderId.slice(-6) : String(orderId).slice(-6);
                      const orderDate = order.createdAt || order.date;

                      return (
                        <tr key={orderId}>
                          <td>#{displayId}</td>
                          <td>{orderDate ? new Date(orderDate).toLocaleString() : 'N/A'}</td>
                          <td>
                            <div>{order.userName || 'Unknown'}</div>
                            <small className="text-muted">{order.user || 'N/A'}</small>
                          </td>
                          <td>{order.items || 0} items</td>
                          <td className="text-success fw-bold">₹{order.total || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="quick-actions">
            <h3>Backend Status</h3>
            <div className="action-buttons">
              {backendOnline ? (
                <>
                  <button className="btn btn-success" disabled>
                    <i className="bi bi-cloud-check"></i> MongoDB Connected
                  </button>
                  <button className="btn btn-success" disabled>
                    <i className="bi bi-globe"></i> Cross-Browser Sync
                  </button>
                  <button className="btn btn-success" disabled>
                    <i className="bi bi-database"></i> Cloud Database
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-warning" disabled>
                    <i className="bi bi-exclamation-triangle"></i> Backend Offline
                  </button>
                  <button className="btn btn-info" disabled>
                    <i className="bi bi-hdd"></i> Using localStorage
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="orders-detailed">
          <h3 className="mb-4">
            <i className="bi bi-cart-check"></i> All Orders ({orders.length || 0})
          </h3>

          {orders.length === 0 ? (
            <div className="alert alert-info">
              <i className="bi bi-info-circle"></i> No orders yet. Orders will appear here when customers complete checkout.
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => {
                const orderId = order._id || order.id || 'N/A';
                const displayId = typeof orderId === 'string' ? orderId.slice(-6) : String(orderId).slice(-6);
                const orderDate = order.createdAt || order.date;
                const isExpanded = expandedOrder === orderId;

                return (
                  <div key={orderId} className="card mb-3 shadow-sm">
                    <div className="card-header bg-light">
                      <div className="row align-items-center">
                        <div className="col-md-2">
                          <strong>Order #{displayId}</strong>
                          <div className="text-muted small">
                            {orderDate ? new Date(orderDate).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                        <div className="col-md-3">
                          <i className="bi bi-person"></i> {order.userName || 'Unknown'}
                          <div className="text-muted small">{order.user || 'N/A'}</div>
                        </div>
                        <div className="col-md-2">
                          <i className="bi bi-box"></i> {order.items || 0} items
                        </div>
                        <div className="col-md-2">
                          <strong className="text-success">₹{order.total || 0}</strong>
                        </div>
                        <div className="col-md-3 text-end">
                          <button className="btn btn-sm btn-outline-primary me-2" onClick={() => toggleOrderDetails(orderId)}>
                            {isExpanded ? (
                              <>
                                <i className="bi bi-chevron-up"></i> Hide
                              </>
                            ) : (
                              <>
                                <i className="bi bi-chevron-down"></i> Details
                              </>
                            )}
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteOrder(orderId)}>
                            <i className="bi bi-trash"></i> Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <h5 className="border-bottom pb-2">
                              <i className="bi bi-person-circle"></i> Customer Information
                            </h5>
                            <p className="mb-1">
                              <strong>Name:</strong> {order.userName || 'N/A'}
                            </p>
                            <p className="mb-1">
                              <strong>Email:</strong> {order.user || 'N/A'}
                            </p>
                            <p className="mb-1">
                              <strong>Phone:</strong> {order.phone || 'N/A'}
                            </p>
                          </div>

                          <div className="col-md-6 mb-3">
                            <h5 className="border-bottom pb-2">
                              <i className="bi bi-geo-alt"></i> Delivery Address
                            </h5>
                            {order.address ? (
                              <>
                                <p className="mb-1">{order.address.street || 'N/A'}</p>
                                <p className="mb-1">
                                  {order.address.city || 'N/A'}, {order.address.state || 'N/A'} {order.address.pincode || ''}
                                </p>
                                <p className="mb-1">{order.address.country || 'India'}</p>
                              </>
                            ) : (
                              <p className="text-muted">Address not provided</p>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <h5 className="border-bottom pb-2">
                            <i className="bi bi-cart"></i> Order Items
                          </h5>
                          {order.cart && order.cart.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-bordered">
                                <thead className="table-light">
                                  <tr>
                                    <th style={{ width: '60px' }}>Image</th>
                                    <th>Product</th>
                                    <th style={{ width: '100px' }}>Price</th>
                                    <th style={{ width: '80px' }}>Qty</th>
                                    <th style={{ width: '100px' }}>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.cart.map((item, index) => (
                                    <tr key={index}>
                                      <td>
                                        {item.img ? (
                                          <img
                                            src={item.img}
                                            alt={item.id || 'Product'}
                                            style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                            className="rounded"
                                            onError={(e) => (e.target.src = 'https://via.placeholder.com/50')}
                                          />
                                        ) : (
                                          <div
                                            className="bg-light rounded d-flex align-items-center justify-content-center"
                                            style={{ width: '50px', height: '50px' }}
                                          >
                                            <i className="bi bi-image text-muted"></i>
                                          </div>
                                        )}
                                      </td>
                                      <td>
                                        <div>{item.id || 'Unknown Product'}</div>
                                        {item.brand && <small className="text-muted">{item.brand}</small>}
                                      </td>
                                      <td>₹{item.cost || 0}</td>
                                      <td className="text-center">{item.quantity || 1}</td>
                                      <td className="fw-bold">₹{(item.cost || 0) * (item.quantity || 1)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="table-light">
                                  <tr>
                                    <td colSpan="4" className="text-end">
                                      <strong>Total:</strong>
                                    </td>
                                    <td className="fw-bold text-success">₹{order.total || 0}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted">No items in this order</p>
                          )}
                        </div>

                        <div className="row">
                          <div className="col-md-6">
                            <div className="alert alert-info mb-0">
                              <strong>
                                <i className="bi bi-info-circle"></i> Order Summary
                              </strong>
                              <p className="mb-0 mt-2">
                                <strong>Order Date:</strong> {orderDate ? new Date(orderDate).toLocaleDateString() : 'N/A'}
                                <br />
                                <strong>Order Time:</strong> {orderDate ? new Date(orderDate).toLocaleTimeString() : 'N/A'}
                                <br />
                                <strong>Total Items:</strong> {order.items || 0}
                                <br />
                                <strong>Total Amount:</strong>{' '}
                                <span className="text-success">₹{order.total || 0}</span>
                              </p>
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <h5 className="border-bottom pb-2">
                              <i className="bi bi-truck"></i> Shipment Status
                            </h5>
                            <select
                              className="form-select"
                              value={order.status || 'Order Placed'}
                              onChange={(e) => handleStatusChange(orderId, e.target.value)}
                            >
                              <option value="Order Placed">Order Placed</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delivered">Delivered</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="products-management">
          <div className="row">
            <div className="col-lg-5 mb-4">
              <div className="card shadow">
                <div className="card-body">
                  <h3 className="card-title mb-4">
                    {editingProduct ? (
                      <>
                        <i className="bi bi-pencil-square"></i> Edit Product
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-circle"></i> Add New Product
                      </>
                    )}
                  </h3>
                  <form onSubmit={handleAddProduct}>
                    <div className="mb-3">
                      <label className="form-label">Product Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newProduct.id}
                        onChange={(e) => setNewProduct({ ...newProduct, id: e.target.value })}
                        placeholder="e.g., Wireless Headphones"
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Brand</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newProduct.brand}
                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                        placeholder="e.g., CNCMART, ULTRA"
                      />
                      <small className="text-muted">Optional - Enter brand name like CNCMART or ULTRA</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Price (₹) *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={newProduct.cost}
                        onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                        placeholder="e.g., 9999"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Product Image *</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        onChange={handleImageChange}
                        required={!newProduct.img}
                      />
                      <small className="text-muted">Choose an image file (JPG, PNG, WEBP, etc.) - Max 5MB</small>

                      {imagePreview && (
                        <div className="mt-3 text-center">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="img-thumbnail"
                            style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain' }}
                          />
                          <div className="mt-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                setImagePreview(null);
                                setNewProduct((prev) => ({ ...prev, img: '' }));
                              }}
                            >
                              <i className="bi bi-x-circle"></i> Remove Image
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Category *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        placeholder="e.g., Electronics"
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Year</label>
                      <input
                        type="number"
                        className="form-control"
                        value={newProduct.year}
                        onChange={(e) => setNewProduct({ ...newProduct, year: e.target.value })}
                        min="2000"
                        max="2100"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Description *</label>
                      <textarea
                        className="form-control"
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        placeholder="Product description..."
                        rows="3"
                        required
                      />
                    </div>

                    <div className="d-grid gap-2">
                      <button type="submit" className="btn btn-success" disabled={productLoading}>
                        {productLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            {editingProduct ? 'Updating...' : 'Adding...'}
                          </>
                        ) : (
                          <>
                            <i className={`bi ${editingProduct ? 'bi-check-lg' : 'bi-plus-lg'}`}></i>{' '}
                            {editingProduct ? 'Update Product' : 'Add Product'}
                          </>
                        )}
                      </button>
                      {editingProduct && (
                        <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={productLoading}>
                          <i className="bi bi-x-lg"></i> Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="card shadow">
                <div className="card-body">
                  <h3 className="card-title mb-4">
                    <i className="bi bi-box-seam"></i> Products ({products.length || 0})
                  </h3>

                  {!products || products.length === 0 ? (
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle"></i> No products available. Add your first product!
                    </div>
                  ) : (
                    <div className="products-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      {products.map((product) => (
                        <div key={product.id || product._id} className="product-item border rounded p-3 mb-3">
                          <div className="row align-items-center">
                            <div className="col-md-2">
                              <img
                                src={product.img}
                                alt={product.id}
                                className="img-fluid rounded"
                                style={{ width: '100%', height: '60px', objectFit: 'cover' }}
                                onError={(e) => (e.target.src = 'https://via.placeholder.com/60')}
                              />
                            </div>
                            <div className="col-md-7">
                              <h5 className="mb-1">{product.id || 'Unnamed'}</h5>
                              {product.brand && (
                                <div className="mb-1">
                                  <span className="badge bg-info">{product.brand}</span>
                                </div>
                              )}
                              <p className="mb-1 text-success fw-bold">₹{product.cost || 0}</p>
                              <small className="text-muted">
                                {product.category || 'No category'} • {product.year || 'N/A'}
                              </small>
                            </div>
                            <div className="col-md-3 text-end">
                              <button className="btn btn-primary btn-sm me-1" onClick={() => handleEditProduct(product)} disabled={productLoading}>
                                <i className="bi bi-pencil"></i> Edit
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProduct(product.id)} disabled={productLoading}>
                                <i className="bi bi-trash"></i> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;