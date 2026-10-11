"use client";
// Pushes FreWork journals to the open Tally company — shared by the Books and Journals pages.
import { tallyFetch } from "@/lib/tallyUtils";
import { tallyGuidFor } from "@/lib/tallyMatch";
import { explainTallyError, eduDateOk, parseImportReply } from "@/lib/integrations/tally";

export type PushState = { at: string; guid?: string } | { error: string };

const LEDGER_GROUP: Record<string, string> = {
  asset: "Current Assets", bank: "Bank Accounts", cash: "Cash-in-Hand", liability: "Current Liabilities",
  equity: "Capital Account", income: "Sales Accounts", expense: "Indirect Expenses", purchase: "Purchase Accounts",
  cost_of_goods: "Direct Expenses", tax: "Duties & Taxes", loan: "Loans (Liability)", fixed_asset: "Fixed Assets",
};
const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Push status saved for a business, browser copy merged with the server copy (server wins). */
export async function loadPushStatus(bizId: string): Promise<Record<string, PushState>> {
  let out: Record<string, PushState> = {};
  try { out = JSON.parse(localStorage.getItem(`fw_tally_pushed_${bizId}`) ?? "{}"); } catch { /* */ }
  try {
    const d = await (await fetch(`/api/finance/integrations/sync?business_id=${bizId}&provider=tally`)).json();
    for (const r of (d.rows ?? []) as { journal_id: string; status: string; error: string | null; synced_at: string }[])
      out[r.journal_id] = r.status === "failed" ? { error: r.error ?? "Failed" } : { at: r.synced_at };
  } catch { /* browser copy still works */ }
  return out;
}

/**
 * Live check before any push: is THIS business's Tally company the one open in Tally right now?
 * Returns null when it is, or the reason not to push. Never trusts a stored "connected" flag.
 */
export async function verifyOpenCompany(port: string, company: string): Promise<string | null> {
  const listXml = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
  try {
    const text = await (await tallyFetch(`http://localhost:${port}`, listXml, 8000)).text();
    const open = [...text.matchAll(/<COMPANY[^>]*NAME="([^"]+)"/gi), ...text.matchAll(/<NAME[^>]*>([^<]+)<\/NAME>/gi)].map(m => m[1].trim());
    if (company && open.length && !open.some(n => n.toLowerCase() === company.trim().toLowerCase()))
      return `Not sent: this business is linked to Tally company "${company}", but Tally has ${open.length === 1 ? `"${open[0]}"` : "other companies"} open. Open "${company}" in Tally (or change the link on the Tally page) and push again.`;
    return null;
  } catch {
    return "Not sent: Tally isn't answering right now. Open Tally with your company and check the Tally Bridge is running.";
  }
}

