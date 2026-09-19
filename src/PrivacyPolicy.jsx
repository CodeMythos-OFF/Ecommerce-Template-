import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="container py-5">
        <div className="legal-card">
          <span className="legal-eyebrow">SHOPMASTER</span>
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: September 19, 2026</p>

          <p>
            This Privacy Policy explains how ShopMaster collects, uses, stores, and
            protects information when you use our website and services.
          </p>

          <h2>1. Information We Collect</h2>
          <p>Depending on how you use ShopMaster, we may process:</p>
          <ul>
            <li>Account information such as your name, email address, and profile photo provided by Google or Microsoft sign-in.</li>
            <li>Shopping information such as cart items, orders, delivery addresses, and product reviews.</li>
            <li>Technical information such as browser, device, and basic usage information needed to operate and improve the service.</li>
          </ul>

          <h2>2. How We Use Information</h2>
          <p>We use information to provide and operate ShopMaster, authenticate users, process orders, maintain carts and preferences, provide customer features, prevent misuse, and improve the website.</p>

          <h2>3. Google and Microsoft Sign-In</h2>
          <p>
            If you choose Google or Microsoft sign-in, authentication is handled
            through the selected provider. We receive the account information
            permitted by that provider and use it to create or maintain your
            ShopMaster account.
          </p>

          <h2>4. Storage and Security</h2>
          <p>
            Account and store data may be stored using third-party infrastructure
            providers, including MongoDB Atlas and Vercel. We take reasonable
            measures to protect information, but no internet service can guarantee
            absolute security.
          </p>

          <h2>5. Sharing of Information</h2>
          <p>
            We do not sell personal information. Information may be processed by
            service providers when necessary to operate authentication, hosting,
            databases, or other website functionality.
          </p>

          <h2>6. Cookies and Local Storage</h2>
          <p>
            ShopMaster may use browser storage such as session storage or local
            storage to maintain authentication state, carts, and preferences.
          </p>

          <h2>7. Your Choices</h2>
          <p>
            You can stop using the service at any time. You may also sign out and,
            where applicable, request correction or deletion of information by
            contacting the site operator.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            ShopMaster is not intended to knowingly collect personal information
            from children without appropriate authorization. If you believe a
            child's information has been submitted improperly, please contact the
            site operator.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            This Privacy Policy may be updated as ShopMaster changes. The updated
            version will be posted on this page with a new “Last updated” date.
          </p>

          <h2>10. Contact</h2>
          <p>
            For privacy questions or requests, contact the ShopMaster site
            operator through the contact method provided on the website.
          </p>
        </div>
      </div>
    </div>
  );
}
