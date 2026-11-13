// FreBook answers "what can you do?" / "how do I reconcile the bank?" itself — these are questions, not transactions.
// Pure; returns null when the text isn't a question about FreBook's features.
type Topic = { k: RegExp; title: string; body: string; href?: string };
const TOPICS: Topic[] = [
  { k: /\b(chat|type|message|record|book(ing)?|entry|entries)\b/, title: "Chat-based accounting", body: "Type what happened in plain words — \"Paid rent 25,000 by bank\" or \"Sold to ABC 50,000 + 18% GST on credit\". I draft the entry with GST and TDS, you check it and tap Post.", href: "/finance/chat-book" },
  { k: /\b(photo|bill|invoice|receipt|scan|camera|image|upload|pdf)\b/, title: "Bills and photos", body: "Tap 📎 and attach a bill, invoice or receipt (photo or PDF). I read the party, GSTIN, invoice number, items and tax, and draft the entry. The file is kept on your Shelf.", href: "/finance/chat-book" },
  { k: /\b(statement|bank\s*statement|passbook)\b/, title: "Bank statements", body: "Attach a bank or card statement (PDF, Excel or CSV). I read every line, suggest the ledger for each, flag repeats, and you post them in bulk.", href: "/finance/banking/import" },
  { k: /\b(voice|speak|talk|mic|microphone|audio)\b/, title: "Voice", body: "Tap the 🎤 mic and say the transaction — English, Malayalam, Hindi and more. I write it down and draft the entry.", href: "/finance/chat-book" },
  { k: /\b(smart\s*inbox|inbox|bulk|many files|drop)\b/, title: "Smart Inbox", body: "Drop many files at once — statements, bills, invoices, Excel. I read them all in the background and give you one list to review and post.", href: "/finance/inbox" },
  { k: /\b(reconcil\w*|brs|match)\b/, title: "Reconciliation", body: "Bank Reconciliation: upload the statement and see what matches FreBook, what's missing and what hasn't cleared — with a BRS you can download.\nGST: GSTR-2B vs your purchase bills (ITC Match), and filed GSTR-1 / 3B vs your books — downloaded from the portal with one OTP.", href: "/finance/banking/reconcile" },
  { k: /\b(gst|gstr|3b|2b|return|filing)\b/, title: "GST returns", body: "GSTR-1 and GSTR-3B are built from your entries every month. Say \"Prepare GSTR-1 for October\" to open it, download the JSON for the portal, and reconcile with 2B.", href: "/finance/gst" },
  { k: /\b(tally)\b/, title: "Tally", body: "Import your Tally company (ledgers, groups, entries), and push FreBook entries back to Tally.", href: "/finance/tally" },
  { k: /\b(report|p&l|profit|loss|balance\s*sheet|trial|mis|cash\s*flow|analysis|cfo)\b/, title: "Reports", body: "Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, MIS and a CFO-style Business Analysis (margins, break-even, costs to question) — all live from your entries.", href: "/finance/reports?tab=profit_loss" },
  { k: /\b(whatsapp|remind\w*)\b/, title: "WhatsApp", body: "Send me bills and entries on WhatsApp, and get reminders for payments due, money to collect, GST dates and a daily summary.", href: "/finance/whatsapp" },
  { k: /\b(ask|question|owe|due|balance|how much)\b/, title: "Ask your books", body: "Ask in plain words — \"How much do customers owe?\", \"Cash balance today?\", \"Rent paid this year?\" — and I answer from your entries.", href: "/finance/chat-book" },
  { k: /\b(history|old chats?|past)\b/, title: "History", body: "Every chat, attachment and Smart Inbox file is kept under AI → History.", href: "/finance/history" },
];

const ALL = /\b(fea?t[a-z]*?u?res?|featur[a-z]*|fucntions?|functions?|services? (do|can) you|what can you|what (all )?do you|what all|capabilit\w*|what is frebook|who are you|^help$|help me|options)\b/i;
// "How do I…", "Can you…", "Do you support…", "Explain…" — about using FreBook, not a question for the books
const HOWTO = /\b(how (do|can|should) i|how to|can (you|i|frebook)|do you|does (it|frebook)|is there|explain|tell me about|what is (the )?(smart inbox|reconciliation|brs|voice))\b/i;

export function featureHelp(text: string): { title: string; body: string; href?: string }[] | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  if (/\d[\d,]{2,}/.test(t) ) return null;   // amounts mean a transaction or a books question
  const hit = TOPICS.filter(x => x.title !== "Ask your books" && x.k.test(t));
  if (ALL.test(t) && !(HOWTO.test(t) && hit.length)) return TOPICS;
  if (HOWTO.test(t) && hit.length) return hit.slice(0, 3);
  return null;
}
