// Turns posted sales journals into GSTR-1 documents. Uses the item detail saved with an invoice when present;
// otherwise works it out from the ledger amounts (taxable value, CGST/SGST/IGST, rate).
import { inferRate, type Doc, type Item } from "./gstr1";

export type SrcLine = { dr: number; cr: number; account: string };
export type SrcJournal = {
  id: string; entry_no: string; date: string; type: string; reference_no: string | null;
  party_name: string | null; contact_id: string | null; total: number;
  metadata: Record<string, unknown> | null; lines: SrcLine[];
};
export type SrcContact = { id: string; name: string; gstin: string | null; state: string | null };
export type SavedInvoice = { customer_gstin?: string | null; pos?: string | null; customer_state?: string | null; items: { hsn?: string; desc?: string; uqc?: string; qty?: number; gst_rate: number; taxable: number; igst: number; cgst: number; sgst: number; cess?: number }[] };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const taxKind = (name: string): "igst" | "cgst" | "sgst" | "cess" | null => {
  const n = name.toLowerCase();
  if (/input|itc|\brcm\b|reverse/.test(n)) return null;
  if (/igst/.test(n)) return "igst";
  if (/cgst/.test(n)) return "cgst";
  if (/sgst|utgst/.test(n)) return "sgst";
  if (/cess/.test(n) && /gst/.test(n)) return "cess";
  return null;
};
export const isPartySide = (name: string) => /debtor|receivable|bank|cash|\bhdfc|\bsbi|\bicici|\baxis|\bkotak|upi|wallet/i.test(name);

export function docsFromJournals(journals: SrcJournal[], contacts: SrcContact[]): Doc[] {
  const byId = new Map(contacts.map(c => [c.id, c]));
  const byName = new Map(contacts.map(c => [c.name.trim().toLowerCase(), c]));
  const docs: Doc[] = [];
  for (const j of journals) {
    const kind = j.type === "sales" ? "invoice" : j.type === "credit_note" ? "credit_note" : null;
    if (!kind) continue;
    const c = (j.contact_id && byId.get(j.contact_id)) || (j.party_name ? byName.get(j.party_name.trim().toLowerCase()) : undefined);
    const saved = (j.metadata?.gst_invoice ?? null) as SavedInvoice | null;
    const no = (j.reference_no || j.entry_no).trim();

    let items: Item[];
    let derived = false;
    if (saved?.items?.length) {
      items = saved.items.map(i => ({ hsn: i.hsn ?? null, desc: i.desc ?? null, uqc: i.uqc ?? null, qty: i.qty ?? null, rate: Number(i.gst_rate), taxable: r2(i.taxable), igst: r2(i.igst), cgst: r2(i.cgst), sgst: r2(i.sgst), cess: r2(i.cess ?? 0) }));
    } else {
      // Sales: tax and income are credits. Credit notes reverse them, so read the debit side.
      const side = (l: SrcLine) => kind === "invoice" ? l.cr - l.dr : l.dr - l.cr;
      const t = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
      let taxable = 0;
      for (const l of j.lines) {
        const k = taxKind(l.account);
        if (k) t[k] += side(l);
        else if (!isPartySide(l.account) && side(l) > 0) taxable += side(l);
      }
      const tax = t.igst + t.cgst + t.sgst;
      if (taxable <= 0 && tax <= 0) continue; // not a GST-relevant sale
      const rate = inferRate(taxable, tax);
      items = [{ rate: rate ?? -1, taxable: r2(taxable), igst: r2(t.igst), cgst: r2(t.cgst), sgst: r2(t.sgst), cess: r2(t.cess) }];
      derived = true;
    }
    docs.push({
      kind, no, date: j.date, party: j.party_name ?? c?.name ?? null,
      gstin: saved?.customer_gstin ?? c?.gstin ?? null, partyState: saved?.customer_state ?? c?.state ?? null, pos: saved?.pos ?? null,
      value: r2(j.total), items, derived,
    });
  }
  return docs;
}
