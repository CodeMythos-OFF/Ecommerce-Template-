import React, { useState } from "react";
import "./ShoppingAssistant.css";

const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000/api" : "/api";
const normalize = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hasAny = (text, phrases) => phrases.some((phrase) => text.includes(phrase));

export default function ShoppingAssistant({ products = [], onShowDetails, onAddToCart, onGoToCart }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! Tell me what you're shopping for, your budget, or the features you need. I can suggest products from the current ShopMaster catalog, add a clearly identified product to your cart, and take you to checkout to review your order." }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const runLocalAction = (content) => {
    const query = normalize(content);
    const addIntent = hasAny(query, ["add ", "put ", "include ", "buy ", "get "]) && hasAny(query, ["cart", "basket", "buy", "get", "add", "put", "include"]);
    const checkoutIntent = hasAny(query, ["checkout", "place order", "buy now", "order these", "proceed to order", "go to cart"]);

    if (addIntent) {
      const terms = query.split(" ").filter((word) => word.length > 2 && !["add", "please", "into", "cart", "basket", "put", "include", "buy", "get", "the", "for", "me", "one", "item", "product", "to"].includes(word));
      const ranked = products.map((product) => {
        const id = normalize(product.id);
        const searchable = normalize([product.id, product.brand, product.sellerBusinessName, product.category, product.description].join(" "));
        const score = terms.reduce((total, term) => total + (searchable.includes(term) ? (id.includes(term) ? 4 : 1) : 0), 0);
        return { product, score, idMatch: terms.some((term) => id.includes(term)) };
      }).sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const second = ranked[1];
      if (best && best.product && best.score > 0 && (best.idMatch || best.score >= 2) && (!second || best.score > second.score || best.idMatch)) {
        if (Number(best.product.stock ?? 0) <= 0) {
          setMessages((current) => [...current, { role: "assistant", content: `“${best.product.id}” is currently out of stock, so I did not add it.` }]);
          return true;
        }
        if (typeof onAddToCart === "function") {
          onAddToCart(best.product);
          setMessages((current) => [...current, { role: "assistant", content: `I sent “${best.product.id}” to your cart action. Check the cart to confirm it was added. You can ask me to open the cart or checkout next.` }]);
          return true;
        }
      }
      setMessages((current) => [...current, { role: "assistant", content: "I couldn't confidently identify one exact catalog product to add. Please use the product's exact name as shown in ShopMaster, then ask me again." }]);
      return true;
    }

    if (checkoutIntent) {
      if (typeof onGoToCart === "function") onGoToCart();
      setMessages((current) => [...current, { role: "assistant", content: "I've opened your cart. Please review the items, delivery location, and total, then confirm checkout yourself. I won't submit an order without your review and confirmation. ShopMaster currently supports Cash on Delivery only and does not accept returns." }]);
      return true;
    }
    return false;
  };

  const send = async (event) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");

    // Cart navigation and add-to-cart commands must work even when an AI provider is down.
    if (runLocalAction(content)) return;

    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-8).map(({ role, content: text }) => ({ role, content: text })),
          products: products.slice(0, 40).map((p) => ({ id: p.id, brand: p.brand || p.sellerBusinessName, category: p.category, description: p.description, cost: p.cost, stock: p.stock, averageRating: p.averageRating }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The shopping assistant is temporarily unavailable.");
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message || "Could not reach the shopping assistant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm-assistant">
      {open && <section className="sm-assistant-panel" aria-label="ShopMaster shopping assistant">
        <header className="sm-assistant-header">
          <div><strong>ShopMaster AI</strong><small>Shopping help · Catalog-aware · Cart actions</small></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
        </header>
        <div className="sm-assistant-messages" aria-live="polite">
          {messages.map((message, index) => <div key={index} className={`sm-assistant-message ${message.role}`}>{message.content}</div>)}
          {busy && <div className="sm-assistant-message assistant">Finding helpful suggestions…</div>}
          {error && <div className="sm-assistant-error">{error}</div>}
        </div>
        <form onSubmit={send} className="sm-assistant-form">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder="e.g. add Headphones to my cart" aria-label="Ask shopping assistant" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">➤</button>
        </form>
        <p className="sm-assistant-note">You must review and confirm checkout yourself. Cash on Delivery only; no returns.</p>
      </section>}
      <button type="button" className="sm-assistant-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span aria-hidden="true">✦</span> {open ? "Close assistant" : "Ask ShopMaster AI"}
      </button>
    </div>
  );
}