export async function pushToTally(opts: {
  bizId: string; ids: string[]; dates: Record<string, string>; company: string; port: string; educational: boolean;
  onProgress?: (msg: string) => void;
}): Promise<{ results: Record<string, PushState>; ok: number; failed: number; blocked: number; message: string }> {
  const { bizId, company, port, educational, onProgress } = opts;
  const blockedIds = educational ? opts.ids.filter(id => !eduDateOk(opts.dates[id] ?? "")) : [];
  const ids = opts.ids.filter(id => !blockedIds.includes(id));
  const results: Record<string, PushState> = {};
  if (!ids.length) return { results, ok: 0, failed: 0, blocked: blockedIds.length,
    message: `Not sent: Tally is in Educational mode and only accepts entries dated the 1st, 2nd or 31st. Activate your TallyPrime licence (or open a licensed Tally) and push again.` };

  const tallyUrl = `http://localhost:${port}`;
  const live = await verifyOpenCompany(port, company);
  if (live) return { results, ok: 0, failed: 0, blocked: 0, message: live };
  let ok = 0, failed = 0, newLedgers = 0;
  try {
    for (let b = 0; b < ids.length; b += 50) {
      const batch = ids.slice(b, b + 50);
      onProgress?.(`Preparing ${b + 1}–${b + batch.length} of ${ids.length}…`);
      const res = await fetch("/api/finance/tally-push", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journal_ids: batch, business_id: bizId, company_name: company }) });
      const data = await res.json();
      if (!res.ok || !data.vouchers) throw new Error(data.error ?? "Could not prepare vouchers");

      const ledgers = (data.all_ledger_names ?? []) as { name: string; type: string; group?: string }[];
      if (ledgers.length) {
        const masters = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${company ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xmlEsc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>${ledgers.map(l => `<TALLYMESSAGE><LEDGER NAME="${xmlEsc(l.name)}" ACTION="Create"><NAME>${xmlEsc(l.name)}</NAME><PARENT>${xmlEsc(l.group ?? LEDGER_GROUP[l.type] ?? "Indirect Expenses")}</PARENT></LEDGER></TALLYMESSAGE>`).join("")}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
        try { newLedgers += parseInt((await (await tallyFetch(tallyUrl, masters, 15000)).text()).match(/<CREATED>\s*(\d+)/i)?.[1] ?? "0", 10); } catch { /* vouchers report missing ledgers */ }
      }

      for (const v of data.vouchers as { id: string; entry_no: string; xml: string; date: string; opening?: boolean }[]) {
        if (v.opening && !window.confirm(`${v.entry_no} is your opening balances entry. It will SET the opening balance of each ledger in Tally${company ? ` company "${company}"` : ""}, not create a voucher.\n\nDo this only if the Tally company's "Books beginning from" date is ${v.date}.\n\nContinue?`)) {
          results[v.id] = { error: "Skipped — opening balances not sent to Tally." }; failed++; continue;
        }
        onProgress?.(`Pushing ${v.entry_no} (${ok + failed + 1}/${ids.length})…`);
        try {
          const reply = parseImportReply(await (await tallyFetch(tallyUrl, v.xml, 15000)).text());
          if (!reply.ok) { results[v.id] = { error: explainTallyError(reply.error ?? "Tally rejected the voucher", educational) }; failed++; }
          else { results[v.id] = { at: new Date().toISOString(), guid: tallyGuidFor(v.id) } as PushState; ok++; }
        } catch (e) { results[v.id] = { error: e instanceof Error ? e.message : "Network error" }; failed++; }
        await new Promise(r => setTimeout(r, 50));
      }
    }
  } catch (e) {
    return { results, ok, failed, blocked: blockedIds.length, message: e instanceof Error ? e.message : "Push failed" };
  } finally {
    // Save: browser copy + server copy (same status on every device)
    try {
      const key = `fw_tally_pushed_${bizId}`;
      const all = { ...JSON.parse(localStorage.getItem(key) ?? "{}"), ...results };
      localStorage.setItem(key, JSON.stringify(all));
    } catch { /* */ }
    const rows = Object.entries(results).map(([journal_id, s]) => "at" in s ? { journal_id, status: "pushed" as const, external_ref: s.guid ?? null } : { journal_id, status: "failed" as const, error: s.error });
    if (rows.length) fetch("/api/finance/integrations/sync", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: bizId, provider: "tally", target: company, results: rows }) }).catch(() => { /* kept locally */ });
  }
  const ledgerNote = newLedgers ? ` ${newLedgers} new ledger${newLedgers > 1 ? "s" : ""} created in Tally.` : "";
  const heldNote = blockedIds.length ? ` ${blockedIds.length} not sent — Educational mode only accepts the 1st, 2nd and 31st.` : "";
  return { results, ok, failed, blocked: blockedIds.length,
    message: failed ? `${ok} pushed to Tally, ${failed} failed — reasons are shown on each row.${ledgerNote}${heldNote}` : `✓ ${ok} entr${ok === 1 ? "y" : "ies"} pushed to Tally.${ledgerNote}${heldNote}` };
}
