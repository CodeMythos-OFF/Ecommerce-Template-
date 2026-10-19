import React, { useEffect, useState } from "react";
import { getLegalDocument } from "./api";

const DEFAULT_DOCUMENT = {
  title: "Terms of Service",
  content: "These Terms of Service govern your use of the ShopMaster website and services. By using ShopMaster, you agree to follow these terms.\n\n## 1. Using ShopMaster\nYou may use ShopMaster only for lawful purposes and in a way that does not interfere with the website, its users, or its services.\n\n## 2. Accounts\nSome features require an account. You are responsible for providing accurate information and for keeping access to your account secure. Sign-in may be provided through Google or Microsoft.\n\n## 3. Products and Orders\nProduct information, prices, availability, taxes, and shipping details may change. An order is subject to acceptance and availability. ShopMaster may correct errors or cancel an order when necessary.\n\n## 4. Payments and Taxes\nAny applicable taxes or charges will be shown during checkout where supported. Payment processing, when enabled, may be handled by a third-party payment provider under that provider's terms.\n\n## 5. User Content\nIf you submit a review or other content, you should have the right to submit it and must not submit unlawful, misleading, abusive, or infringing material.\n\n## 6. Prohibited Conduct\nDo not attempt to gain unauthorized access, disrupt the service, introduce malicious code, abuse accounts, or use ShopMaster for fraud or other unlawful activity.\n\n## 7. Intellectual Property\nShopMaster's original software, branding, design, and other protected materials belong to their respective owners. You may not copy or redistribute protected material except as permitted by law.\n\n## 8. Third-Party Services\nShopMaster may depend on third-party services such as Google, Microsoft, Vercel, and MongoDB Atlas. Those services have their own terms and privacy policies.\n\n## 9. Availability and Disclaimer\nShopMaster is provided on an “as available” basis. We do not guarantee that the website will always be uninterrupted, error-free, or available.\n\n## 10. Changes\nThese terms may be updated when the service changes. Continued use of ShopMaster after an update means you acknowledge the updated terms.\n\n## 11. Contact\nFor questions about these terms, contact the ShopMaster site operator through the contact method provided on the website.",
  updatedAt: "2026-09-19T00:00:00.000Z"
};

export default function TermsOfService() {
  const [document, setDocument] = useState(DEFAULT_DOCUMENT);

  useEffect(() => {
    let cancelled = false;
    getLegalDocument("terms")
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
