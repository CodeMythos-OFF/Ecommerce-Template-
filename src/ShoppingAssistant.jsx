import React, { useState } from "react";
import "./ShoppingAssistant.css";

const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000/api" : "/api";

export default function ShoppingAssistant({ products = [], onShowDetails }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! Tell me what you're shopping for, your budget, or the features you need. I can suggest products from the current ShopMaster catalog." }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (event) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
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
          <div><strong>ShopMaster AI</strong><small>Shopping help · Catalog-aware</small></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
        </header>
        <div className="sm-assistant-messages" aria-live="polite">
          {messages.map((message, index) => <div key={index} className={`sm-assistant-message ${message.role}`}>{message.content}</div>)}
          {busy && <div className="sm-assistant-message assistant">Finding helpful suggestions…</div>}
          {error && <div className="sm-assistant-error">{error}</div>}
        </div>
        <form onSubmit={send} className="sm-assistant-form">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder="e.g. best electronics under ₹5000" aria-label="Ask shopping assistant" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">➤</button>
        </form>
        <p className="sm-assistant-note">Suggestions are informational; confirm price and stock on the product page.</p>
      </section>}
      <button type="button" className="sm-assistant-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span aria-hidden="true">✦</span> {open ? "Close assistant" : "Ask ShopMaster AI"}
      </button>
    </div>
  );
}