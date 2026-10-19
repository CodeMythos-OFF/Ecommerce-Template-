import React, { useEffect, useState } from "react";
import { getLegalDocument } from "./api";

const DEFAULT_DOCUMENT = {
  title: "Privacy Policy",
  content: "This Privacy Policy explains how ShopMaster collects, uses, stores, and protects information when you use our website and services.\n\n## 1. Information We Collect\nDepending on how you use ShopMaster, we may process account information such as your name, email address, and profile photo provided by Google sign-in; shopping information such as cart items, orders, delivery addresses, and product reviews; and technical information such as browser, device, and basic usage information needed to operate and improve the service.\n\n## 2. How We Use Information\nWe use information to provide and operate ShopMaster, authenticate users, process orders, maintain carts and preferences, provide customer features, prevent misuse, and improve the website.\n\n## 3. Google Sign-In\nIf you choose Google sign-in, authentication is handled through Google. We receive the account information permitted by that provider and use it to create or maintain your ShopMaster account.\n\n## 4. Storage and Security\nAccount and store data may be stored using third-party infrastructure providers, including MongoDB Atlas and Vercel. We take reasonable measures to protect information, but no internet service can guarantee absolute security.\n\n## 5. Sharing of Information\nWe do not sell personal information. Information may be processed by service providers when necessary to operate authentication, hosting, databases, or other website functionality.\n\n## 6. Cookies and Local Storage\nShopMaster uses an HttpOnly session cookie for authentication and may use browser storage for cart items and preferences. The session cookie is not readable by page JavaScript.\n\n## 7. Your Choices\nYou can stop using the service at any time. You may also sign out and, where applicable, request correction or deletion of information by contacting the site operator.\n\n## 8. Children's Privacy\nShopMaster is not intended to knowingly collect personal information from children without appropriate authorization. If you believe a child's information has been submitted improperly, please contact the site operator.\n\n## 9. Changes to This Policy\nThis Privacy Policy may be updated as ShopMaster changes. The updated version will be posted on this page with a new “Last updated” date.\n\n## 10. Contact\nFor privacy questions or requests, contact the ShopMaster site operator through the contact method provided on the website.",
  updatedAt: "2026-09-19T00:00:00.000Z"
};

export default function PrivacyPolicy() {
  const [document, setDocument] = useState(DEFAULT_DOCUMENT);

  useEffect(() => {
    let cancelled = false;
    getLegalDocument("privacy")
      .then((latest) => {
        if (!cancelled && latest?.title && latest?.content) setDocument(latest);
      })
      .catch(() => {
        // Keep the built-in copy available if the API is temporarily offline.
      });
    return () => { cancelled = true; };
  }, []);

  const updatedLabel = document.updatedAt
    ? new Date(document.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "September 19, 2026";

  return (
    <div className="legal-page">
      <div className="container py-5">
        <article className="legal-card">
          <span className="legal-eyebrow">SHOPMASTER</span>
          <h1>{document.title}</h1>
          <p className="legal-updated">Last updated: {updatedLabel}</p>
          {document.content.split(/\r?\n/).map((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith("## ")) return <h2 key={index}>{trimmed.slice(3)}</h2>;
            if (trimmed.startsWith("- ")) return <p key={index} className="legal-list-item">• {trimmed.slice(2)}</p>;
            return <p key={index}>{trimmed}</p>;
          })}
        </article>
      </div>
    </div>
  );
}
