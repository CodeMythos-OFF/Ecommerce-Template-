const money = (value) => `INR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const safeText = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[^\x20-\x7E]/g, "")
  .replace(/[\\()]/g, "\\$&");

const wrapText = (value, max = 76) => {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const createPageStream = (lines) => {
  const commands = ["BT", "/F1 10 Tf", "48 794 Td", "14 TL"];
  let previousY = 794;
  for (const item of lines) {
    if (item.rule) {
      commands.push("ET", "0.75 w", `48 ${item.y} m 547 ${item.y} l S`, "BT", "/F1 10 Tf", `${item.x || 0} ${item.y - 16} Td`, "0 0 Td", "14 TL");
      previousY = item.y - 16;
      continue;
    }
    if (item.newLine) {
      commands.push("T*", `(${safeText(item.text)}) Tj`);
      previousY -= 14;
    } else {
      commands.push(`(${safeText(item.text)}) Tj`);
    }
  }
  commands.push("ET");
  return commands.join("\n");
};

export const downloadInvoice = (order, customer = {}) => {
  if (!order) throw new Error("Order information is unavailable.");
  const orderId = order.trackingId || String(order._id || order.id || "N/A");
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const address = order.address || {};
  const lines = [];
  const add = (text = "") => lines.push({ text, newLine: true });
  const addWrapped = (text) => wrapText(text).forEach(add);

  add("SHOPMASTER");
  add("ORDER INVOICE");
  add(`Invoice / Order ID: ${orderId}`);
  add(`Order date: ${createdAt.toLocaleDateString("en-IN")}`);
  add(`Order status: ${order.status || "Order Placed"}`);
  add("---------------------------------------------------------------");
  add("BILL TO");
  add(address.name || order.userName || customer.name || "Customer");
  add(customer.email || order.user || "");
  add("DELIVER TO");
  add(address.name || order.userName || "Customer");
  addWrapped(address.street || "");
  addWrapped([address.city, address.state, address.pincode].filter(Boolean).join(", "));
  addWrapped(address.country || "India");
  if (address.phone) add(`Phone: ${address.phone}`);
  if (address.digipin) add(`DIGIPIN: ${address.digipin}`);
  add("---------------------------------------------------------------");
  add("ITEMS");
  add("Product                         Qty       Unit price       Amount");
  add("---------------------------------------------------------------");

  const items = Array.isArray(order.cart) && order.cart.length
    ? order.cart
    : (order.products || []).map((p) => ({ id: p.name, quantity: p.quantity, cost: p.price }));
  for (const item of items) {
    const name = String(item.id || item.name || "Product");
    const qty = Math.max(1, Number(item.quantity) || 1);
    const price = Number(item.cost ?? item.price ?? 0);
    const amount = price * qty;
    const nameLines = wrapText(name, 28);
    add(`${nameLines[0].padEnd(30)} ${String(qty).padStart(3)} ${money(price).padStart(15)} ${money(amount).padStart(15)}`);
    for (const extra of nameLines.slice(1)) add(`  ${extra}`);
  }
  add("---------------------------------------------------------------");
  add(`Subtotal: ${money(order.subtotal)}`);
  if (Number(order.discountAmount) > 0) {
    add(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}: -${money(order.discountAmount)}`);
  }
  add(`Delivery / shipping: ${money(order.shippingAmount)}`);
  add(`Tax: ${money(order.taxAmount)}`);
  add(`GRAND TOTAL: ${money(order.total)}`);
  add("");
  add(`Payment method: ${order.paymentMethod || "Cash on Delivery"}`);
  add(`Payment status: ${order.paymentStatus || "Pay on delivery"}`);
  add("Thank you for shopping with ShopMaster!");
  add("This invoice is generated electronically.");

  const chunks = [];
  let pageLines = [];
  for (const line of lines) {
    pageLines.push(line);
    if (pageLines.length >= 48) {
      chunks.push(pageLines);
      pageLines = [];
    }
  }
  if (pageLines.length || !chunks.length) chunks.push(pageLines);

  // Build a small standards-compliant PDF with built-in Helvetica so no extra package is needed.
  const objects = [];
  const pageIds = chunks.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  chunks.forEach((page, index) => {
    const pageId = pageIds[index];
    const streamId = pageId + 1;
    const stream = createPageStream(page);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = new TextEncoder().encode(pdf).length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ShopMaster-Invoice-${String(orderId).replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};
