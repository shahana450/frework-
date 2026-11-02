// An invoice as an A4 PDF, drawn server side (pdf-lib, no browser) — sent on WhatsApp as a document.
// Standard PDF fonts have no rupee sign, so amounts read "Rs.".
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { invoiceTotals, amountInWords, type InvoiceDoc } from "./invoiceDoc";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string) => iso ? iso.slice(0, 10).split("-").reverse().join("-") : "";
// Standard fonts are WinAnsi only: replace what they can't draw
const clean = (s: string) => String(s ?? "").replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export async function invoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title} ${doc.invoiceNo}`); pdf.setProducer("FreBook"); pdf.setCreator("FreBook");
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([595.28, 841.89]);
  const W = 595.28, M = 40, ink = rgb(0.06, 0.14, 0.12), muted = rgb(0.37, 0.42, 0.4), line = rgb(0.82, 0.8, 0.74), green = rgb(0.07, 0.21, 0.18);
  let y = 800;
  const text = (s: string, x: number, yy: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const f = o.f ?? reg, size = o.size ?? 9.5, t = clean(s);
    page.drawText(t, { x: o.right ? x - f.widthOfTextAtSize(t, size) : x, y: yy, size, font: f, color: o.color ?? ink });
  };
  const wrap = (s: string, width: number, f: PDFFont, size: number) => {
    const out: string[] = []; let cur = "";
    for (const w of clean(s).split(/\s+/)) { const t = cur ? cur + " " + w : w; if (f.widthOfTextAtSize(t, size) > width && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  };
  const hr = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.7, color: line });

  // Header: seller left, title and number right
  text(doc.seller.name, M, y, { f: bold, size: 15, color: green });
  text(doc.title.toUpperCase(), W - M, y, { f: bold, size: 13, color: green, right: true });
  y -= 15;
  for (const l of wrap(doc.seller.address, 300, reg, 9)) { text(l, M, y, { size: 9, color: muted }); y -= 11; }
  const sellerBits = [doc.seller.gstin && `GSTIN ${doc.seller.gstin}`, doc.seller.state && `State ${doc.seller.state}`, doc.seller.phone && `Ph ${doc.seller.phone}`].filter(Boolean).join("   ");
  if (sellerBits) { text(sellerBits, M, y, { size: 9, color: muted }); y -= 11; }
  let ry = 785;
  for (const [k, v] of [["Invoice No.", doc.invoiceNo], ["Date", dmy(doc.date)], ["Due date", dmy(doc.dueDate)], ["Place of supply", doc.placeOfSupply]] as const) {
    if (!v) continue; text(`${k}: `, W - M - 150, ry, { size: 9, color: muted }); text(v, W - M, ry, { f: bold, size: 9, right: true }); ry -= 12;
  }
  y = Math.min(y, ry) - 10; hr(y); y -= 16;

  // Bill to
  text("BILL TO", M, y, { f: bold, size: 8.5, color: muted }); y -= 13;
  text(doc.buyer.name || "Cash customer", M, y, { f: bold, size: 11 }); y -= 13;
  for (const l of wrap(doc.buyer.address, 330, reg, 9)) { text(l, M, y, { size: 9, color: muted }); y -= 11; }
  const buyerBits = [doc.buyer.gstin && `GSTIN ${doc.buyer.gstin}`, doc.buyer.state && `State ${doc.buyer.state}`, doc.buyer.phone && `Ph ${doc.buyer.phone}`].filter(Boolean).join("   ");
  if (buyerBits) { text(buyerBits, M, y, { size: 9, color: muted }); y -= 11; }
  y -= 8;

  // Items
  const inter = doc.items.some(i => i.igst > 0);
  const cols = inter
    ? [["#", M, false], ["Description", M + 18, false], ["HSN/SAC", 290, false], ["Qty", 360, true], ["Rate", 410, true], ["GST %", 450, true], ["IGST", 500, true], ["Amount", W - M, true]] as const
    : [["#", M, false], ["Description", M + 18, false], ["HSN/SAC", 270, false], ["Qty", 335, true], ["Rate", 385, true], ["GST %", 420, true], ["CGST", 465, true], ["SGST", 510, true], ["Amount", W - M, true]] as const;
  page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: rgb(0.95, 0.93, 0.88) });
  for (const [h, x, right] of cols) text(h, x, y, { f: bold, size: 8.5, right });
  y -= 18;
  doc.items.forEach((i, k) => {
    if (y < 140) { page = pdf.addPage([595.28, 841.89]); y = 800; }
    const desc = wrap(i.desc || "Item", inter ? 225 : 205, reg, 9);
    const vals = inter
      ? [String(k + 1), "", i.hsn || "", `${i.qty} ${i.unit || ""}`.trim(), money(i.rate), `${i.gstRate}`, money(i.igst), money(i.taxable + i.igst)]
      : [String(k + 1), "", i.hsn || "", `${i.qty} ${i.unit || ""}`.trim(), money(i.rate), `${i.gstRate}`, money(i.cgst), money(i.sgst), money(i.taxable + i.cgst + i.sgst)];
    cols.forEach(([, x, right], c) => { if (c !== 1) text(vals[c], x, y, { size: 9, right }); });
    desc.forEach((d, n) => text(d, M + 18, y - n * 11, { size: 9 }));
    y -= Math.max(1, desc.length) * 11 + 6; hr(y + 3);
  });

  // Totals
  const t = invoiceTotals(doc.items);
  y -= 10;
  const tot = (k: string, v: number, b = false) => { text(k, W - M - 130, y, { f: b ? bold : reg, size: b ? 11 : 9.5 }); text(`Rs. ${money(v)}`, W - M, y, { f: b ? bold : reg, size: b ? 11 : 9.5, right: true }); y -= b ? 16 : 13; };
  tot("Taxable value", t.taxable);
  if (t.igst) tot("IGST", t.igst);
  if (t.cgst) tot("CGST", t.cgst);
  if (t.sgst) tot("SGST", t.sgst);
  if (t.roundOff) tot("Round off", t.roundOff);
  page.drawLine({ start: { x: W - M - 130, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.8, color: ink });
  tot("Total", t.total, true);
  for (const l of wrap(amountInWords(t.total), W - 2 * M, reg, 9)) { text(l, M, y, { size: 9, color: muted }); y -= 11; }
  y -= 8;

  // Bank details, notes, terms, signature
  for (const [k, v] of [["Bank details", doc.bankDetails], ["Notes", doc.notes], ["Terms", doc.terms]] as const) {
    if (!v?.trim() || y < 90) continue;
    text(k.toUpperCase(), M, y, { f: bold, size: 8.5, color: muted }); y -= 12;
    for (const l of v.split("\n").flatMap(p => wrap(p, W - 2 * M - 160, reg, 9))) { text(l, M, y, { size: 9 }); y -= 11; }
    y -= 6;
  }
  text(`For ${doc.seller.name}`, W - M, 90, { f: bold, size: 9.5, right: true });
  text("Authorised signatory", W - M, 60, { size: 8.5, color: muted, right: true });
  text("Made with FreBook · frework.online", M, 30, { size: 7.5, color: muted });
  return pdf.save();
}
