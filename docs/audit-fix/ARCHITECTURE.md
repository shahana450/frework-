# FreWork / FreBook — architecture as found (9 Oct 2026)

Branch `fix/launch-blockers`, baseline commit `86bd434` = what is live on frework.online.
App: `apps/web` (Next.js 15.5 App Router, React, Supabase, Vercel Hobby). No Docker/Supabase CLI workflow exists in the repo; migrations are hand-run SQL files in `src/app/finance/migrations/` (plus legacy `src/app/finance/schema.sql` and `src/app/api/finance/setup-schema`).

## Request paths

| Concern | Where |
|---|---|
| Auth for API routes | `lib/apiAuth.ts` — `requireUser` (Bearer token) → `requireBusiness` → `roleOf` (owner / FreWork admin by email / `fw_fin_team_members`). Service-role Supabase client is used **only** in server routes. |
| Browser → API token | `lib/apiAuthClient.ts` patches `window.fetch` to add the Supabase access token to `/api/*` calls. |
| Browser → DB directly | Many pages call `supabase.from("fw_fin_*")` with the anon key (Books, Journals, Ledger, Banking import, setup, select-business, layout subscription check …). Isolation for these relies entirely on RLS. |
| Edge runtime (Mumbai) | `chat-book/fast`, `chat-book/confirm`, `chat-book/checks`, `chat-book/confirm-batch`, `dashboard`. Everything else runs as Node functions in `iad1`. |

## FreBook (chat) pipeline

1. `app/finance/chat-book/page.tsx` → `POST /api/finance/chat-book/fast` (typed) or `/api/finance/chat-book` (with a file).
2. `lib/chatBookHandler.ts` — builds context (accounts list, FY, business), calls the model once with `intentSystemFor()` (`lib/intentEngine.ts`). The model returns **intent JSON** (record vs query).
3. Record → `interpret()` in `lib/intentEngine.ts` turns the intent into lines using `lib/accountingRules.ts` (rule-built debit/credit, GST split, TDS) and `ledgerResolve`/history evidence. Output `ParsedTransaction` with `confidence` **taken from the model**.
4. Query → `lib/bookQueries.ts` `runTool()` computes answers from posted entries.
5. Draft card shows `ReviewChecks` (`/api/finance/chat-book/checks` → `lib/reviewChecks.ts`: TDS/cash/negative-balance rules).
6. Confirm → `/api/finance/chat-book/confirm` → `lib/ledgerResolve.ts` (creates missing ledgers when the group is inferable) → `lib/posting.ts postJournal()`.

**Found:** when a business has no ledgers the handler falls back to a hard-coded account list that includes **"HDFC Bank"** (`chatBookHandler.ts`, "Available Accounts" line) — the probable source of B3's invented bank. One model call returns **one** transaction (B4).

## Posting engine (correct — protect it)

- `lib/posting.ts postJournal()` → Postgres `fw_fin_post_journal(p_business, p_actor, p_header, p_lines)` (security definer; latest definition in `2026-10-07_phase8_integrations.sql`). Single transaction: header + lines, Dr = Cr check, FY lock (`force` for owner/admin), one shared counter per prefix `JV-YYYY` (`fw_fin_entry_counters`) → **all voucher types share `JV-YYYY-NNNN`** (B12).
- Idempotency: `metadata.client_key` with a unique index (`2026-10-09_post_once.sql`).
- Reversal: `fw_fin_reverse_journal` posts the mirror entry, sets `reversed_by` / `reversal_of` (`2026-10-03_phase1_posting_engine.sql`).
- Guards: `fw_fin_guard_journal` / `fw_fin_guard_lines` triggers (`2026-10-05_phase6_controls.sql`) make posted entries immutable after 10 minutes; `fw_fin_guard_locked_year` enforces the FY lock in the DB.
- Duplicate check: `findLikelyDuplicate()` (same total, same ledgers, ±3 days).
- `fw_fin_audit_log` exists (who/action/reason/detail) but has no before/after snapshot.

## Reports

- `lib/books.ts` — `buildTrialBalance` (Dr-positive balance), `buildPL`, `buildBS` (sums *signed* natural amounts → totals are right).
- `app/api/finance/reports/route.ts` serves TB/P&L/BS; `app/finance/reports/page.tsx` renders. **The page formats every amount with `Math.abs`** (`fmt`, and `Math.abs(r.dr - r.cr)` per row) → negative cash/bank shown as positive while totals use signed sums (B1).
- `lib/dashboard.ts`, `lib/cashFlow.ts`, `lib/bookQueries.ts` (receivables/payables by `fw_fin_journals.party_name`, falling back to "Not named"; Receivables/Payables pages group untagged as "Walk-in / Untagged").
- GST: `app/api/finance/gst/route.ts`, `lib/gstr1.ts`, `lib/gstr1Source.ts`.

## Parties (B2)

- Receivable/payable lines post to `Debtors Control` / `Creditors Control` (`lib/accountingRules.ts` standard names). Party identity is only the free-text `fw_fin_journals.party_name` (+ optional `contact_id`). Lines have no party column. `fw_fin_contacts` exists (owner RLS).

## Data model & RLS

Tables found in repo SQL (all with RLS enabled): ai_suggestions, audit_log, businesses, chart_of_accounts, chat_sessions, connections, contacts, documents, entry_counters, feed_items, financial_years, gst_profiles, integration_sync, invoice_docs, journal_lines, journals, ledgers, pending_grants, portal_links, portal_status, shelf_items, team_members, virtual_ca_chats, wa_links, wa_seen, wa_sessions.

Policies (27): owner-only via `business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())`, `FOR ALL`. Notes:
- **Team members have no RLS access** (they work through server routes).
- `admin_businesses` / `biz_owner` grant FreWork admin emails `FOR ALL` on businesses.
- `FOR ALL` on journals/lines lets the browser insert/update rows directly (drafts; posted rows protected by triggers).
- **Not in the repo:** `fw_fin_subscriptions`, `fw_fin_payments`/orders and any storage-bucket policies (`shelf`, logos). Their RLS cannot be verified from code — needs the live/staging DB.

## Tally

- Browser ↔ local Tally Bridge (`localhost:7002` → Tally `:7001`) via `lib/tallyUtils.ts tallyFetch`.
- One app-wide connection store `lib/tallyConnection.ts` (localStorage: port, company, session) — **per device/user, not per business** (B5).
- Push: `/api/finance/tally-push` builds voucher XML server-side; the browser sends it. Import: `/api/finance/integrations/tally/import`.

## Tests

`npm run test:accounting` — Node's built-in runner over `tests/accounting/*.test.ts` (pure modules, no DB). 99 passing at baseline. No Vitest, Playwright, or DB-backed tests; no local Supabase.

## Constraints for this work

- No local SWC: `next build` cannot run on this PC (native binaries blocked) — builds are verified on Vercel only. Type-check with `tsc --noEmit`.
- No staging Supabase project or service key on this PC → DB-backed tests (RLS cross-tenant, Step 0 through the real RPC, Playwright) need an owner-provided staging project. Pure-logic tests run locally.
