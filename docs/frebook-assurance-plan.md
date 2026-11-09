# FreBook Assurance — gap audit and build plan

Source brief: "FreBook — Master Development Prompt" (Modules 1–6; the brief was cut off mid-Module 6).
Stack found: Next.js 15 (webpack) on Vercel, Supabase Postgres with RLS, Anthropic API. Migrations live in
`apps/web/src/app/finance/migrations/*.sql` and are run by the owner by hand.

## What already exists

| Area | Exists today | File(s) | Status |
|---|---|---|---|
| Book checks (TB agrees, unbalanced, empty, suspense, future-dated, drafts, duplicates, negative cash) | yes, run on demand, nothing stored | `lib/audit360.ts`, `/finance/audit360` | **Partial**: no exception records, statuses, owner or idempotency |
| Cash-law checks (40A(3) ₹10k, 269ST ₹2L, 269SS/269T ₹20k) | yes | `lib/audit360.ts` | **Partial**: thresholds are hard-coded, not versioned rules |
| Pre-post draft checks (duplicate, usual pattern, TDS threshold, balance impact) | yes | `lib/reviewChecks.ts` | Exists (draft time only) |
| Document duplicates (same file hash, posted invoice no., amount) | yes | `lib/documentReview.ts` | Exists |
| Bank line ↔ open sale/purchase matching | yes, amount and party only | `lib/billMatch.ts` | **Partial**: no UTR, date window, split, partial, charges, or confirm/unmatch state |
| GSTR-2B vs purchase register | yes | `lib/itcMatch.ts`, `/finance/gst` | Exists |
| GSTR-1 from books | yes | `lib/gstr1*.ts` | Exists. No GSTR-1 portal vs books diff yet |
| MSME 43B(h) | yes | `lib/msme43bh.ts` | Exists |
| Wrong-ledger bank repair | yes, one rule | `lib/repairPlan.ts` + SQL | **Partial**: needs a general approve-and-post correction flow |
| Held-for-review entries | yes | `/finance/review`, `/finance/ai-review` | Exists (pre-post only) |
| Documents store | yes | Shelf (`lib/shelf.ts`), Smart Inbox | Exists. No request/fulfil link |
| Posting service with FY/period locks and audit log | yes | `lib/posting.ts`, `lib/postEntry.ts`, `lib/audit.ts`, `/finance/periods` | Exists, reuse |
| WhatsApp send (Meta/Gupshup, 24-hour window) | yes | `lib/whatsapp/*` | Exists, reuse for Module 6 |
| Exception register, document requests, tax-rule table, reconciliation state | — | — | **Missing** |

## Build phases (each phase ships on its own and leaves existing features untouched)

**Phase 1: Exception register (Module 1 core)**
- Migration `fw_fin_exceptions`: business_id, rule_id, rule_version, fingerprint (unique per business while open → idempotent), date, amount, ledger/party, description, evidence jsonb, confidence (`definite` | `likely` | `requires_review`), suggested_action, assignee, status (the 9 statuses in the brief), history jsonb, timestamps. RLS copies the `fw_fin_journals` policy.
- `lib/detective/` with pure rule functions. The audit360 checks are reused and mapped into exceptions. New deterministic rules: negative party/ledger balances, unadjusted advances, old receivables/payables, entries outside the open FY, missing GSTIN on GST lines.
- Scan route `/api/finance/detective/scan`: upsert by fingerprint, auto-resolve when a definite rule no longer fires, never touch journals.
- Page `/finance/detective`: summary tiles, filters, list, status changes, assignee. Tests in `tests/accounting/`.

**Phase 2: Tax-rule registry (Module 5)**
- Migration `fw_fin_tax_rules` (rule id, provision, effective_from/to, FY, conditions, thresholds, exceptions, source, version, verified_on) seeded from the thresholds already in code.
- The audit360 and reviewChecks thresholds then read from it.
- Anything that depends on facts we don't have is shown as "Requires Review".

**Phase 3: Bank reconciliation engine (Module 2)**
- Extend `billMatch` with UTR/invoice-number/date-window/charges/refund/partial/many-invoice scoring and evidence lines.
- Migration `fw_fin_bank_matches`, with a constraint so one bank line can't be matched twice unless it has an explicit split.
- Confirm, reject and unmatch in the UI.

**Phase 4: Missing-document finder and requests (Modules 3 + 6 core)**
- Migration `fw_fin_doc_requests` linked to exceptions and journals.
- Upload through the Shelf, then extract (reuses `documentReview`) and validate amount/date/supplier/GSTIN.
- Mark fulfilled only when validation passes; otherwise reopen.
- Group requests by client; draft email/WhatsApp messages; sending only through the existing WhatsApp setup after the user confirms.

**Phase 5: Correction assistant (Module 4)**
- Correction drafts (reversal + new entry) go through the existing posting service, only after approval.
- Records who approved and the rejection comments, and links back to the exception.

**Phase 6: GST/TDS scanner expansion**
- GSTR-1 vs sales diff, RCM, place of supply, rate checks, e-invoice/e-way applicability.
- TDS section/rate/late checks against the rule registry.

## Open points for the owner
1. The brief stops partway through Module 6 (communication safeguards). Please send the rest.
2. Each phase adds a migration that you run yourself before that phase is deployed.
