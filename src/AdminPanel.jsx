import React, { useState, useEffect, useCallback } from 'react';
import {
  getStats,
  getOrders,
  checkBackendHealth,
  getProducts,
  getAllSellers,
  addProduct,
  updateProduct,
  deleteProduct,
  deleteOrder,
  updateOrderStatus,
  approveSeller,
  revokeSeller,
  getMicrosoftEmailStatus,
  getMicrosoftEmailTemplates,
  updateMicrosoftEmailTemplate,
  sendMicrosoftTestEmail,
  getCoupons,
  addCoupon,
  updateCoupon,
  deleteCoupon,
} from './api';
import './AdminPanel.css';
import Swal from 'sweetalert2';

const AdminPanel = ({ currentUser }) => {
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
  const [sellers, setSellers] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailStatus, setEmailStatus] = useState({ configured: false, connected: false });
  const [emailSaving, setEmailSaving] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponForm, setCouponForm] = useState({ code: '', type: 'percent', value: '', minSubtotal: 0, active: true, expiresAt: '' });
  const [newProduct, setNewProduct] = useState({
    id: '',
    year: new Date().getFullYear(),
    cost: '',
    img: '',
    category: '',
    brand: '',
    description: '',
    sellerEmail: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = await checkBackendHealth();
      setBackendOnline(isOnline);

      try {
        const sellerEmail = currentUser?.isSuperAdmin ? null : currentUser?.email;
        const [statsData, ordersData, productsData] = await Promise.all([
          getStats(sellerEmail),
          getOrders(50, sellerEmail),
          getProducts(sellerEmail)
        ]);

        if (currentUser?.isSuperAdmin) {
          const sellersData = await getAllSellers();
          setSellers(Array.isArray(sellersData) ? sellersData : []);
        } else {
          setSellers([]);
        }setStats(statsData || {});
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (apiError) {
        console.error('Error loading from API:', apiError);
        setStats({});
        setOrders([]);
        setProducts([]);
      }

      if (currentUser?.isSuperAdmin) {
        try {
          const couponData = await getCoupons();
          setCoupons(Array.isArray(couponData) ? couponData : []);
        } catch (couponError) {
          console.warn('Coupon settings unavailable:', couponError);
          setCoupons([]);
        }
        try {
          const [status, templates] = await Promise.all([getMicrosoftEmailStatus(), getMicrosoftEmailTemplates()]);
          setEmailStatus(status || {});
          setEmailTemplates(Array.isArray(templates) ? templates : []);
        } catch (emailError) {
          console.warn('Microsoft email settings unavailable:', emailError);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading admin data:', error);
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 30 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loadData]);

  const resetCouponForm = () => {
    setEditingCoupon(null);
    setCouponForm({ code: '', type: 'percent', value: '', minSubtotal: 0, active: true, expiresAt: '' });
  };

  const handleSaveCoupon = async (event) => {
    event.preventDefault();
    if (!currentUser?.isSuperAdmin) return;

    const code = couponForm.code.trim().toUpperCase();
    const minSubtotal = Number(couponForm.minSubtotal) || 0;
    const value = couponForm.type === 'free_delivery' ? 0 : Number(couponForm.value);

    if (!code) {
      Swal.fire('Validation error', 'Enter a coupon code.', 'error');
      return;
    }
    if (couponForm.type === 'percent' && (value <= 0 || value > 100)) {
      Swal.fire('Validation error', 'Percentage must be between 1 and 100.', 'error');
      return;
    }
    if (couponForm.type === 'fixed' && value <= 0) {
      Swal.fire('Validation error', 'Enter a fixed discount greater than ₹0.', 'error');
      return;
    }

    setCouponLoading(true);
    try {
      const payload = {
        code,
        type: couponForm.type,
        value,
        minSubtotal,
        active: couponForm.active,
        expiresAt: couponForm.expiresAt || null
      };
      const saved = editingCoupon
        ? await updateCoupon(editingCoupon._id, payload)
        : await addCoupon(payload);

      setCoupons((items) => editingCoupon
        ? items.map((item) => item._id === saved._id ? saved : item)
        : [saved, ...items]);
      resetCouponForm();
      Swal.fire({ icon: 'success', title: editingCoupon ? 'Coupon updated' : 'Coupon added', timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to save coupon', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleEditCoupon = (coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code || '',
      type: coupon.type || 'percent',
      value: coupon.type === 'free_delivery' ? '' : coupon.value ?? '',
      minSubtotal: coupon.minSubtotal ?? 0,
      active: coupon.active !== false,
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : ''
    });
    setActiveTab('coupons');
  };

  const handleDeleteCoupon = async (coupon) => {
    const result = await Swal.fire({
      title: 'Delete coupon?',
      text: `Customers will no longer be able to use ${coupon.code}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete'
    });
    if (!result.isConfirmed) return;

    try {
      await deleteCoupon(coupon._id);
      setCoupons((items) => items.filter((item) => item._id !== coupon._id));
      if (editingCoupon?._id === coupon._id) resetCouponForm();
      Swal.fire({ icon: 'success', title: 'Coupon deleted', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete coupon', 'error');
    }
  };

  const handleApproveSeller = async (email) => {
    if (!currentUser?.isSuperAdmin) return;

    try {
      await approveSeller(email);
      await Swal.fire({
        icon: 'success',
        title: 'Seller Approved',
        text: `${email} can now manage their own products.`,
        timer: 1800,
        showConfirmButton: false
      });
      await loadData();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to approve seller', 'error');
    }
  };

  const handleRevokeSeller = async (email) => {
    if (!currentUser?.isSuperAdmin || email === currentUser?.email) return;

    const result = await Swal.fire({
      title: 'Revoke seller access?',
      text: `${email} will lose seller/admin product-management access. Existing products will remain in the database.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revoke Access',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      await revokeSeller(email);
      await Swal.fire({
        icon: 'success',
        title: 'Access Revoked',
        timer: 1600,
        showConfirmButton: false
      });
      await loadData();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to revoke seller access', 'error');
    }
  };

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
        brand: newProduct.brand?.trim() || undefined,
        sellerEmail: currentUser?.isSuperAdmin ? newProduct.sellerEmail : currentUser?.email
      };

      if (currentUser?.isSuperAdmin && !productData.sellerEmail) {
        throw new Error('Select a seller before adding a product.');
      }

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
        description: '',
        sellerEmail: ''
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
      brand: product.brand || product.sellerBusinessName || '',
      description: product.description || '',
      sellerEmail: product.sellerEmail || ''
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

  const handleDeleteProduct = async (productId, sellerEmail) => {
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
      if (!currentUser?.isSuperAdmin) {
        await Swal.fire({ icon: 'error', title: 'Super admin only', text: 'Only the super admin can permanently delete products.' });
        return;
      }

      const pinResult = await Swal.fire({
        title: 'Super Admin PIN',
        input: 'password',
        inputLabel: 'Enter the PIN to permanently delete this product',
        inputPlaceholder: 'PIN',
        inputAttributes: { maxlength: 32, autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Verify & Delete',
        inputValidator: (value) => !value ? 'PIN is required' : undefined
      });
      if (!pinResult.isConfirmed) return;

      setProductLoading(true);
      try {
        await deleteProduct(productId, pinResult.value, sellerEmail);
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
      if (!currentUser?.isSuperAdmin) {
        await Swal.fire({ icon: 'error', title: 'Super admin only', text: 'Only the super admin can permanently delete orders.' });
        return;
      }

      const pinResult = await Swal.fire({
        title: 'Super Admin PIN',
        input: 'password',
        inputLabel: 'Enter the PIN to permanently delete this order',
        inputPlaceholder: 'PIN',
        inputAttributes: { maxlength: 32, autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Verify & Delete',
        inputValidator: (value) => !value ? 'PIN is required' : undefined
      });
      if (!pinResult.isConfirmed) return;

      try {
        await deleteOrder(orderId, pinResult.value);
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
        {currentUser?.isSuperAdmin && (
          <>
            <button className={`btn ${activeTab === 'sellers' ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setActiveTab('sellers')}>
              <i className="bi bi-people"></i> Sellers & Approvals
            </button>
            <button className={`btn ${activeTab === 'emails' ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setActiveTab('emails')}>
              <i className="bi bi-envelope"></i> Automated Emails
            </button>
            <button className={`btn ${activeTab === 'coupons' ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setActiveTab('coupons')}>
              <i className="bi bi-ticket-perforated"></i> Coupons
            </button>
          </>
        )}
      </div>


      {activeTab === 'coupons' && currentUser?.isSuperAdmin && (
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3 className="mb-1"><i className="bi bi-ticket-perforated me-2"></i>{editingCoupon ? 'Edit Coupon' : 'Add Coupon'}</h3>
                    <p className="text-muted small mb-0">Choose the discount customers receive at checkout.</p>
                  </div>
                  {editingCoupon && <button className="btn btn-sm btn-outline-secondary" onClick={resetCouponForm}>Cancel</button>}
                </div>

                <form onSubmit={handleSaveCoupon}>
                  <label className="form-label fw-semibold">Coupon code</label>
                  <input className="form-control mb-3" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="SAVE200" maxLength={30} required />

                  <label className="form-label fw-semibold">Offer type</label>
                  <select className="form-select mb-3" value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}>
                    <option value="percent">X% off</option>
                    <option value="fixed">₹X off</option>
                    <option value="free_delivery">Free delivery</option>
                  </select>

                  {couponForm.type !== 'free_delivery' && (
                    <>
                      <label className="form-label fw-semibold">{couponForm.type === 'percent' ? 'Percentage' : 'Discount amount (₹)'}</label>
                      <input type="number" className="form-control mb-3" min="1" max={couponForm.type === 'percent' ? 100 : undefined} value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} required />
                    </>
                  )}

                  <label className="form-label fw-semibold">Minimum order value (₹)</label>
                  <input type="number" className="form-control mb-1" min="0" value={couponForm.minSubtotal} onChange={(e) => setCouponForm({ ...couponForm, minSubtotal: e.target.value })} />
                  <div className="form-text mb-3">Set 0 if there is no minimum.</div>

                  <label className="form-label fw-semibold">Expiry date</label>
                  <input type="date" className="form-control mb-3" value={couponForm.expiresAt} onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })} />

                  <div className="form-check form-switch mb-4">
                    <input className="form-check-input" type="checkbox" checked={couponForm.active} onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })} id="coupon-active-switch" />
                    <label className="form-check-label" htmlFor="coupon-active-switch">Active coupon</label>
                  </div>

                  <button className="btn btn-primary w-100" type="submit" disabled={couponLoading}>
                    {couponLoading ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3 className="mb-1">Your Coupons</h3>
                    <p className="text-muted small mb-0">These are the coupons customers can use during checkout.</p>
                  </div>
                  <button className="btn btn-outline-primary btn-sm" onClick={async () => { try { const data = await getCoupons(); setCoupons(data); } catch (e) { Swal.fire('Error', e.message, 'error'); } }}>
                    <i className="bi bi-arrow-clockwise"></i> Refresh
                  </button>
                </div>

                {coupons.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-ticket-perforated display-4 text-muted"></i>
                    <h5 className="mt-3">No coupons yet</h5>
                    <p className="text-muted">Create a coupon using the form on the left.</p>
                  </div>
                ) : (
                  <div className="d-grid gap-3">
                    {coupons.map((coupon) => (
                      <div key={coupon._id} className="border rounded-3 p-3">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <strong className="fs-5">{coupon.code}</strong>
                              <span className={`badge ${coupon.active ? 'bg-success' : 'bg-secondary'}`}>{coupon.active ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div className="fw-semibold text-primary mt-1">
                              {coupon.type === 'percent' ? `${coupon.value}% off` : coupon.type === 'fixed' ? `₹${coupon.value} off` : 'Free delivery'}
                            </div>
                            <div className="small text-muted mt-1">
                              {coupon.minSubtotal > 0 ? `Minimum order: ₹${coupon.minSubtotal}` : 'No minimum order'}
                              {coupon.expiresAt ? ` • Expires: ${new Date(coupon.expiresAt).toLocaleDateString()}` : ' • No expiry'}
                            </div>
                          </div>
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-primary" onClick={() => handleEditCoupon(coupon)}>Edit</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCoupon(coupon)}>Delete</button>
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
      )}

      {activeTab === 'emails' && currentUser?.isSuperAdmin && (
        <div className="card shadow-sm border-0 p-4 mb-4">
          <h3>Microsoft Automated Emails</h3>
          <p className="text-muted">
            Connect your personal Outlook.com account using Microsoft OAuth. Your Outlook password is never stored by ShopMaster.
          </p>

          <div className={`alert ${emailStatus.connected ? 'alert-success' : 'alert-warning'}`}>
            <strong>Status:</strong>{' '}
            {emailStatus.connected
              ? `Connected to ${emailStatus.accountEmail || 'Microsoft account'}`
              : 'Not connected'}
          </div>

          <a
            className="btn btn-primary me-2"
            href={`${window.location.origin}/api/email/microsoft/authorize`}
          >
            Connect Microsoft Account
          </a>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={async () => {
              try {
                const status = await getMicrosoftEmailStatus();
                setEmailStatus(status);
              } catch (error) {
                Swal.fire('Error', error.message || 'Failed to refresh email status', 'error');
              }
            }}
          >
            Refresh
          </button>

          {emailStatus.connected && (
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-success mb-3"
                onClick={async () => {
                  const result = await Swal.fire({
                    title: 'Test email',
                    input: 'email',
                    inputValue: currentUser?.email || '',
                    showCancelButton: true,
                    confirmButtonText: 'Send'
                  });

                  if (!result.isConfirmed || !result.value) return;

                  try {
                    await sendMicrosoftTestEmail(result.value);
                    Swal.fire('Sent', 'Test email sent.', 'success');
                  } catch (error) {
                    Swal.fire('Error', error.message || 'Failed to send test email', 'error');
                  }
                }}
              >
                Send Test Email
              </button>

              {emailTemplates.map((template) => (
                <div className="border rounded p-3 mb-3" key={template.key}>
                  <h5>{template.name}</h5>

                  <label className="form-label">Subject</label>
                  <input
                    className="form-control mb-2"
                    value={template.subject || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEmailTemplates((items) =>
                        items.map((item) =>
                          item.key === template.key ? { ...item, subject: value } : item
                        )
                      );
                    }}
                  />

                  <label className="form-label">Plain-text body</label>
                  <textarea
                    className="form-control mb-2"
                    rows="3"
                    value={template.text || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEmailTemplates((items) =>
                        items.map((item) =>
                          item.key === template.key ? { ...item, text: value } : item
                        )
                      );
                    }}
                  />

                  <label className="form-label">HTML body</label>
                  <textarea
                    className="form-control mb-2"
                    rows="5"
                    value={template.html || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEmailTemplates((items) =>
                        items.map((item) =>
                          item.key === template.key ? { ...item, html: value } : item
                        )
                      );
                    }}
                  />

                  <label className="d-block mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input me-2"
                      checked={template.enabled !== false}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setEmailTemplates((items) =>
                          items.map((item) =>
                            item.key === template.key ? { ...item, enabled } : item
                          )
                        );
                      }}
                    />
                    Enabled
                  </label>

                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    disabled={emailSaving}
                    onClick={async () => {
                      setEmailSaving(true);
                      try {
                        const result = await updateMicrosoftEmailTemplate(template.key, template);
                        setEmailTemplates((items) =>
                          items.map((item) =>
                            item.key === template.key ? result.template : item
                          )
                        );
                        Swal.fire('Saved', 'Template updated.', 'success');
                      } catch (error) {
                        Swal.fire('Error', error.message || 'Failed to save template', 'error');
                      } finally {
                        setEmailSaving(false);
                      }
                    }}
                  >
                    Save Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                          {currentUser?.isSuperAdmin && (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteOrder(orderId)}>
                              <i className="bi bi-trash"></i> Delete
                            </button>
                          )}
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
                              <strong>Phone:</strong> {order.address?.phone || order.phone || 'N/A'}
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
                                <div className="mt-3 p-3 rounded-3" style={{ background: '#f0f8ff', border: '1px solid #cfe8ff' }}>
                                  <div className="fw-bold text-primary mb-1"><i className="bi bi-geo-alt-fill"></i> India Post DIGIPIN</div>
                                  <div className="fs-5 fw-bold">{order.address.digipin || 'Not available'}</div>
                                  {order.address.latitude != null && order.address.longitude != null && (
                                    <div className="small text-muted mt-1">
                                      Coordinates: {Number(order.address.latitude).toFixed(6)}, {Number(order.address.longitude).toFixed(6)}
                                    </div>
                                  )}
                                  {order.address.accuracy != null && (
                                    <div className="small text-muted">GPS accuracy: ~{Math.round(Number(order.address.accuracy))} m</div>
                                  )}
                                </div>
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


      {activeTab === 'sellers' && currentUser?.isSuperAdmin && (
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
                  <div>
                    <h3 className="card-title mb-1"><i className="bi bi-person-check"></i> Seller approvals</h3>
                    <p className="text-muted mb-0">Approve or revoke seller/admin access. Only approved sellers can add or edit their own products.</p>
                  </div>
                  <span className="badge bg-primary">{sellers.length} registered</span>
                </div>

                {sellers.length === 0 ? (
                  <div className="alert alert-info">No seller accounts are registered yet.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead>
                        <tr>
                          <th>Seller</th>
                          <th>Business</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellers.map((seller) => (
                          <tr key={seller.email}>
                            <td>
                              <strong>{seller.name}</strong>
                              {seller.isSuperAdmin && <span className="badge bg-dark ms-2">Super Admin</span>}
                            </td>
                            <td>{seller.businessName}</td>
                            <td>{seller.email}</td>
                            <td>
                              {seller.isApproved ? (
                                <span className="badge bg-success">Approved seller</span>
                              ) : (
                                <span className="badge bg-warning text-dark">Pending approval</span>
                              )}
                            </td>
                            <td className="text-end">
                              {seller.isSuperAdmin ? (
                                <span className="text-muted small">Protected</span>
                              ) : seller.isApproved ? (
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleRevokeSeller(seller.email)}
                                >
                                  <i className="bi bi-person-dash"></i> Revoke
                                </button>
                              ) : (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleApproveSeller(seller.email)}
                                >
                                  <i className="bi bi-person-check"></i> Approve as Seller
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="alert alert-secondary mt-4 mb-0">
                  <strong>How it works:</strong> a registered account starts as pending. When you approve it, that Google account becomes a seller/admin and can manage only its own products. Revoking access does not delete its products.
                </div>
              </div>
            </div>
          </div>
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
                      <small className="text-muted">Defaults to the seller's business name. Sellers can use their own brand for their products.</small>
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

                    {currentUser?.isSuperAdmin && (
                      <div className="mb-3">
                        <label className="form-label">Seller *</label>
                        <select
                          className="form-select"
                          value={newProduct.sellerEmail}
                          onChange={(e) => {
                            const email = e.target.value;
                            const seller = sellers.find((item) => item.email === email);
                            setNewProduct((prev) => ({
                              ...prev,
                              sellerEmail: email,
                              brand: prev.brand || seller?.businessName || ''
                            }));
                          }}
                          disabled={Boolean(editingProduct)}
                        >
                          <option value="">Select seller</option>
                          {sellers.filter((seller) => seller.isApproved).map((seller) => (
                            <option key={seller.email} value={seller.email}>
                              {seller.businessName} — {seller.name} ({seller.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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
                              <small className="text-muted d-block">
                                {product.category || 'No category'} • {product.year || 'N/A'}
                              </small>
                              <small className="text-muted">
                                Seller: {product.sellerBusinessName || 'N/A'} • {product.sellerName || 'N/A'}
                              </small>
                            </div>
                            <div className="col-md-3 text-end">
                              <button className="btn btn-primary btn-sm me-1" onClick={() => handleEditProduct(product)} disabled={productLoading}>
                                <i className="bi bi-pencil"></i> Edit
                              </button>
                              {currentUser?.isSuperAdmin && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProduct(product.id, product.sellerEmail)} disabled={productLoading}>
                                  <i className="bi bi-trash"></i> Delete
                                </button>
                              )}
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