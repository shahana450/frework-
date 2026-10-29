// Shared Tally utilities — used by both Tally Sync page and Audit page
import { tallyProblem } from "./integrations/tally";

// ── Chrome extension bridge ──────────────────────────────────────────────────
// Track whether the extension has announced itself (used for error messages only)
let _bridgeReady = false;
if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (e.data?.type === "TALLY_BRIDGE_READY") _bridgeReady = true;
  });
}

function tryExtensionBridge(url: string, body: string, timeoutMs: number): Promise<Response> {
  // Always attempt — extension may be present even if READY event was missed
  // (content script fires at document_start, before Next.js loads)
  return new Promise<Response>((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handler);
      const port = url.match(/:(\d+)/)?.[1] ?? "7001";
      reject(new Error(
        _bridgeReady
          ? `Tally did not answer through the Chrome extension. ${tallyProblem(port, "unreachable")}`
          : tallyProblem(port, "unreachable")
      ));
    }, timeoutMs);

    function handler(e: MessageEvent) {
      if (e.data?.type !== "TALLY_BRIDGE_RESPONSE" || e.data.id !== id) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (e.data.ok) resolve(new Response(e.data.text, { status: e.data.status ?? 200 }));
      else reject(new Error(`${e.data.error ?? "Bridge error"} — ${tallyProblem(url.match(/:(\d+)/)?.[1], "unreachable")}`));
    }

    window.addEventListener("message", handler);
    window.postMessage({ type: "TALLY_BRIDGE_REQUEST", id, url, method: "POST", body, timeout: timeoutMs }, "*");
  });
}

// Three ways to reach Tally from the browser: directly, through the FreWork Tally Bridge app (localhost:7002), or
// through the Chrome extension. The one that answered last is tried first with the full wait (a month of vouchers can
// take a while to export); a route that hasn't answered yet only gets a short try, so a dead route never eats the time.
type Route = "direct" | "bridge" | "ext";
let lastGood: Route | null = null;
const PROBE_MS = 8000;

function viaRoute(route: Route, url: string, body: string, ms: number): Promise<Response> {
  if (route === "direct") return fetch(url, { method: "POST", headers: { "Content-Type": "text/xml" }, body, signal: AbortSignal.timeout(ms) });
  if (route === "bridge") {
    const port = url.match(/:(\d+)/)?.[1] ?? "7001";
    return fetch("http://localhost:7002", { method: "POST", headers: { "Content-Type": "text/xml", "X-Tally-Port": port }, body, signal: AbortSignal.timeout(ms) });
  }
  return tryExtensionBridge(url, body, ms);
}

export async function tallyFetch(url: string, body: string, timeoutMs = 15000): Promise<Response> {
  const order: Route[] = lastGood ? [lastGood, ...(["direct", "bridge", "ext"] as Route[]).filter(r => r !== lastGood)] : ["direct", "bridge", "ext"];
  let lastErr: unknown = null;
  for (const route of order) {
    // The proven route gets the whole wait; untested routes a short probe (unless the caller asked for less)
    const ms = route === lastGood ? timeoutMs : Math.min(timeoutMs, PROBE_MS);
    try {
      const res = await viaRoute(route, url, body, ms);
      lastGood = route;
      return res;
    } catch (e) {
      lastErr = e;
      if (route === lastGood) lastGood = null;   // it stopped working; let the others be tried and win
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(tallyProblem(url.match(/:(\d+)/)?.[1], "unreachable"));
}

/** The bridge answers 502 when Tally isn't on the port asked for. Tries the ports Tally is usually set to. */
export async function findTallyPort(body: string, tried: string): Promise<{ port: string; res: Response } | null> {
  for (const port of ["9000", "7001", "9999", "9001"]) {
    if (port === tried) continue;
    try { const res = await tallyFetch(`http://localhost:${port}`, body, 4000); if (res.ok) return { port, res }; } catch { /* next */ }
  }
  return null;
}

export type TallyVoucher = {
  date: string;
  voucherType: string;
  voucherNumber: string;
  narration: string;
  lines: { ledgerName: string; amount: number; isDeemed: boolean }[];
  remoteId?: string | null; guid?: string | null; masterId?: string | null;
};

export function parseTallyVouchers(xml: string): TallyVoucher[] {
  const results: TallyVoucher[] = [];
  const vRe = /<VOUCHER(\s[^>]*)?>([\s\S]*?)<\/VOUCHER>/gi;
  let vm;
  while ((vm = vRe.exec(xml)) !== null) {
    const attrs = vm[1] ?? "", block = vm[2];
    const remoteId = (attrs.match(/REMOTEID="([^"]+)"/i) ?? block.match(/<REMOTEID[^>]*>([^<]+)<\/REMOTEID>/i) ?? [])[1]?.trim() ?? null;
    const guid = (block.match(/<GUID[^>]*>([^<]+)<\/GUID>/i) ?? [])[1]?.trim() ?? null;
    const masterId = (block.match(/<MASTERID[^>]*>([^<]+)<\/MASTERID>/i) ?? [])[1]?.trim() ?? null;
    const rawDate = (block.match(/<DATE[^>]*>([^<]+)<\/DATE>/i) ?? [])[1]?.trim() ?? "";
    let date = "";
    if (/^\d{8}$/.test(rawDate)) date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
    const voucherType = (block.match(/<VOUCHERTYPENAME[^>]*>([^<]+)<\/VOUCHERTYPENAME>/i) ?? [])[1]?.trim() ?? "Journal";
    const voucherNumber = (block.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i) ?? [])[1]?.trim() ?? "";
    const narration = (block.match(/<NARRATION[^>]*>([^<]*)<\/NARRATION>/i) ?? [])[1]?.trim() ?? "";
    const lines: TallyVoucher["lines"] = [];
    // Ledger lines: ALLLEDGERENTRIES (accounting vouchers, party / tax / round-off lines) plus, for item invoices, the
    // purchase / sales ledger inside ALLINVENTORYENTRIES → ACCOUNTINGALLOCATIONS. Tally's sign is the truth: a negative
    // AMOUNT is a debit, a positive one a credit. ISDEEMEDPOSITIVE only decides when the amount carries no sign.
    const entryRe = /<(ALLLEDGERENTRIES|LEDGERENTRIES|ACCOUNTINGALLOCATIONS)\.LIST[^>]*>([\s\S]*?)<\/\1\.LIST>/gi;
    let em;
    while ((em = entryRe.exec(block)) !== null) {
      const eb = em[2];
      const ledgerName = (eb.match(/<LEDGERNAME[^>]*>([^<]+)<\/LEDGERNAME>/i) ?? [])[1]?.trim() ?? "";
      const amtStr = (eb.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i) ?? [])[1]?.trim() ?? "0";
      const raw = parseFloat(amtStr.replace(/,/g, "")) || 0;
      const flag = /Yes/i.test((eb.match(/<ISDEEMEDPOSITIVE[^>]*>([^<]+)<\/ISDEEMEDPOSITIVE>/i) ?? [])[1] ?? "");
      const isDeemed = raw < 0 ? true : raw > 0 ? false : flag;
      const amount = Math.round(Math.abs(raw) * 100) / 100;
      if (ledgerName && amount > 0) lines.push({ ledgerName, amount, isDeemed });
    }
    if (date && lines.length >= 1) results.push({ date, voucherType, voucherNumber, narration, lines, remoteId, guid, masterId });
  }
  return results;
}

