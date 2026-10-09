// FreBook's deterministic gate between the AI's proposed draft and anything shown as postable.
// The AI proposes; this code decides. Pure — no AI provider, no database.
//   B3  entity resolution, no silent ledger creation, narration fidelity, status from rules (not model %), synonyms
//   B4  more amounts in the message than transactions drafted
//   B10 GST lines for a business without a GSTIN
//   B18 instruction-like text ("system override … post without confirmation")

export type DraftLine = { account: string; debit: number; credit: number; is_new_account?: boolean; suggested_type?: string | null };
export type Draft = { lines: DraftLine[]; narrative?: string; party_name?: string | null };
export type Ledger = { name: string; type?: string; sub_type?: string | null };
export type Question = { text: string; options?: string[]; field?: string };
export type Verdict = {
  status: "ready" | "needs_review" | "blocked";
  lines: DraftLine[];                      // with canonical ledger names
  narration: string;                       // only the user's own facts
  newLedgers: string[];                    // must be confirmed one by one before posting
  assumptions: string[];                   // shown under "Needs review"
  questions: Question[];                   // must be answered before posting
  blocked: string[];                       // reasons nothing can be posted
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// ── Synonyms: many ways of saying one ledger ────────────────────────────────
const SYNONYMS: [RegExp, string][] = [
  [/^(office |shop |store |godown |warehouse |building )?rent( expenses?| paid| a c| account)?$/, "Rent"],
  [/^(electricity|power|current|kseb|eb)( bill| charges| expenses?)?$/, "Electricity Charges"],
  [/^(salary|salaries|staff salary|wages and salary)( expenses?| paid| a c)?$/, "Salaries"],
  [/^(telephone|phone|mobile|internet|broadband)( and internet)?( bill| charges| expenses?)?$/, "Telephone & Internet"],
  [/^(bank charges?|bank fees?|bank commission)( a c)?$/, "Bank Charges"],
  [/^(cash|cash in hand|cash a c|petty cash)$/, "Cash"],
  [/^(sales?|sales a c|sales account|revenue)$/, "Sales"],
  [/^(purchases?|purchase a c|purchase account)$/, "Purchases"],
  [/^(travel|travelling|traveling|conveyance)( expenses?| charges)?$/, "Travelling Expenses"],
];
/** The one canonical name for a ledger phrase (or the phrase itself when nothing matches). */
export function canonicalName(name: string): string {
  const n = norm(name);
  for (const [re, canon] of SYNONYMS) if (re.test(n)) return canon;
  return name.trim();
}
const canonKey = (s: string) => norm(canonicalName(s));

const isBankish = (l: { name?: string; account?: string; sub_type?: string | null; type?: string; suggested_type?: string | null }) => {
  const nm = norm(l.name ?? l.account ?? "");
  return l.sub_type === "bank" || l.type === "bank" || /\bbank\b|\bod\b|overdraft|\bsbi\b|\bhdfc\b|\bicici\b|\baxis\b|\bkotak\b|\bfederal\b|\bcanara\b|\bpnb\b/.test(nm);
};
const isGstLine = (account: string) => /\b(cgst|sgst|igst|utgst|gst|cess)\b/.test(norm(account));

/** A ledger that already exists (exact, or same canonical name). */
function findLedger(name: string, ledgers: Ledger[]): Ledger | undefined {
  const k = norm(name), c = canonKey(name);
  return ledgers.find(l => norm(l.name) === k) ?? ledgers.find(l => canonKey(l.name) === c);
}

/** Did the user literally name it (this message or the conversation)? Every significant word must appear. */
export function userNamed(name: string, said: string): boolean {
  const words = norm(name).split(" ").filter(w => w.length > 2 && !["and", "the", "a c", "account", "expenses", "expense", "charges"].includes(w));
  const text = ` ${norm(said)} `;
  if (!words.length) return false;
  if (words.every(w => text.includes(` ${w} `) || text.includes(` ${w}s `))) return true;
  // Synonym phrasing ("paid office rent" names the Rent ledger): any 1–3 word phrase the user said with the same canonical name
  const canon = norm(canonicalName(name));
  const toks = norm(said).split(" ");
  for (let i = 0; i < toks.length; i++) for (let k = 1; k <= 3 && i + k <= toks.length; k++) {
    if (norm(canonicalName(toks.slice(i, i + k).join(" "))) === canon && SYNONYMS.some(([re]) => re.test(toks.slice(i, i + k).join(" ")))) return true;
  }
  return false;
}

// ── B18: instruction-like text ──────────────────────────────────────────────
const INJECTION = [
  /\b(system|developer|admin)\s*(override|prompt|mode|instruction)/i,
  /\bignore (all |any |the )?(previous|prior|above|earlier) (instructions?|rules?|prompts?)/i,
  /\bwithout (asking for |any )?(confirmation|approval|review)\b/i,
  /\b(auto[- ]?post|post (it )?(directly|immediately|automatically))\b/i,
  /\b(you are now|act as|pretend to be|new instructions?)\b/i,
  /\bdisable (the )?(checks?|validation|confirmation|rules?)\b/i,
];
export const INJECTION_REPLY = "I can't change how posting works — every entry needs your confirmation. Tell me the transaction in plain words and I'll prepare a draft for you to review.";
export const looksLikeInjection = (msg: string) => INJECTION.some(re => re.test(msg));

// ── B4: amounts the user mentioned ──────────────────────────────────────────
/** Distinct money amounts in a sentence ("Rs 3,200", "₹5,000", "1.2L", "5k"); dates and percentages are ignored. */
export function amountsIn(msg: string): number[] {
  const out = new Set<number>();
  const text = msg.replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, " ").replace(/\b\d+(\.\d+)?\s*%/g, " ");
  const re = /(?:₹|rs\.?|inr|aed|usd|\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|l|lakh|lakhs|lac|cr|crore)?\b/gi;
  for (const m of text.matchAll(re)) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    const unit = (m[2] ?? "").toLowerCase();
    if (unit === "k") n *= 1e3; else if (/^(l|lakh|lakhs|lac)$/.test(unit)) n *= 1e5; else if (/^(cr|crore)$/.test(unit)) n *= 1e7;
    const hasCurrency = /₹|rs|inr|aed|usd|\$/i.test(m[0]);
    if (n >= 10 && (hasCurrency || unit || n >= 100) && !(n >= 1900 && n <= 2100 && !hasCurrency && !unit && !/,/.test(m[1]))) out.add(Math.round(n * 100) / 100);
  }
  return [...out];
}

