import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { addAddress, deleteAddress, getAddresses } from "./addressService";

const emptyAddress = { label: "Home", name: "", phone: "", street: "", city: "", state: "", pincode: "", country: "India", digipin: "" };

export default function CustomerAccount({ currentUser, onPageChange }) {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyAddress);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    setAddresses(getAddresses(currentUser?.email));
  }, [currentUser?.email]);

  const save = (event) => {
    event.preventDefault();
    if (!currentUser) return;
    if (!form.name || !form.phone || !form.street || !form.city || !form.state || !form.pincode) {
      Swal.fire({ icon: "warning", title: "Missing details", text: "Please complete all required address fields." });
      return;
    }
    const next = editingId
      ? addresses.map((item) => item.id === editingId ? { ...item, ...form } : item)
      : [...addresses, addAddress(currentUser.email, form)];
    if (editingId) localStorage.setItem(`addresses_${currentUser.email}`, JSON.stringify(next));
    setAddresses(next);
    setEditingId(null);
    setForm(emptyAddress);
    Swal.fire({ icon: "success", title: editingId ? "Address updated" : "Address saved", timer: 1100, showConfirmButton: false });
  };

  const edit = (address) => {
    setEditingId(address.id);
    setForm({ ...emptyAddress, ...address });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    const result = await Swal.fire({ icon: "warning", title: "Delete address?", showCancelButton: true, confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    deleteAddress(currentUser.email, id);
    setAddresses(getAddresses(currentUser.email));
  };

  if (!currentUser) return null;

  return (
    <div className="container customer-account-page py-4 py-md-5">
      <div className="account-hero mb-4">
        <div className="account-avatar">{currentUser.photoURL ? <img src={currentUser.photoURL} alt="" /> : <i className="bi bi-person"></i>}</div>
        <div>
          <div className="section-kicker">My ShopMaster</div>
          <h1 className="mb-1">{currentUser.name || "My Account"}</h1>
          <p className="mb-0">{currentUser.email}</p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {[
          ["Order history", "Track your purchases", "orderhistory", "bi-box-seam"],
          ["Wishlist", "Your saved products", "wishlist", "bi-heart"],
          ["Cart", "Items ready for checkout", "Cart", "bi-cart3"],
          ["Reviews", "Manage your product reviews", "reviews", "bi-star"],
        ].map(([title, text, route, icon]) => (
          <div className="col-6 col-lg-3" key={route}>
            <button type="button" className="account-link-card w-100 text-start" onClick={() => onPageChange(route)}>
              <i className={`bi ${icon}`}></i><strong>{title}</strong><span>{text}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <section className="account-panel">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div><div className="section-kicker">Delivery</div><h2>Saved addresses</h2></div>
              <span className="badge text-bg-light">{addresses.length}</span>
            </div>
            {addresses.length === 0 ? (
              <div className="account-empty"><i className="bi bi-geo-alt"></i><p>No saved addresses yet.</p><small>Add one here and it will be available during checkout.</small></div>
            ) : addresses.map((address) => (
              <div className="saved-address-card" key={address.id}>
                <div><span className="address-label">{address.label || "Address"}</span><strong>{address.name}</strong><p>{address.street}, {address.city}, {address.state} - {address.pincode}</p><small>{address.phone}{address.digipin ? ` • DIGIPIN ${address.digipin}` : ""}</small></div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => edit(address)}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(address.id)}>Delete</button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="col-lg-5">
          <section className="account-panel">
            <div className="section-kicker">{editingId ? "Update" : "New"}</div>
            <h2>{editingId ? "Edit address" : "Add an address"}</h2>
            <form onSubmit={save} className="account-form">
              <div className="row g-2">
                <div className="col-6"><label>Label</label><select value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}><option>Home</option><option>Work</option><option>Other</option></select></div>
                <div className="col-6"><label>Full name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="col-12"><label>Phone *</label><input inputMode="numeric" maxLength="10" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></div>
                <div className="col-12"><label>Street / house *</label><input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></div>
                <div className="col-6"><label>City *</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div className="col-6"><label>State *</label><input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
                <div className="col-6"><label>PIN *</label><input inputMode="numeric" maxLength="6" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></div>
                <div className="col-6"><label>DIGIPIN</label><input value={form.digipin} onChange={e => setForm({ ...form, digipin: e.target.value.toUpperCase() })} placeholder="Optional" /></div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-primary flex-grow-1" type="submit">{editingId ? "Update address" : "Save address"}</button>
                {editingId && <button className="btn btn-outline-secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyAddress); }}>Cancel</button>}
              </div>
            </form>
          </section>
        </div>
      </div>

      <section className="account-panel mt-4">
        <div className="section-kicker">Account</div>
        <h2>Quick settings</h2>
        <div className="account-settings">
          <div><i className="bi bi-shield-check"></i><span><strong>Google sign-in</strong><small>Your ShopMaster account uses your authenticated Google identity.</small></span></div>
          <div><i className="bi bi-envelope"></i><span><strong>Email</strong><small>{currentUser.email}</small></span></div>
          <div><i className="bi bi-person-check"></i><span><strong>Seller status</strong><small>{currentUser.isSuperAdmin ? "Super admin" : currentUser.isSeller ? "Approved seller" : "Customer account"}</small></span></div>
        </div>
      </section>
    </div>
  );
}
