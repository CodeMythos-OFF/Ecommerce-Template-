import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { applyAsSeller } from "./api";

export default function SellerApplication({ currentUser }) {
  const [form, setForm] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    businessName: "",
    phone: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: currentUser?.name || prev.name,
      email: currentUser?.email || prev.email,
    }));
  }, [currentUser]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      Swal.fire({ icon: "info", title: "Sign in first", text: "Please sign in with Google before applying to become a seller." });
      return;
    }
    setSubmitting(true);
    try {
      const result = await applyAsSeller({
        name: form.name.trim(),
        businessName: form.businessName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      Swal.fire({
        icon: "success",
        title: "Application submitted",
        text: result?.message || "Your seller application has been sent to the super admin for approval.",
        confirmButtonText: "Done",
      });
      setForm((prev) => ({ ...prev, businessName: "", phone: "", address: "" }));
    } catch (error) {
      Swal.fire({ icon: "error", title: "Application failed", text: error.message || "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="seller-application-page">
        <div className="container py-5">
          <div className="seller-application-card seller-login-card">
            <div className="seller-application-icon"><i className="bi bi-shop"></i></div>
            <div className="section-kicker">SELL ON SHOPMASTER</div>
            <h1>Become a seller</h1>
            <p>Sign in first, then submit your business details for review by the ShopMaster super admin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-application-page">
      <div className="container py-4 py-md-5">
        <div className="seller-application-hero">
          <div>
            <div className="section-kicker">SELL ON SHOPMASTER</div>
            <h1>Turn your products into a storefront.</h1>
            <p>Apply to become a seller. Once approved, you can manage your own products and view the orders connected to your products.</p>
          </div>
          <div className="seller-hero-badge"><i className="bi bi-patch-check"></i><span>Approval required</span></div>
        </div>

        <div className="seller-application-layout">
          <form className="seller-application-card" onSubmit={submit}>
            <div className="seller-card-heading">
              <div>
                <div className="section-kicker">APPLICATION</div>
                <h2>Tell us about your business</h2>
              </div>
              <span className="seller-step">01</span>
            </div>

            <div className="seller-form-grid">
              <label>
                <span>Your name</span>
                <input className="form-control" value={form.name} onChange={update("name")} required />
              </label>
              <label>
                <span>Account email</span>
                <input className="form-control" value={form.email} readOnly />
                <small>Applications are tied to your signed-in Google account.</small>
              </label>
              <label className="seller-full">
                <span>Business / brand name</span>
                <input className="form-control" value={form.businessName} onChange={update("businessName")} placeholder="e.g. Nova Electronics" required />
              </label>
              <label>
                <span>Phone number</span>
                <input className="form-control" value={form.phone} onChange={update("phone")} placeholder="Your business contact number" />
              </label>
              <label>
                <span>Business address</span>
                <input className="form-control" value={form.address} onChange={update("address")} placeholder="City, state or full address" />
              </label>
            </div>

            <div className="seller-application-note">
              <i className="bi bi-info-circle"></i>
              <span>Your application will remain pending until the super admin reviews and approves it. Approval does not delete or change your existing customer account.</span>
            </div>

            <button className="btn btn-primary seller-submit-button" type="submit" disabled={submitting}>
              {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</> : <><i className="bi bi-send me-2"></i>Submit seller application</>}
            </button>
          </form>

          <aside className="seller-benefits-card">
            <div className="seller-benefits-icon"><i className="bi bi-shop-window"></i></div>
            <div className="section-kicker">AFTER APPROVAL</div>
            <h2>Your seller workspace</h2>
            <ul>
              <li><i className="bi bi-check2"></i><span>Create and edit your own products.</span></li>
              <li><i className="bi bi-check2"></i><span>Use your business name as your storefront identity.</span></li>
              <li><i className="bi bi-check2"></i><span>See orders that contain your products.</span></li>
              <li><i className="bi bi-check2"></i><span>The super admin can approve or revoke seller access.</span></li>
            </ul>
            <div className="seller-security-note"><i className="bi bi-shield-lock"></i><span>Seller permissions are checked by the backend, not just the browser.</span></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