export function tallyVoucherTypeToFP(t: string): string {
  const exact: Record<string, string> = {
    "Sales": "sales", "Purchase": "purchase", "Payment": "payment",
    "Receipt": "receipt", "Contra": "contra", "Journal": "journal",
    "Debit Note": "debit_note", "Credit Note": "credit_note",
  };
  if (exact[t]) return exact[t];
  const lower = t.toLowerCase();
  if (lower.includes("sales") || lower.includes("export") || lower.includes("tax invoice")) return "sales";
  if (lower.includes("purchase") || lower.includes("import")) return "purchase";
  if (lower.includes("payment")) return "payment";
  if (lower.includes("receipt")) return "receipt";
  if (lower.includes("debit note") || lower.includes("debit memo")) return "debit_note";
  if (lower.includes("credit note") || lower.includes("credit memo")) return "credit_note";
  return "journal";
}

export function tallyParentToType(parent: string): string {
  const p = parent.toLowerCase();
  // Assets
  if (p.includes("bank") || p.includes("cash") || p.includes("fixed asset") || p.includes("plant") ||
      p.includes("machinery") || p.includes("computer") || p.includes("laptop") || p.includes("furniture") ||
      p.includes("sundry debt") || p.includes("receivable") || p.includes("debtor") ||
      p.includes("current asset") || p.includes("deposit") || p.includes("investment")) return "asset";
  // Loans — separate from asset to distinguish long-term loans given vs. taken
  if (p.includes("loan") && (p.includes("given") || p.includes("advance") || p.includes("staff"))) return "asset";
  // Equity / Capital
  if (p.includes("capital") || p.includes("reserve") || p.includes("equity") || p.includes("proprietor") ||
      p.includes("partner") || p.includes("retained")) return "equity";
  // Income / Revenue
  if (p.includes("sales") || p.includes("income") || p.includes("revenue") ||
      p.includes("indirect income") || p.includes("other income")) return "income";
  // Liabilities
  if (p.includes("current liab") || p.includes("sundry cred") || p.includes("payable") ||
      p.includes("creditor") || p.includes("borrowing") || p.includes("overdraft") ||
      p.includes("loan") || p.includes("provision") || p.includes("duties") || p.includes("tax payable")) return "liability";
  // COGS — purchase accounts and direct expenses (appear above Gross Profit in Tally P&L)
  if (p.includes("purchase") || p.includes("direct expense") || p.includes("cost of goods") ||
      p.includes("trading") || p.includes("cost of sales") || p.includes("raw material") ||
      p.includes("freight inward") || p.includes("carriage inward")) return "purchase";
  // Default: indirect expense
  return "expense";
}

export function monthsInRange(startIso: string, endIso: string): { from: string; to: string; label: string }[] {
  const months: { from: string; to: string; label: string }[] = [];
  let cur = new Date(new Date(startIso).getFullYear(), new Date(startIso).getMonth(), 1);
  const end = new Date(endIso);
  while (cur <= end) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const mFrom = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const mTo = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    months.push({ from: mFrom, to: mTo < endIso ? mTo : endIso, label: cur.toLocaleString("en-IN", { month: "short", year: "2-digit" }) });
    cur = new Date(y, m + 1, 1);
  }
  return months;
}

export const VOUCHER_FETCH_XML = (fd: string, td: string) =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${fd}</SVFROMDATE><SVTODATE>${td}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Vouchers" ISMODIFY="No"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,Narration,AllLedgerEntries,AllInventoryEntries</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
