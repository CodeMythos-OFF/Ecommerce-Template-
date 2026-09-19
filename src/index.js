import React, { useState, useEffect } from "react";
import us from './assets/login.json';

import Swal from 'sweetalert2';
var users = JSON.parse(JSON.stringify(us));

// The currently "logged-in" user.
export let user = 'anonymous';

// Utility for showing toast notifications.
export function customalert(message, type) {
  const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    }
  });
  const styledMessage = `<span style="font-family:sans-serif; font-size: 16px;">${message}</span>`;
  Toast.fire({
    icon: type,
    html: styledMessage
  });
}

/**
 * Dispatches a 'cartUpdated' event to notify React components of changes.
 */
function notifyCartUpdate() {
    const newCart = users[user]?.cart ? [...users[user].cart] : [];
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { 
          count: newCart.length, 
          cart: newCart 
      }
    }));
}

/**
 * Adds a product to the user's cart and notifies the app.
 * @param {object} product The product to add.
 */
export function addcart(product) {
    if (user === "anonymous") {
        customalert("Please Login To Add Products To Cart", "error");
        return;
    }
    if (!users?.[user]) {
        customalert("User not found.", "error");
        return;
    }

    if (!Array.isArray(users[user].cart)) {
        users[user].cart = [];
    }

    users[user].cart.push(product);
    customalert(`${product.id} added to cart`, "success");
    notifyCartUpdate();
}

/**
 * Removes one instance of a product from the user's cart and notifies the app.
 * @param {object} product The product to remove.
 */
export function removecart(product) {
    if (!users?.[user]?.cart) return;

    const productIndex = users[user].cart.findIndex(p => p.id === product.id);

    if (productIndex > -1) {
        users[user].cart.splice(productIndex, 1);
        customalert(`${product.id} removed from cart`, "info");
        notifyCartUpdate();
    }
}

export function getCartCount() {
    if (user === "anonymous" || !users || !users[user]) {
        return 0;
    }
    return users[user].cart ? users[user].cart.length : 0;
}

export var cartcount = getCartCount();

export function pageshow(page){
    const pages = ['home', 'p', 'login', 'dashboard', 'Cart', 'pdetails'];
    pages.forEach(p => {
        const pageDiv = document.getElementById(p);
        if (pageDiv) {
            if (p === page) {
                pageDiv.classList.add('active');
            } else {
                pageDiv.classList.remove('active');
            }
        }
    });
}

export function useCartUpdater(setCartItems) {
    useEffect(() => {
        const onCartUpdated = (e) => {
            const newCart = e?.detail?.cart ?? (users && users[user] ? users[user].cart : []);
            setCartItems(Array.isArray(newCart) ? [...newCart] : []);
        };
        window.addEventListener('cartUpdated', onCartUpdated);
        return () => window.removeEventListener('cartUpdated', onCartUpdated);
    }, [setCartItems]);
} 

export const removeFromCartLocal = (product) => {
    if (user === "anonymous" || !users[user] || !Array.isArray(users[user].cart)) {
        return;
    }
    try {
        const idx = users[user].cart.findIndex((p) => p.id === product.id);
        if (idx > -1) {
            users[user].cart.splice(idx, 1);
            window.dispatchEvent(
                new CustomEvent("cartUpdated", { detail: { cart: users[user].cart } })
            );
        }
    } catch (e) {
        console.error(e);
    }
};

export const addToCartLocal = (product) => {
    if (user === "anonymous" || !users[user]) {
        alert("Please log in to add items to the cart.");
        return;
    }
    try {
        users[user].cart = users[user].cart || [];
        users[user].cart.push(product);
        window.dispatchEvent(
            new CustomEvent("cartUpdated", { detail: { cart: users[user].cart } })
        );
    } catch (e) {
        console.error(e);
    }
};
