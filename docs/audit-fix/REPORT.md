# Launch-blocker fixes: report for review

**Branch:** `fix/launch-blockers`. It starts from `86bd434` and has 19 commits.

**Not done on purpose:**
- Nothing was pushed to main.
- Nothing was deployed.
- No migration was run anywhere.
- No production data or secrets were touched.

**Checks:**
- `tsc --noEmit` is clean.
- `npm run test:accounting` gives **163 passed, 0 failed**.
- The step-0 baseline test (`tests/accounting/step0.baseline.test.ts`, commit `fa8037a`) locks the audit's 11-voucher book.

**No `next build` was run:** local SWC is blocked on this machine. The Vercel preview build is the first full build.

## 1. Status by issue

| # | Status | Commit | What changed |
|---|---|---|---|
| B1 | Fixed | 03ef71a | Statements show signed amounts. An overdrawn bank is shown as a liability. There is a footing check. |
| B2 | Fixed (needs migration) | 8ab62f3 | One ledger per customer or supplier. Receivables and payables are shown by party, with FIFO ageing and advances. |
| B3, B4, B10, B18 | Fixed | f704f11 | Draft validation is deterministic. The AI proposes, code checks amounts, ledgers and parties, and prompt injection is refused. The server enforces this on confirm. |
| B5 | Fixed (needs migration) | f98f52a | The Tally link is per business. A push fails if the Tally company does not match. |
| B6 | Fixed (needs migration) | 8cb3f0f | RLS uses one membership rule. The browser cannot post or delete journals. The audit log keeps before and after values. |
| B7, B8 | Fixed | 8878f71 | Unverified claims removed (50 copy changes). CA-reserved audits taken out of the software tiers. Testimonials hidden. |
| B9 | Fixed | d9eb783 | A business is created only from the Review step. GST status must be chosen. |
| B11 | Fixed | f9ac5db | The GST summary counts a sale as taxable only when GST was charged on it. |
| B12 | Fixed (needs migration) | df63cdb | Voucher series run per voucher type and financial year. An asset bought from the bank is recorded as a Payment. |
| B13, B15, B16 | Fixed | 75846c2 | Reversal pairs are linked and never duplicated. Each warning names its own fix. A new cash ledger is allowed to go negative. |
| B14 | Fixed | 3b62542 | The in-app confirmation lists every warning. Confirm & Post shows a spinner. |
| B17 | Fixed | 7b9263d | Unposted drafts survive a reload, a new tab and New Chat. |
| Security | Fixed | 4e0e650, abecd93 | PhonePe orders are HMAC-signed, priced on the server and amount-checked. CSP is in report-only mode. CORS is pinned. `x-powered-by` is removed. |
| Performance | Partly done | aff851a | One local user lookup per page load. The 10k-voucher test was not done (section 5). |
| SEO | Fixed | d7b04c8 | The title suffix is no longer doubled. Login, register and finance have their own titles. `/refund` redirects to `/refund-policy`. Every footer links to Refund Policy and Contact. |
| Legal | Draft only | — | `docs/audit-fix/legal/DRAFTS.md`. The live pages are unchanged (section 2). |

## 2. Placeholders the owner must fill

These are in `docs/audit-fix/legal/DRAFTS.md`. The live legal pages still name "FreWork Business Solutions", and that name has not been verified.

- `{{LEGAL_ENTITY_NAME}}`
- `{{CIN}}`
- `{{GSTIN}}`
- `{{REGISTERED_ADDRESS}}`
- `{{JURISDICTION_CITY}}`
- `{{AI_PROVIDER}}`, plus its data-retention and training terms
- `{{GRIEVANCE_OFFICER_NAME}}`
- `{{EMAIL}}`
- `{{REFUND_WINDOW_DAYS}}`
- `{{FREBOOK_PRICE_SCHEDULE}}`
- `{{EFFECTIVE_DATE}}`

A lawyer should review the drafts before they replace `/terms`, `/privacy` and `/refund-policy`.

## 3. Copy changes

There are 50 before→after pairs, recorded in `docs/audit-fix/copy-changes.json` and guarded by `b7.copy.test.ts`. "Chartered Accountants & Tax Consultants" no longer appears anywhere, and the test enforces that.

## 4. Migrations: run on **staging**, in this order

All four files are in `apps/web/src/app/finance/migrations/`.

1. `2026-10-15_b2_party_backfill.sql`: creates the party ledgers and backfills them.
2. `2026-10-16_b12_voucher_series.sql`: voucher series per type and financial year.
3. `2026-10-17_b5_tally_link.sql`: Tally link per business.
4. `2026-10-18_b6_rls_hardening.sql`: rebuilds RLS and revokes the browser's post and delete rights.

After step 4, run `apps/web/tests/rls/cross_tenant.sql` as two different test users. Every cross-tenant query must return 0 rows or an error.

Then smoke-test the staging app:
- a FreBook post;
- a reversal;
- a Tally push;
- the receivables page.

## 5. Not done

- Playwright end-to-end tests.
- A performance seed of 10,000 vouchers.
- Moving the tests to Vitest (they still use `node:test`).
- More than one pending FreBook draft at a time (B4 currently handles one).
- An active-business context provider. The business is still read per page.
- Signs in the Excel and PDF exports. B1 fixed the screens only.
- Dependabot and `npm audit` triage.
- Data export and "delete business" flows, which the Privacy draft promises.
- Moving CSP from report-only to enforced, after a week of reports.

## 6. Needs owner decision

1. **Prices disagree:**
   - `plans.ts` has ₹2,999, ₹3,999 and ₹4,999.
   - The public site says ₹999.
   - The order page says ₹1,499.

   Choose one set; `PLAN_PRICES` and the server-side PhonePe pricing then follow it.
2. **Product naming:** whether to keep "FrePilot" as the name of the Virtual CA, or use one name only.
3. **The 5% platform fee:** keep it, show it at checkout, or drop it.
4. **Testimonials:** hidden with `SHOW_TESTIMONIALS=false` until real, consented testimonials exist.
5. **Legal entity and placeholders:** section 2.
6. **Refund window:** one rule, replacing the current 48-hour and 7-day rules.

---

Stopping here for review, as the brief asks. Nothing has been deployed.
