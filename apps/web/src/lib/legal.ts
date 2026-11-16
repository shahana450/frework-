// One place for the facts every legal document repeats. Fill the empty ones before charging customers;
// a blank value shows as "[to be added]" on the page so nothing invented is ever published.
export const LEGAL = {
  entity: "Frenode (OPC) Private Limited",
  entityType: "a one person company incorporated under the Companies Act, 2013 (CIN U62011KL2026OPC108016)",
  cin: "U62011KL2026OPC108016",
  pan: "AAHCF3500G",
  tan: "CHNF05722D",
  incorporated: "16 November 2026",
  gstin: "",                 // add once GST registration is granted
  address: "C/o Sunil Paul C.M Mathew, Brothers Arcade, Nadakkavu, Eranhipalam, Kozhikode, Kerala 673006",   // registered office
  courts: "Kozhikode, Kerala",
  grievanceName: "",         // the person named as Grievance Officer
  grievanceEmail: "legal@frework.online",
  supportEmail: "support@frework.online",
  billingEmail: "billing@frework.online",
  effective: "16 November 2026",
  version: "1.4",   // 1.4: operated by Frenode (OPC) Private Limited (CIN, registered office)
  // previous:   // 1.1: email provider (Resend) listed; WhatsApp alerts, bank-statement reading and page-allowance use described
} as const;

export const fill = (v: string) => v.trim() || "[to be added]";

// Companies that process customer data for us (DPA Annex 2 / privacy notice)
export const SUBPROCESSORS: { name: string; purpose: string; data: string; location: string }[] = [
  { name: "Supabase Inc.", purpose: "Database, file storage and sign-in", data: "All account and accounting data", location: "Cloud region chosen for the project (may be outside India)" },
  { name: "Vercel Inc.", purpose: "Hosting the website and app", data: "Requests and logs in transit", location: "Global edge network" },
  { name: "Google LLC (Gemini API)", purpose: "AI drafting of entries and reading documents", data: "Chat text, uploaded documents, ledger names needed for the draft", location: "United States / global" },
  { name: "Anthropic PBC (Claude API)", purpose: "AI drafting (backup model)", data: "Same as above, only when used", location: "United States" },
  { name: "Sandbox (Quicko Infosoft Pvt Ltd)", purpose: "GST filing status and tax document reading", data: "GSTIN, uploaded Form 168 / 130 PDFs", location: "India" },
  { name: "PhonePe Pvt Ltd / Razorpay Software Pvt Ltd", purpose: "Payments", data: "Order amount, name, email, phone (never card or UPI credentials)", location: "India" },
  { name: "Meta Platforms (WhatsApp Business)", purpose: "WhatsApp messages you choose to send or receive, and alerts you switch on (e.g. overdue reminders to your own number)", data: "Phone number and message text", location: "Global" },
  { name: "Resend Inc.", purpose: "Service emails (account and system alerts)", data: "Email address and message content", location: "United States" },
];