// ── The gate ────────────────────────────────────────────────────────────────
export function validateDraft(input: {
  message: string; history?: string[]; draft: Draft; ledgers: Ledger[];
  business: { gstin?: string | null; country?: string | null };
  draftsInMessage?: number;                 // how many transactions the model returned for this message
}): Verdict {
  const { message, draft, ledgers, business } = input;
  const said = [...(input.history ?? []), message].join(" \n ");
  const v: Verdict = { status: "ready", lines: [], narration: "", newLedgers: [], assumptions: [], questions: [], blocked: [] };

  // B18 — instructions are not transactions
  if (looksLikeInjection(message)) { v.status = "blocked"; v.blocked.push(INJECTION_REPLY); v.lines = draft.lines; v.narration = ""; return v; }

  // B10 — GST only for a registered business
  const registered = !!(business.gstin && business.gstin.trim().length >= 15);
  const indian = (business.country ?? "IN") === "IN";
  if (indian && !registered && draft.lines.some(l => isGstLine(l.account) && (l.debit || l.credit))) {
    v.blocked.push("This business has no GSTIN, so GST can't be charged or claimed on this entry. Remove the GST, or add your GSTIN in Business Details if you're registered.");
  }

  // B3.1/B3.2/B3.5 — every ledger must exist or have been named by the user; new ones need confirmation
  const banks = ledgers.filter(l => isBankish(l));
  const seenNew = new Set<string>();
  for (const l of draft.lines) {
    const existing = findLedger(l.account, ledgers);
    if (existing) { v.lines.push({ ...l, account: existing.name, is_new_account: false }); continue; }
    if (isBankish({ account: l.account, suggested_type: l.suggested_type })) {
      // A bank the user didn't name is never invented
      if (userNamed(l.account, said)) { v.lines.push({ ...l, is_new_account: true }); if (!seenNew.has(l.account)) { seenNew.add(l.account); v.newLedgers.push(l.account); } continue; }
      // "the bank" with exactly one bank account is unambiguous — use it
      if (banks.length === 1) { v.lines.push({ ...l, account: banks[0].name, is_new_account: false }); continue; }
      v.lines.push({ ...l, is_new_account: true });
      v.questions.push(banks.length
        ? { text: "Which bank account?", options: [...banks.map(b => b.name), "+ Add bank"], field: l.account }
        : { text: "You have no bank account set up yet — which bank is this? (Add it once and FreBook will remember.)", options: ["+ Add bank"], field: l.account });
      continue;
    }
    const canon = canonicalName(l.account);
    if (userNamed(l.account, said) || (canon !== l.account.trim() && userNamed(canon, said))) {
      v.lines.push({ ...l, account: canon, is_new_account: true });
      if (!seenNew.has(canon)) { seenNew.add(canon); v.newLedgers.push(canon); }
    } else {
      v.lines.push({ ...l, account: canon, is_new_account: true });
      v.questions.push({ text: `Which ledger should "${canon}" be? You didn't name it — pick an existing one or confirm the new ledger.`, field: l.account });
    }
  }
  for (const n of v.newLedgers) v.assumptions.push(`New ledger "${n}" will be created — confirm its group before posting.`);

  // B3.3 — narration keeps only the user's facts
  const proposed = (draft.narrative ?? "").trim();
  const userText = message.trim().replace(/\s+/g, " ");
  const foreign = proposed ? [
    ...(proposed.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g) ?? []).filter(w => !/^(Paid|Received|Being|For|To|From|By|Through|Via|The|Cash|Bank|Sales?|Purchases?|Rent|Salary|Salaries|GST|CGST|SGST|IGST|Dr|Cr|Rs|INR)$/.test(w) && !userNamed(w, said) && !ledgers.some(l => norm(l.name) === norm(w))),
    ...(proposed.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).filter(nm => !said.replace(/,/g, "").includes(nm.replace(/,/g, "")) && !amountsIn(said).includes(parseFloat(nm.replace(/,/g, "")))),
  ] : [];
  if (foreign.length) { v.narration = userText; v.assumptions.push(`Narration rewritten in your words (the draft added: ${[...new Set(foreign)].join(", ")}).`); }
  else v.narration = proposed || userText;

  // B4 — more amounts mentioned than transactions drafted
  const amounts = amountsIn(message), drafts = input.draftsInMessage ?? 1;
  const draftTotals = new Set(draft.lines.flatMap(l => [l.debit, l.credit]).filter(n => n > 0).map(n => Math.round(n * 100) / 100));
  const unexplained = amounts.filter(a => !draftTotals.has(a));
  if (amounts.length > drafts && unexplained.length) v.questions.push({ text: `Your message mentions ${amounts.length} amounts (${amounts.map(a => a.toLocaleString("en-IN")).join(", ")}) but only ${drafts} transaction${drafts === 1 ? " was" : "s were"} drafted. Is ${unexplained.map(a => "₹" + a.toLocaleString("en-IN")).join(" / ")} a separate transaction?` });

  v.status = v.blocked.length ? "blocked" : v.questions.length || v.assumptions.length ? "needs_review" : "ready";
  return v;
}
