// Shared Tally utilities — used by both Tally Sync page and Audit page

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
      reject(new Error(
        _bridgeReady
          ? "Tally did not respond via Chrome extension."
          : "Cannot reach Tally. Run the FreWork Tally Bridge app, or install the Chrome Extension."
      ));
    }, Math.min(timeoutMs, 8000));

    function handler(e: MessageEvent) {
      if (e.data?.type !== "TALLY_BRIDGE_RESPONSE" || e.data.id !== id) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (e.data.ok) resolve(new Response(e.data.text, { status: e.data.status ?? 200 }));
      else reject(new Error(e.data.error ?? "Bridge error"));
    }

    window.addEventListener("message", handler);
    window.postMessage({ type: "TALLY_BRIDGE_REQUEST", id, url, method: "POST", body, timeout: timeoutMs }, "*");
  });
}

export function tallyFetch(url: string, body: string, timeoutMs = 15000): Promise<Response> {
  const opts = { method: "POST", headers: { "Content-Type": "text/xml" }, body, signal: AbortSignal.timeout(timeoutMs) };
  return fetch(url, opts)
    .catch(() => {
      // Try desktop bridge proxy (localhost:7002 — Chrome allows localhost on HTTPS)
      const port = url.match(/:(\d+)/)?.[1] ?? "7001";
      return fetch("http://localhost:7002", { method: "POST", headers: { "Content-Type": "text/xml", "X-Tally-Port": port }, body, signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)) });
    })
    .catch(() => {
      // Try Chrome extension bridge (works even without the bridge app)
      return tryExtensionBridge(url, body, timeoutMs);
    });
}

export type TallyVoucher = {
  date: string;
  voucherType: string;
  voucherNumber: string;
  narration: string;
  lines: { ledgerName: string; amount: number; isDeemed: boolean }[];
};

export function parseTallyVouchers(xml: string): TallyVoucher[] {
  const results: TallyVoucher[] = [];
  const vRe = /<VOUCHER[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let vm;
  while ((vm = vRe.exec(xml)) !== null) {
    const block = vm[1];
    const rawDate = (block.match(/<DATE[^>]*>([^<]+)<\/DATE>/i) ?? [])[1]?.trim() ?? "";
    let date = "";
    if (/^\d{8}$/.test(rawDate)) date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
    const voucherType = (block.match(/<VOUCHERTYPENAME[^>]*>([^<]+)<\/VOUCHERTYPENAME>/i) ?? [])[1]?.trim() ?? "Journal";
    const voucherNumber = (block.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i) ?? [])[1]?.trim() ?? "";
    const narration = (block.match(/<NARRATION[^>]*>([^<]*)<\/NARRATION>/i) ?? [])[1]?.trim() ?? "";
    const lines: TallyVoucher["lines"] = [];
    const entryRe = /<ALLLEDGERENTRIES\.LIST[^>]*>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi;
    let em;
    while ((em = entryRe.exec(block)) !== null) {
      const eb = em[1];
      const ledgerName = (eb.match(/<LEDGERNAME[^>]*>([^<]+)<\/LEDGERNAME>/i) ?? [])[1]?.trim() ?? "";
      const amtStr = (eb.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i) ?? [])[1]?.trim() ?? "0";
      const isDeemed = /Yes/i.test((eb.match(/<ISDEEMEDPOSITIVE[^>]*>([^<]+)<\/ISDEEMEDPOSITIVE>/i) ?? [])[1] ?? "");
      const amount = Math.abs(parseFloat(amtStr) || 0);
      if (ledgerName && amount > 0) lines.push({ ledgerName, amount, isDeemed });
    }
    if (date && lines.length >= 1) results.push({ date, voucherType, voucherNumber, narration, lines });
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

export function tallyParentToType(parent: string): "asset" | "liability" | "equity" | "income" | "expense" {
  const p = parent.toLowerCase();
  if (p.includes("bank") || p.includes("cash") || p.includes("fixed asset") || p.includes("plant") ||
      p.includes("machinery") || p.includes("computer") || p.includes("laptop") || p.includes("furniture") ||
      p.includes("sundry debt") || p.includes("receivable") || p.includes("debtor") ||
      p.includes("current asset") || p.includes("loan") || p.includes("deposit") || p.includes("investment")) return "asset";
  if (p.includes("capital") || p.includes("reserve") || p.includes("equity") || p.includes("proprietor") ||
      p.includes("retained")) return "equity";
  if (p.includes("sales") || p.includes("income") || p.includes("revenue") || p.includes("interest income")) return "income";
  if (p.includes("current liab") || p.includes("sundry cred") || p.includes("payable") ||
      p.includes("creditor") || p.includes("borrowing") || p.includes("overdraft")) return "liability";
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
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${fd}</SVFROMDATE><SVTODATE>${td}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Vouchers" ISMODIFY="No"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,Narration,AllLedgerEntries</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
