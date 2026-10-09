// Integration registry. FreWork's books are the source of truth; each provider is an optional connector.
// Adding a provider means adding an entry here plus its own module — the accounting core never changes.

export type ProviderId = "tally" | "bank_statement" | "razorpay" | "zoho_books" | "quickbooks" | "shopify" | "bank_feed";
export type Capability = "push_entries" | "pull_entries" | "pull_ledgers" | "detect_duplicates" | "import_files" | "pull_payments" | "pull_orders";

export type Provider = {
  id: ProviderId;
  name: string;
  kind: "accounting" | "bank" | "payments" | "commerce";
  transport: "local_bridge" | "file" | "cloud_api";
  status: "available" | "planned";
  capabilities: Capability[];
  description: string;
  href?: string;                 // where it's managed in the app
};

export const PROVIDERS: Provider[] = [
  {
    id: "tally", name: "Tally Prime / ERP 9", kind: "accounting", transport: "local_bridge", status: "available",
    capabilities: ["push_entries", "pull_entries", "pull_ledgers", "detect_duplicates"],
    description: "Two-way sync through the FreWork Tally Bridge on your PC. Push FreWork entries to Tally, import Tally vouchers, and find entries already in Tally.",
    href: "/finance/tally",
  },
  {
    id: "bank_statement", name: "Bank statements", kind: "bank", transport: "file", status: "available",
    capabilities: ["import_files", "detect_duplicates"],
    description: "Import PDF, Excel or CSV statements from any bank. Rows are reviewed before posting.",
    href: "/finance/banking/import",
  },
  { id: "razorpay", name: "Razorpay", kind: "payments", transport: "cloud_api", status: "available", capabilities: ["pull_payments", "detect_duplicates"], description: "Captured payments (with gateway fee and GST on the fee), refunds and bank settlements — proposed as entries for you to post." },
  { id: "shopify", name: "Shopify", kind: "commerce", transport: "cloud_api", status: "available", capabilities: ["pull_orders", "detect_duplicates"], description: "Paid orders as sales (with GST and shipping) and refunds — proposed as entries for you to post." },
  { id: "zoho_books", name: "Zoho Books", kind: "accounting", transport: "cloud_api", status: "available", capabilities: ["pull_entries", "detect_duplicates"], description: "Sign in with Zoho and import Zoho Books journals into FreWork." },
  { id: "quickbooks", name: "QuickBooks", kind: "accounting", transport: "cloud_api", status: "available", capabilities: ["pull_entries", "detect_duplicates"], description: "Sign in with Intuit and import QuickBooks Online journal entries into FreWork." },
  { id: "bank_feed", name: "Live bank feeds", kind: "bank", transport: "cloud_api", status: "available", capabilities: ["pull_entries", "detect_duplicates"], description: "Daily transactions straight from your bank through an RBI Account Aggregator — you approve once in your AA app. Each line is proposed against a ledger (rent, GST, salary …) for you to check and post." },
];

export const providerById = (id: string) => PROVIDERS.find(p => p.id === id);
