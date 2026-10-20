const money = (v) => `INR ${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const esc = (v) => String(v ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/[\\()]/g, "\\$&");
const wrap = (v, max = 40) => {
  const out = []; let line = "";
  for (const word of String(v || "").split(/\s+/).filter(Boolean)) {
    if ((line + " " + word).trim().length > max && line) { out.push(line); line = word; }
    else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out.length ? out : [""];
};
const txt = (x, y, value, size = 9, color = "0.12 0.16 0.24", bold = false) =>
  `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${esc(value)}) Tj ET`;
const box = (x, y, w, h, color) => `q ${color} rg ${x} ${y} ${w} ${h} re f Q`;
const rule = (x, y, endX, color = "0.87 0.89 0.92") => `q ${color} RG 0.7 w ${x} ${y} m ${endX} ${y} l S Q`;

const renderPage = ({ order, customer, items, start, end, page, pages, last }) => {
  const c = [];
  const put = (...args) => c.push(txt(...args));
  const rect = (...args) => c.push(box(...args));
  const line = (...args) => c.push(rule(...args));
  const a = order.address || {};
  const orderId = order.trackingId || String(order._id || order.id || "N/A");
  const date = order.createdAt ? new Date(order.createdAt) : new Date();
  const navy = "0.08 0.13 0.25", blue = "0.19 0.36 0.75", muted = "0.40 0.45 0.53", ink = "0.12 0.16 0.24";
  // Header
  rect(0, 718, 595, 124, navy);
  rect(40, 779, 36, 36, blue);
  put(50, 789, "S", 22, "1 1 1", true);
  put(87, 798, "SHOPMASTER", 18, "1 1 1", true);
  put(87, 781, "SMART SHOPPING. SIMPLE LIVING.", 7, "0.78 0.83 0.94", true);
  put(410, 800, "INVOICE", 20, "1 1 1", true);
  put(410, 781, `PAGE ${page + 1} / ${pages}`, 8, "0.78 0.83 0.94", true);
  put(40, 749, "ORDER ID", 7, "0.78 0.83 0.94", true);
  put(40, 733, orderId, 11, "1 1 1", true);
  rect(412, 738, 143, 23, "0.16 0.23 0.38");
  put(422, 746, String(order.status || "Order Placed").toUpperCase(), 8, "1 1 1", true);
  // Metadata
  put(40, 691, "ORDER DATE", 7, muted, true); put(40, 674, date.toLocaleDateString("en-IN"), 10, ink, true);
  put(220, 691, "PAYMENT METHOD", 7, muted, true); put(220, 674, order.paymentMethod === "COD" ? "Cash on Delivery" : (order.paymentMethod || "Cash on Delivery"), 9, ink, true);
  put(420, 691, "PAYMENT STATUS", 7, muted, true); put(420, 674, order.paymentStatus || "Pay on delivery", 8, ink, true);
  // Address cards
  rect(40, 548, 248, 104, "0.95 0.97 1"); rect(302, 548, 253, 104, "0.97 0.98 0.99");
  rect(40, 633, 248, 19, "0.86 0.91 1"); rect(302, 633, 253, 19, "0.86 0.91 1");
  put(50, 639, "BILL TO", 8, blue, true); put(312, 639, "DELIVER TO", 8, blue, true);
  put(50, 615, a.name || order.userName || customer.name || "Customer", 9, ink, true);
  wrap(customer.email || order.user || "").slice(0, 2).forEach((s, i) => put(50, 599 - i * 12, s, 8, muted));
  if (a.phone) put(50, 570, `Phone: ${a.phone}`, 8, muted);
  const addressLines = [a.name || order.userName || "Customer", ...wrap(a.street || "", 38), ...wrap([a.city, a.state, a.pincode].filter(Boolean).join(", "), 38), a.country || "India"].filter(Boolean).slice(0, 5);
  addressLines.forEach((s, i) => put(312, 615 - i * 13, s, i ? 8 : 9, i ? muted : ink, i === 0));
  if (a.digipin) put(312, 555, `DIGIPIN: ${a.digipin}`, 7, muted);
  // Item table
  put(40, 522, "ORDER ITEMS", 11, ink, true);
  put(40, 506, "Your purchase summary", 8, muted);
  rect(40, 475, 515, 23, navy);
  put(50, 483, "PRODUCT DESCRIPTION", 8, "1 1 1", true); put(363, 483, "QTY", 8, "1 1 1", true);
  put(405, 483, "UNIT PRICE", 8, "1 1 1", true); put(490, 483, "AMOUNT", 8, "1 1 1", true);
  let y = 454;
  for (let i = start; i < end; i++) {
    const item = items[i], name = String(item.id || item.name || "Product");
    const qty = Math.max(1, Number(item.quantity) || 1), price = Number(item.cost ?? item.price ?? 0);
    const wrapped = wrap(name, 40), h = Math.max(34, wrapped.length * 11 + 18);
    if ((i - start) % 2) rect(40, y - h + 7, 515, h, "0.975 0.98 0.99");
    wrapped.forEach((s, j) => put(50, y - j * 11, s, 9, ink, j === 0));
    put(366, y, qty, 9, ink); put(405, y, money(price), 8, muted); put(490, y, money(price * qty), 8, ink, true);
    y -= h; line(40, y + 7, 555);
  }
  if (last) {
    const top = Math.min(y - 12, 285), bottom = 143;
    put(40, top, "PAYMENT SUMMARY", 9, muted, true);
    put(40, top - 20, `Coupon: ${order.couponCode || "None"}`, 8, muted);
    put(40, top - 38, "Thank you for choosing ShopMaster.", 9, blue, true);
    put(40, top - 53, "This invoice was generated electronically.", 7, muted);
    rect(330, bottom, 225, Math.max(98, top - bottom), "0.95 0.97 1");
    const rows = [["Subtotal", money(order.subtotal)]];
    if (Number(order.discountAmount) > 0) rows.push(["Discount", `-${money(order.discountAmount)}`]);
    rows.push(["Delivery / shipping", money(order.shippingAmount)]);
    if (Number(order.taxAmount) > 0) rows.push(["Tax", money(order.taxAmount)]);
    rows.forEach(([label, value], i) => { put(343, top - 20 - i * 18, label, 8, label === "Discount" ? "0.08 0.48 0.32" : ink); put(535 - value.length * 4.4, top - 20 - i * 18, value, 8, ink); });
    rect(330, 151, 225, 25, blue); put(343, 160, "GRAND TOTAL", 9, "1 1 1", true);
    const total = money(order.total); put(535 - total.length * 4.7, 160, total, 9, "1 1 1", true);
  }
  line(40, 45, 555);
  put(40, 29, "SHOPMASTER  |  ORDER INVOICE", 7, muted, true);
  put(430, 29, `ORDER ${String(orderId).slice(-12)}`, 7, muted);
  return c.join("\n");
};

export const downloadInvoice = (order, customer = {}) => {
  if (!order) throw new Error("Order information is unavailable.");
  const items = Array.isArray(order.cart) && order.cart.length ? order.cart : (order.products || []).map((p) => ({ id: p.name, quantity: p.quantity, cost: p.price }));
  const perPage = 5;
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const streams = [];
  for (let page = 0; page < pageCount; page++) {
    const start = page * perPage, end = Math.min(items.length, start + perPage);
    streams.push(renderPage({ order, customer, items, start, end, page, pages: pageCount, last: page === pageCount - 1 }));
  }
  const objects = [];
  const pageIds = streams.map((_, i) => 4 + i * 2);
  const boldFontId = 4 + pageCount * 2;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  streams.forEach((stream, i) => {
    const pageId = pageIds[i], streamId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  objects[boldFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  for (let i = 1; i < objects.length; i++) { if (!objects[i]) continue; offsets[i] = new TextEncoder().encode(pdf).length; pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += offsets[i] === undefined ? "0000000000 00000 f \n" : `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a"); link.href = url;
  link.download = `ShopMaster-Invoice-${String(order.trackingId || order._id || order.id || "order").replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};
