// The party named in a bank narration: "FT IMPS/IFI/608410068861/SUVIN K/Pay to account" → "Suvin K",
// "UPI/DR/412345678901/RAHUL TRADERS/YESB/rahul@ybl/Payment" → "Rahul Traders", "NEFT-SBIN0001234-ACME INDIA PVT LTD-INV 22" → "Acme India Pvt Ltd".
// Pure; null when no name can be read with confidence.
const NOISE = /^(ft|upi|imps|neft|rtgs|ifi|inb|mob|mb|ib|dr|cr|p2a|p2m|pay|payment|transfer|trf|to|by|from|ach|nach|ecs|cms|clg|chq|cheque|self|cash|atm|pos|ref|txn|bil|bill|onl|online|na|sent|received|pay to account|paid via|ib funds transfer)$/i;
const BANKISH = /^(sbin|hdfc|icic|utib|kkbk|fdrl|ybl|yesb|ibkl|punb|barb|cnrb|ubin|ioba|idib|bkid|mahb|indb|csbk|sibl|kvbl|tmbl|citi|hsbc|axis|kotak|federal|paytm|okaxis|okhdfcbank|okicici|oksbi|apl|axl|ibl)/i;
const tc = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(Pvt|Ltd|Llp|Opc)\b/g, m => m.charAt(0) + m.slice(1).toLowerCase());

export function partyFromNarration(desc: string): string | null {
  const d = String(desc ?? "").replace(/\s+/g, " ").trim();
  if (!/(imps|neft|rtgs|upi|ft |transfer|trf|inb|mob)/i.test(d)) return null;
  const parts = d.split(/[\/\-|:]+/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.length < 3 || p.length > 50) continue;
    if (/\d{3,}/.test(p) || /@/.test(p)) continue;                 // reference numbers, UPI ids
    if (NOISE.test(p) || p.split(/\s+/).every(w => NOISE.test(w)) || BANKISH.test(p.replace(/\s/g, ""))) continue;
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p)) continue;                // IFSC
    if (/\b(charges?|interest|salary|rent|emi|loan|gst|tds|tax|refund|reversal|cashback|fee|sms|atm)\b/i.test(p)) return null;   // not a party
    if (!/[a-z]{2,}/i.test(p)) continue;
    return tc(p);
  }
  return null;
}

/** A vague control / group name that should be replaced by the party's own ledger. */
export const isControlLedger = (name: string) => /^(sundry\s+)?(debtors|creditors)(\s+control)?$|^trade\s+(receivables|payables)$|^(debtors|creditors)\s+control$|^receivables?$|^payables?$/i.test(String(name ?? "").trim());
