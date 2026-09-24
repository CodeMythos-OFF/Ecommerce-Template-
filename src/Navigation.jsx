import React, { useState, useEffect, useRef } from 'react';
import "./Navigation.css";
import { getCurrentUser } from "./cartService";
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
import Swal from 'sweetalert2';

// Icon mapping for bottom navigation
const NAV_ICONS = {
  home: '🏠',
  products: '🛍️',
  cart: '🛒',
  user: '👤',
  login: '🔓'
};

export default function Navigation({ activePage, onPageChange, search, setSearch, cartCount = 0, currentUser: appUser = null, searchSuggestions = [] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const user = appUser || getCurrentUser();
    setCurrentUser(user);

    const handleUserChange = () => {
      setCurrentUser(appUser || getCurrentUser());
    };

    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, [appUser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const go = (page) => (event) => {
    event.preventDefault();
    onPageChange(page);
    setMobileMenuOpen(false);
  };

  const handleSearch = (event) => {
    const value = event.target.value;
    setSearch(value);
    if (activePage !== 'p' && value.length > 0) {
      onPageChange('p');
    }
  };

  const toggleUserMenu = () => {
    setShowUserMenu((prev) => !prev);
  };

  const handleSignOut = async (event) => {
    event.preventDefault();
    setShowUserMenu(false);
    const result = await Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to sign out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, sign out',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;

    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: (() => {
          const token = localStorage.getItem('shopmaster_session_token');
          return token ? { Authorization: `Bearer ${token}` } : {};
        })()
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    localStorage.removeItem('shopmaster_session_token');
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('authToken');
    window.dispatchEvent(new Event('userChanged'));
    Swal.fire({
      icon: 'success',
      title: 'Signed Out',
      text: 'You have been signed out successfully',
      timer: 1200,
      showConfirmButton: false
    }).then(() => onPageChange('home'));
  };

  const searchContainerClass = `search-box-container mx-3 d-none d-md-flex ${activePage === 'p' ? 'd-none' : ''}`;
  const mobileSearchClass = `w-100 px-3 pb-2 d-md-none ${activePage === 'p' ? 'd-none' : ''}`;

  return (
    <nav className={`navigation ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      <div className="d-flex align-items-center justify-content-between w-100">
        <h2 className="heading mb-0" onClick={go('home')}>
          Shopmaster
        </h2>

        <div className={searchContainerClass}>
          <div className="navigation-search-wrap">
            <input
              type="text"
              className="form-control border-0 bg-light"
              placeholder="Search products, brands or categories..."
              value={search}
              onChange={handleSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              aria-label="Search products"
            />
            {searchFocused && search.trim() && searchSuggestions.length > 0 && (
              <div className="search-suggestions">
                {searchSuggestions.map((product) => (
                  <button key={product.id} type="button" onMouseDown={() => { setSearch(product.id); onPageChange("p"); }}>
                    <img src={product.img} alt="" />
                    <span><strong>{product.id}</strong><small>{product.brand || product.category || "Product"}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          className="mobile-menu-toggle d-md-none"
          aria-label="Toggle menu"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        <ul className={`navigation-links mb-0 ${mobileMenuOpen ? 'd-flex flex-column' : 'd-none d-md-flex align-items-center'}`}>
          <li className={activePage === 'home' ? 'active-nav-link' : ''}>
            <a href="#home" onClick={go('home')}>
              Home
            </a>
          </li>
          <li className={activePage === 'p' ? 'active-nav-link' : ''}>
            <a href="#p" onClick={go('p')}>
              Products
            </a>
          </li>
          {currentUser && !currentUser.isSeller && !currentUser.isSuperAdmin && (
            <li className={activePage === 'sellerapply' ? 'active-nav-link' : ''}>
              <a href="#sellerapply" onClick={go('sellerapply')}>
                Sell
              </a>
            </li>
          )}
          <li className={activePage === 'Cart' ? 'active-nav-link' : ''}>
            <a href="#Cart" onClick={go('Cart')} className="position-relative">
              Cart ({cartCount})
            </a>
          </li>
          {currentUser && (
            <li className={activePage === 'wishlist' ? 'active-nav-link' : ''}>
              <a href="#wishlist" onClick={go('wishlist')}>
                Wishlist
              </a>
            </li>
          )}
          {!currentUser ? (
            <li className={activePage === 'login' ? 'active-nav-link' : ''}>
              <a href="#login" onClick={go('login')}>
                Login
              </a>
            </li>
          ) : (
            <li ref={userMenuRef} className={activePage === 'account' ? 'active-nav-link' : ''} style={{ position: 'relative' }}>
              <a href="#dashboard" onClick={go('account')}>
                {currentUser.name ? currentUser.name.split(' ')[0] : 'Account'}
              </a>
            </li>
          )}
        </ul>
      </div>

      <div className={mobileSearchClass}>
        <input
          type="text"
          className="form-control border-0 bg-light"
          placeholder="Search products, brands or categories..."
          value={search}
          onChange={handleSearch}
          aria-label="Search products"
        />
      </div>

      {/* Bottom Navigation for Mobile & Tablet */}
      <nav className="bottom-navigation">
        <div className="bottom-nav-container">
          {/* Home */}
          <button
            className={`nav-item ${activePage === 'home' ? 'active' : ''}`}
            onClick={go('home')}
            aria-label="Home"
          >
            <span className="nav-icon">{NAV_ICONS.home}</span>
            <span className="nav-label">Home</span>
          </button>

          {/* Products */}
          <button
            className={`nav-item ${activePage === 'p' ? 'active' : ''}`}
            onClick={go('p')}
            aria-label="Products"
          >
            <span className="nav-icon">{NAV_ICONS.products}</span>
            <span className="nav-label">Shop</span>
          </button>

          {/* Cart */}
          <button
            className={`nav-item ${activePage === 'Cart' ? 'active' : ''}`}
            onClick={go('Cart')}
            aria-label="Cart"
          >
            <span className="nav-icon">{NAV_ICONS.cart}</span>
            <span className="nav-label">Cart</span>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>

          {/* Wishlist */}
          {currentUser && (
            <button
              className={`nav-item ${activePage === 'wishlist' ? 'active' : ''}`}
              onClick={go('wishlist')}
              aria-label="Wishlist"
            >
              <span className="nav-icon">❤️</span>
              <span className="nav-label">Wishlist</span>
            </button>
          )}

          {/* User/Login */}
          {!currentUser ? (
            <button
              className={`nav-item ${activePage === 'login' ? 'active' : ''}`}
              onClick={go('login')}
              aria-label="Login"
            >
              <span className="nav-icon">{NAV_ICONS.login}</span>
              <span className="nav-label">Login</span>
            </button>
          ) : (
            <button
              className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
              onClick={go('account')}
              aria-label="Profile"
            >
              <span className="nav-icon">{NAV_ICONS.user}</span>
              <span className="nav-label">Profile</span>
            </button>
          )}
        </div>
      </nav>
    </nav>
  );
}