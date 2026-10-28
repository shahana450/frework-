// Tally provider: everything Tally-specific (XML formats, reply parsing, group mapping) lives here.
// Pure functions — usable on the server (building vouchers) and in the browser (talking to the local bridge).
import { tallyGroupFor, type LedgerHead, headByKey } from "../ledgerHeads";

export const xmlEsc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const xmlDec = (s: string) => String(s ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
const tallyDate = (iso: string) => (iso || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
const companyVar = (company?: string | null) => company ? `<SVCURRENTCOMPANY>${xmlEsc(company)}</SVCURRENTCOMPANY>` : "";

// ── Requests ────────────────────────────────────────────────────────────────
export const companiesXml = () =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_AllCo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_AllCo" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export const licenseXml = () =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Lic</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Lic" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name</FETCH><COMPUTE>FPEdu:$$LicenseInfo:IsEducationalMode</COMPUTE></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export const ledgersXml = (company?: string | null) =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Led</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyVar(company)}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Led" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export const vouchersXml = (fromIso: string, toIso: string, company?: string | null) =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES>${companyVar(company)}<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${tallyDate(fromIso)}</SVFROMDATE><SVTODATE>${tallyDate(toIso)}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Vouchers" ISMODIFY="No"><TYPE>Voucher</TYPE><FETCH>Date,VoucherTypeName,VoucherNumber,Narration,AllLedgerEntries</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export function ledgerMastersXml(ledgers: { name: string; group: string }[], company?: string | null): string {
  const msgs = ledgers.map(l => `<TALLYMESSAGE><LEDGER NAME="${xmlEsc(l.name)}" ACTION="Create"><NAME.LIST><NAME>${xmlEsc(l.name)}</NAME></NAME.LIST><PARENT>${xmlEsc(l.group)}</PARENT></LEDGER></TALLYMESSAGE>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${company ? `<STATICVARIABLES>${companyVar(company)}</STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>${msgs}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

// ── Pushing FreWork entries ─────────────────────────────────────────────────
export type PushLine = { dr: number; cr: number; account: { name: string; type: string; sub_type: string | null } | null };
export type PushEntry = { id?: string; entry_no: string; date: string; narration: string; type: string; lines: PushLine[] };

// Sales / Purchase / Credit Note / Debit Note go in as accounting-mode vouchers (no stock items), with the party marked
const VOUCHER_TYPE: Record<string, string> = {
  journal: "Journal", payment: "Payment", receipt: "Receipt", contra: "Contra",
  sales: "Sales", purchase: "Purchase", expense: "Payment", debit_note: "Debit Note", credit_note: "Credit Note",
};
const isCashBank = (a: PushLine["account"]) => !!a && (["bank", "cash"].includes(a.type) || ["bank", "cash"].includes(a.sub_type ?? "") || ["Bank Accounts", "Cash-in-Hand"].includes(tallyGroupFor(a.name, a.type, a.sub_type)));
const isParty = (a: PushLine["account"]) => !!a && (isCashBank(a) || ["debtor", "creditor"].includes(a.type) || ["trade_receivables", "trade_payables"].includes(a.sub_type ?? "")
  || ["Sundry Debtors", "Sundry Creditors"].includes(tallyGroupFor(a.name, a.type, a.sub_type)));
/** The party side: who is billed (sales, debit note) or who bills us (purchase, credit note). */
const partySide: Record<string, "dr" | "cr"> = { Sales: "dr", "Debit Note": "dr", Purchase: "cr", "Credit Note": "cr" };

/** A FreWork entry as a Tally voucher. The narration carries [FW entry-no] so it can be found again. */
export function voucherXml(e: PushEntry, company?: string | null): string {
  let vtype = VOUCHER_TYPE[e.type] ?? "Journal";
  if ((vtype === "Payment" || vtype === "Receipt") && !e.lines.some(l => isCashBank(l.account))) vtype = "Journal";
  // A Sales / Purchase / note voucher needs exactly one party (customer, supplier, cash or bank) on its side; otherwise Journal
  const side = partySide[vtype];
  const parties = side ? e.lines.filter(l => (side === "dr" ? l.dr : l.cr) > 0 && isParty(l.account)) : [];
  if (side && parties.length !== 1) vtype = "Journal";
  const party = partySide[vtype] ? parties[0] : null;
  const entries = e.lines.flatMap(l => {
    const name = xmlEsc(l.account?.name ?? "Suspense A/c");
    const isP = l === party ? "Yes" : "No";
    const out: string[] = [];
    if (l.dr > 0) out.push(`<ALLLEDGERENTRIES.LIST><LEDGERNAME>${name}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>${isP}</ISPARTYLEDGER><AMOUNT>-${Number(l.dr).toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`);
    if (l.cr > 0) out.push(`<ALLLEDGERENTRIES.LIST><LEDGERNAME>${name}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>${isP}</ISPARTYLEDGER><AMOUNT>${Number(l.cr).toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`);
    return out;
  }).join("");
  const partyXml = party?.account?.name ? `<PARTYLEDGERNAME>${xmlEsc(party.account.name)}</PARTYLEDGERNAME>` : "";
  const narration = xmlEsc(`${(e.narration ?? "").replace(/[₹—]/g, "").slice(0, 80)} [FW ${e.entry_no}]`);
  return `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME>${company ? `<STATICVARIABLES>${companyVar(company)}</STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER${e.id ? ` REMOTEID="frework-${e.id}"` : ""} VCHTYPE="${vtype}" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${tallyDate(e.date)}</DATE><EFFECTIVEDATE>${tallyDate(e.date)}</EFFECTIVEDATE><ISINVOICE>No</ISINVOICE><VOUCHERTYPENAME>${vtype}</VOUCHERTYPENAME>${partyXml}<NARRATION>${narration}</NARRATION>${entries}</VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

/**
 * FreWork's opening-balance entry as Tally expects it: an Opening Balance on each ledger master (Dr negative, Cr positive),
 * not a voucher. Tally applies it from the company's "Books beginning from" date. Ledgers are created first by the caller.
 */
export function openingBalancesXml(lines: PushLine[], company?: string | null): string {
  const net = new Map<string, number>();
  for (const l of lines) if (l.account?.name) net.set(l.account.name, Math.round(((net.get(l.account.name) ?? 0) + (Number(l.dr) || 0) - (Number(l.cr) || 0)) * 100) / 100);
  const msgs = [...net].map(([name, bal]) => `<TALLYMESSAGE><LEDGER NAME="${xmlEsc(name)}" ACTION="Alter"><NAME>${xmlEsc(name)}</NAME><OPENINGBALANCE>${(-bal).toFixed(2)}</OPENINGBALANCE></LEDGER></TALLYMESSAGE>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${company ? `<STATICVARIABLES>${companyVar(company)}</STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>${msgs}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

// ── Reading Tally's replies ─────────────────────────────────────────────────
export function parseImportReply(text: string): { ok: boolean; created: number; error: string | null } {
  const created = parseInt(text.match(/<CREATED>\s*(\d+)/i)?.[1] ?? "0", 10) + parseInt(text.match(/<ALTERED>\s*(\d+)/i)?.[1] ?? "0", 10);
  const lineErr = text.match(/<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/i)?.[1];
  const failed = !!lineErr || (!created && (/<ERRORS>\s*[1-9]/i.test(text) || /<EXCEPTIONS>\s*[1-9]/i.test(text)));
  return { ok: !failed, created, error: failed ? xmlDec(lineErr ?? "Tally rejected the voucher") : null };
}

export const isEducational = (licenseReply: string) => /<FPEDU[^>]*>\s*Yes/i.test(licenseReply);
// Tally replies in different shapes by version: <COMPANY NAME="X">, <COMPANY><NAME>X</NAME></COMPANY>, or the current company
export const companiesFrom = (reply: string) => {
  const names = new Set<string>();
  for (const m of reply.matchAll(/<COMPANY\b[^>]*\bNAME="([^"]+)"/gi)) names.add(xmlDec(m[1]).trim());
  for (const blk of reply.matchAll(/<COMPANY\b[^>]*>([\s\S]*?)<\/COMPANY>/gi))
    for (const m of blk[1].matchAll(/<(NAME|COMPANYNAME|BASICCOMPANYNAME)\b[^>]*>([^<]+)<\/\1>/gi)) names.add(xmlDec(m[2]).trim());
  for (const m of reply.matchAll(/<SVCURRENTCOMPANY\b[^>]*>([^<]+)</gi)) names.add(xmlDec(m[1]).trim());
  return [...names].filter(Boolean);
};
export const ledgersFrom = (reply: string) => [...reply.matchAll(/<LEDGER NAME="([^"]+)"[\s\S]*?<PARENT[^>]*>([^<]*)</gi)].map(m => ({ name: xmlDec(m[1]), parent: xmlDec(m[2]) }));

/** Educational (unlicensed) TallyPrime accepts only these days of the month. */
export const eduDateOk = (date: string) => ["01", "02", "31"].includes(String(date).slice(8, 10));

/**
 * Every Tally connection problem names the port in the box and says what to check.
 * unreachable: neither Tally nor the bridge answered; bridge502: the bridge (port 7002) answered but Tally isn't on `port`;
 * http: Tally answered with an HTTP error.
 */
export function tallyProblem(port: string | number | null | undefined, kind: "unreachable" | "bridge502" | "http", status?: number): string {
  const p = String(port ?? "").replace(/\D/g, "") || "7001";
  const settings = `In Tally: F1 → Settings → Connectivity → "TallyPrime acts as" Both, port ${p} (or type Tally's port in the Port box)`;
  if (kind === "bridge502") return `The FreWork Tally Bridge is running, but Tally isn't answering on port ${p}. ${settings}, and open a company.`;
  if (kind === "http") return `Tally on port ${p} answered HTTP ${status ?? "error"}. Check that a company is open in Tally and try again.`;
  return `Can't reach Tally on port ${p}. Check: Tally is open with a company loaded; ${settings}; the FreWork Tally Bridge window is open (it uses port 7002).`;
}

export function explainTallyError(raw: string, educational: boolean, port?: string | number | null): string {
  if (/voucher date is missing/i.test(raw)) return educational
    ? "Tally is in Educational mode — it only accepts dates on the 1st, 2nd or 31st. Activate your TallyPrime licence and push again."
    : "Tally rejected the date — check the company's books-beginning date and current period in Tally.";
  if (/ledger .* does not exist|could not find ledger/i.test(raw)) return `${raw} — the ledger couldn't be created in Tally; check its name for special characters.`;
  if (/network|failed to fetch|timeout|abort|can't reach tally/i.test(raw)) return tallyProblem(port, "unreachable");
  return raw;
}

// ── Importing Tally vouchers ────────────────────────────────────────────────
/** Maps a Tally group (primary or common sub-group) to a FreWork ledger head. */
export function headForTallyGroup(parent: string): LedgerHead | null {
  const p = parent.toLowerCase();
  const key =
    /bank (accounts|od)|bank occ/.test(p) ? "bank" : /cash-in-hand|cash in hand/.test(p) ? "cash" :
    /sundry debtors/.test(p) ? "debtors" : /sundry creditors/.test(p) ? "creditors" :
    /duties & taxes|duties and taxes/.test(p) ? "duties" : /fixed assets/.test(p) ? "fixed_asset" :
    /capital account|reserves/.test(p) ? "capital" : /loans \(liability\)|secured loans|unsecured loans/.test(p) ? "loan" :
    /loans & advances|deposits/.test(p) ? "advances" : /current assets|stock-in-hand|investments/.test(p) ? "current_asset" :
    /current liabilities|provisions/.test(p) ? "current_liability" : /sales accounts/.test(p) ? "sales" :
    /purchase accounts/.test(p) ? "purchase" : /direct expenses/.test(p) ? "direct_expense" :
    /indirect expenses/.test(p) ? "indirect_expense" : /direct incomes|indirect incomes/.test(p) ? "indirect_income" : null;
  return key ? headByKey(key) ?? null : null;
}

/** Stable FreWork entry number for a Tally voucher, so re-imports are skipped. */
export const importEntryNo = (v: { voucherType: string; voucherNumber: string; date: string }, fallbackSeq: number) =>
  `TLY-${v.voucherNumber?.trim() ? `${v.voucherType} ${v.voucherNumber.trim()}` : `${v.voucherType}-${v.date.replace(/-/g, "")}-${fallbackSeq}`}`;
