// Help & FAQ content for /help. Each answer is short plain text (also used for search and Google's FAQ data),
// with an optional picture: numbered steps, a WhatsApp chat example, the GST split, or where to click.
import { FREBOOK_PLANS_LIST } from "./plans";
import { TRIAL_DAYS } from "./claimTrial";

export type Illustration =
  | { kind: "steps"; steps: string[] }
  | { kind: "chat"; lines: { from: "you" | "frebook"; text: string }[] }
  | { kind: "gst" }
  | { kind: "path"; path: string[] }
  | { kind: "plans" };
export type QA = { q: string; a: string[]; pic?: Illustration; link?: { label: string; href: string } };
export type HelpTopic = { id: string; title: string; icon: string; blurb: string; items: QA[] };

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const planLine = FREBOOK_PLANS_LIST.map(p => `${p.name} — ${rupees(p.price)} a month or ${rupees(p.yearly)} a year, ${p.businesses === 1 ? "1 business" : `up to ${p.businesses} businesses`}`).join("; ");

export const HELP: HelpTopic[] = [
  {
    id: "start", title: "Getting started", icon: "🚀", blurb: "Sign up, add your business, first entries",
    items: [
      { q: "What is FreBook?", a: ["FreBook is online accounting for Indian businesses. You record sales, purchases, expenses and bank entries by typing in plain words — on the website or on WhatsApp — and FreBook keeps proper double-entry books.", "From those books you get GST invoices, GSTR-1 and GSTR-3B working, P&L, Balance Sheet (Schedule III), Trial Balance, ledgers, and a push to Tally."] },
      { q: "How do I start?", a: ["Create an account, add your business, and start recording. The free trial gives you every feature."],
        pic: { kind: "steps", steps: ["Sign up with email or Google", "Add your business (name, GSTIN, state)", "Record a sale, bill or expense", "See your reports update"] }, link: { label: "Create a free account", href: "/register" } },
      { q: "Do I need to know accounting?", a: ["No. Type what happened — “Paid rent 25,000 from bank” — and FreBook works out the debit and credit, the ledgers and the GST. You check the draft and confirm.", "Accountants can still see and edit every journal, ledger and voucher."] },
      { q: "Can I keep more than one business?", a: ["Yes. One login can hold several businesses (how many depends on your plan). Switch between them from the business name at the top of FreBook, or send SWITCH on WhatsApp."] },
      { q: "How do I enter my opening balances?", a: ["If you are moving from another software or starting mid-year, enter the balances as on your start date so your Balance Sheet is right from day one."],
        pic: { kind: "path", path: ["FreBook", "Accounting", "Opening Balances"] } },
      { q: "Can my accountant or staff use my FreBook?", a: ["Yes. Invite them by email from Team & Access and choose what they can do — view only, or record entries. They sign in with their own login; you can remove them any time."],
        pic: { kind: "path", path: ["FreBook", "Settings", "Team & Access"] } },
    ],
  },
  {
    id: "plans", title: "Plans & billing", icon: "💳", blurb: "Prices, trial, yearly plans, upgrades",
    items: [
      { q: "How much does FreBook cost?", a: [`${planLine}. Prices are plus 18% GST.`, "Every plan has every feature. Plans differ only in how many businesses you keep and how many PDF bank-statement pages the AI reads each month."], pic: { kind: "plans" }, link: { label: "See plans", href: "/pricing" } },
      { q: "Is there a free trial?", a: [`Yes — ${TRIAL_DAYS} days with every feature and any number of businesses. No card is needed to start.`] },
      { q: "What do I save with a yearly plan?", a: ["Yearly plans cost the same as 10 months — you get 2 months free. Choose Yearly on the Plans page before paying."] },
      { q: "What happens when I add more businesses than my plan allows?", a: ["FreBook tells you and offers the next plan that fits — for example, from Starter (1 business) to Basic (2). Tap Upgrade, pay, and add the business."],
        pic: { kind: "steps", steps: ["Add business", "“Your plan keeps 1 business”", "Upgrade to the plan that fits", "Add the business"] } },
      { q: "What are “PDF statement pages”?", a: ["When you upload a bank statement as a PDF or photo, the AI reads it page by page. Each plan includes a number of pages a month (Starter 100, Basic 500, Pro 2,000, CA Practice 6,000).", "Excel and CSV statements are read without AI and never use your pages — download Excel from your bank's net banking when you can."] },
      { q: "Is GST charged on the subscription?", a: ["Yes, 18% GST is added at checkout, and you get a GST invoice for every payment. Add your GSTIN in Business Details to claim the input credit."] },
      { q: "How does the referral offer work?", a: ["Share your link from the Plans page. Your friend gets half off their first month, and when they pay, you get half a month off your next payment."] },
      { q: "How do I pay, and can I cancel?", a: ["Pay by UPI, card or net banking (Razorpay). Cancel any time — you keep access until the end of the period you paid for. See the Refund Policy for the 7-day rule."], link: { label: "Refund Policy", href: "/refund-policy" } },
    ],
  },
  {
    id: "whatsapp", title: "WhatsApp bookkeeping", icon: "💬", blurb: "Record and ask from WhatsApp",
    items: [
      { q: "How do I connect WhatsApp?", a: ["Open FreBook → Settings → WhatsApp, enter your mobile number and send the LINK code shown to FreBook's WhatsApp number. Your number is then linked to your business."],
        pic: { kind: "steps", steps: ["Settings → WhatsApp", "Enter your mobile number", "Send the LINK code on WhatsApp", "“✅ Linked” — start typing entries"] } },
      { q: "How do I record an entry on WhatsApp?", a: ["Just type it, in English, Malayalam-English or Hindi-English. FreBook replies with a draft — reply YES to post it or NO to drop it. You can also send a photo or PDF of a bill."],
        pic: { kind: "chat", lines: [
          { from: "you", text: "Paid rent 25000 from bank" },
          { from: "frebook", text: "Draft: Rent A/c Dr 25,000 · HDFC Bank Cr 25,000\nReply YES to post" },
          { from: "you", text: "YES" },
          { from: "frebook", text: "✅ Posted as JV-0142" },
        ] } },
      { q: "What can I type on WhatsApp?", a: ["Entries: “Sold goods to Asha 11800 incl GST on credit”, “200 petrol cash”.", "Questions: “Profit this month”, “Who owes me?”, “Cash and bank balance”, “GST collected last month”.", "Commands: HELP (menu), YES / NO (post or drop a draft), SWITCH (change business), LOGIN (one-tap link to the dashboard), INVOICE (after a sale — opens that invoice), LIST (overdue customers with ready-to-send reminders)."] },
      { q: "Can I get the invoice after recording a sale on WhatsApp?", a: ["Yes. After a sale is posted, reply INVOICE. You get a link that opens the invoice — view, edit, and Print / PDF to download or share it."],
        pic: { kind: "chat", lines: [
          { from: "frebook", text: "✅ Posted as SAL-0088 · Need the invoice? Reply INVOICE" },
          { from: "you", text: "INVOICE" },
          { from: "frebook", text: "🧾 Your invoice — view, edit, then Print / PDF" },
        ] } },
      { q: "Is the WhatsApp login link safe?", a: ["The link signs in as you, works once and expires quickly. Don't forward it — share the PDF of an invoice instead."] },
    ],
  },
  {
    id: "invoices", title: "Invoices & GST", icon: "🧾", blurb: "Sales invoices, GST, e-invoice, e-way bill",
    items: [
      { q: "How do I make a sales invoice?", a: ["Go to New Invoice, pick or add the customer, type the items with quantity, price and GST rate, choose whether it's paid, and save. The invoice and the accounting entry are made together."],
        pic: { kind: "steps", steps: ["New Invoice", "Pick customer", "Add items, qty, price, GST", "Save → Print / PDF"] } },
      { q: "When is it CGST + SGST and when is it IGST?", a: ["It depends on where the customer is. Same state as your business → CGST and SGST, half each. Another state → IGST, the full rate. FreBook decides from the customer's GSTIN or state."], pic: { kind: "gst" } },
      { q: "My prices already include GST — what do I do?", a: ["Tick “Prices include GST” on the invoice. FreBook works the taxable value and GST back out of the price."] },
      { q: "How do I add many customers or items at once?", a: ["Use Import from Excel: on New Invoice (“Import customers”, “Import items”) or on Customers & Suppliers. Download the template, fill one row each, upload, check the preview and import. Names that already exist are updated."],
        pic: { kind: "steps", steps: ["⬇ Download template", "Fill one row each", "⬆ Upload", "Check preview → Import"] } },
      { q: "How do I download or share an invoice?", a: ["Open the invoice and press Print / PDF, then choose “Save as PDF”. You can edit details on the invoice before printing."] },
      { q: "Can FreBook make my e-invoice (IRN) and e-way bill?", a: ["FreBook makes the government's JSON file from your invoice. Open the invoice → “e-Invoice file” or “e-Way bill file”, download, and upload it on einvoice1.gst.gov.in (Bulk Upload) or ewaybillgst.gov.in (Bulk Generation). FreBook checks GSTIN, pincode and HSN first and tells you what to fix."],
        pic: { kind: "steps", steps: ["Open invoice", "e-Invoice / e-Way bill file", "Fix anything flagged", "Upload on the GST portal"] } },
      { q: "Does FreBook file my GST returns?", a: ["FreBook prepares GSTR-1 and GSTR-3B from your books and shows any problems. You (or your CA) file them on the GST portal. FreBook never stores your portal password."], pic: { kind: "path", path: ["FreBook", "Reports", "GST Returns"] } },
    ],
  },
  {
    id: "bank", title: "Bank & payments", icon: "🏦", blurb: "Statements, reconciliation, collections",
    items: [
      { q: "How do I import my bank statement?", a: ["Go to Banking → Import Statement and upload the statement. FreBook reads each transaction and suggests the ledger (rent, sales, a supplier…). Check the suggestions and post."],
        pic: { kind: "steps", steps: ["Download statement from your bank", "Upload in Import Statement", "Check suggested ledgers", "Post"] } },
      { q: "Which statement format is best?", a: ["Excel (.xlsx) or CSV — read exactly, instantly, and free. PDFs and photos also work; the AI reads them and they count toward your monthly PDF pages."] },
      { q: "My PDF statement is very long. Will it work?", a: ["Yes. Long PDFs are read in small batches of pages with a progress bar — a 1,000-page statement takes several minutes, so keep the tab open. If a few pages can't be read, you keep the rest and FreBook tells you which pages to upload again."] },
      { q: "Can FreBook fetch my bank transactions automatically?", a: ["Not yet. We are working on bank feeds through India's Account Aggregator system. Until then, upload the statement (Excel is quickest)."] },
      { q: "How do I follow up customers who owe me?", a: ["Collect Payments shows who owes you, oldest first, with a ready-made WhatsApp reminder (polite, firm or Malayalam) and a UPI pay link. You press send from your own WhatsApp."], pic: { kind: "path", path: ["FreBook", "Sales", "Collect Payments"] } },
      { q: "Can I get automatic reminders?", a: ["Yes. On Collect Payments, switch on Auto reminders (Daily or Mondays). At 9 AM FreBook WhatsApps you who's overdue; reply LIST to get each customer's reminder ready to send."],
        pic: { kind: "chat", lines: [
          { from: "frebook", text: "💰 3 customers owe you ₹48,000 overdue. Reply LIST" },
          { from: "you", text: "LIST" },
          { from: "frebook", text: "1. ABC Traders — ₹22,000 · 41 days\nTap to send: wa.me/…" },
        ] } },
    ],
  },
  {
    id: "reports", title: "Reports", icon: "📊", blurb: "P&L, Balance Sheet, ledgers, Excel",
    items: [
      { q: "Where are my P&L and Balance Sheet?", a: ["In Reports — use TB, P&L and Balance Sheet in the top bar. They follow the Schedule III format, with numbered notes. Choose the financial year at the top."], pic: { kind: "path", path: ["Top bar", "TB · P&L · Balance Sheet"] } },
      { q: "How do I see what makes up a figure?", a: ["Click a line or amount in the Trial Balance, P&L or Balance Sheet to open that ledger for the same year. In the ledger, click any row to see the entry. “← Back” returns you to where you were."],
        pic: { kind: "steps", steps: ["Balance Sheet", "Click a figure", "Ledger opens", "Click a row → the entry"] } },
      { q: "Can I see opening balances and the year's movement in the Trial Balance?", a: ["Yes. Switch the Trial Balance to “Opening & transactions” to see Opening, Debit, Credit and Closing for every account."] },
      { q: "How do I download my statements in Excel?", a: ["On Reports, press “Excel — all statements”: one workbook with Balance Sheet, P&L, Notes, Trial Balance and Cash Flow. Each ledger also has its own Excel button."] },
      { q: "Why doesn't my Balance Sheet balance?", a: ["FreBook checks every statement and shows a red warning if something doesn't add up. Usual causes: opening balances not entered, or an entry posted to the wrong year. Ask us on WhatsApp and we'll help find it."] },
    ],
  },
  {
    id: "tally", title: "Tally", icon: "🔗", blurb: "Push to and import from Tally",
    items: [
      { q: "Does FreBook work with Tally?", a: ["Yes. FreBook can push your entries into Tally (manually or automatically) and import from Tally. A small FreBook Tally Bridge runs on the computer where Tally is open."],
        pic: { kind: "steps", steps: ["Install Tally Bridge", "Open Tally with your company", "Turn on Auto-push in FreBook", "Entries appear in Tally"] } },
      { q: "What is Auto-push?", a: ["With Auto-push on (the switch in FreBook's top bar), new entries go to Tally by themselves while the bridge is running. Anything missed is caught up the next time it connects."] },
      { q: "Tally says “Educational mode” and some dates fail.", a: ["Tally's Educational version only accepts entries on certain days of the month. Use a licensed Tally for real books — FreBook won't change your entry dates to get around it."] },
    ],
  },
  {
    id: "safety", title: "Data & security", icon: "🔒", blurb: "Privacy, access, backups",
    items: [
      { q: "Is my data safe?", a: ["Data travels over encrypted connections (HTTPS), and every business is walled off — only you and the people you invite can see it. Each team member's access is limited to what you allow."] },
      { q: "Does FreBook store my GST or bank portal passwords?", a: ["No. FreBook never asks for or stores portal passwords. Files for the GST portal are downloaded by you and uploaded by you."] },
      { q: "Can I take my data out?", a: ["Yes. Download statements, ledgers and the Trial Balance in Excel at any time, and push your books to Tally."] },
    ],
  },
  {
    id: "help", title: "Support", icon: "🙋", blurb: "Talk to us",
    items: [
      { q: "How do I contact support?", a: ["WhatsApp or call +91 95390 28318, or write from the Contact page. We usually reply within a few hours on working days."], link: { label: "Contact us", href: "/contact" } },
      { q: "Can you keep my books for me?", a: ["Yes — FreBook Managed: our accounting team keeps your books in FreBook every month and you see everything live. See the Pricing page."], link: { label: "Pricing", href: "/pricing" } },
    ],
  },
];
