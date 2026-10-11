# Backend fixes: run-book

Branch `fix/backend-bugs`, cut from `fix/launch-blockers` at `7898a87`. There's one commit per phase:

| Phase | Commit | What it does |
|---|---|---|
| 1 | `095f1b9` | Stops new bad data: one `validateJournal()`, bank import batches with duplicate detection, the voucher series table |
| 2 | `e0c3098` | Repair scripts, scoped to one company, dry run by default |
| 3 | `8a921db` | Party ledgers, one AR/AP source, Balance Sheet placement and footing |
| 4 | `f97eb32` | GST amounts per return period, health rules, Tally per-company link and GUID matching |
| 5 | `7c66339` | Banking history, due-date wording, page titles, test companies, reports tab |

`npm run test:accounting` gives **278 passed, 0 failed**. `tsc --noEmit` is clean.

## Files changed

**New:**
- `src/lib/journalRules.ts`
- `src/lib/bankImport.ts`
- `src/lib/repairPlan.ts`
- `src/lib/gst3b.ts`
- `src/lib/tallyMatch.ts`
- `src/lib/dueText.ts`
- `src/app/api/finance/businesses/route.ts`

**Changed:**

| Area | Files |
|---|---|
| Posting | `lib/posting.ts` |
| Bank import | `confirm-batch`, `bank-to-journals`, `StatementModal`, `inbox/page` |
| Reports | `lib/statements.ts`, `api/finance/reports` |
| AR/AP, alerts and due dates | `lib/partyBalances.ts`, `lib/dashboard.ts`, `lib/compliance.ts`, `HomeDesk` |
| GST | `api/finance/gst`, `gst/3b/page`, `gst/returns/page` |
| Tally | `lib/integrations/tally.ts`, `lib/tallyUtils.ts`, `lib/tallyPushRun.ts`, `lib/tallyConnection.ts`, `api/tally-push`, `api/tally-link`, `api/integrations/sync`, `books/page` |
| Invoices | `api/invoice-doc` |
| Small fixes | `banking/history/page`, `finance/layout`, `reports/page`, `select-business/page` |

**Tests:** `p1.rules`, `p2.repair`, `p3.reports`, `p4.gst_tally_health`, `p5.small`. Updated: `posting`, `b1`, `b12`, `t4`, `dashboard`.

## Migrations (run on STAGING first, in this order)

These come **after** the launch-branch migrations: B2, B12, B5, B6, T5, T7. **Don't run T3's step 2.** It renumbers every company at once, and the per-company version below replaces it.

| # | File | What it does |
|---|---|---|
| 1 | `2026-10-22_p1_journal_rules.sql` | <ul><li>CHECK constraint: a line is never both debit and credit (new rows only).</li><li>The Phase 1 rules inside `fw_fin_post_journal`.</li><li>`fw_fin_voucher_series` with SELECT … FOR UPDATE; series INV/RCT/PMT/PUR/JV/CTR/CN/DN, with FY from the entry date.</li><li>Unique (business, FY, type, number).</li><li>`fw_fin_bank_import_batches`.</li></ul> |
| 2 | `2026-10-23_p2_repairs.sql` | The repair functions below (dry run by default) |
| 3 | `2026-10-24_p3_parties.sql` | <ul><li>`contacts.ledger_account_id`, `journal_lines.party_id` (filled automatically), `journals.against_invoice_id`, `invoice_docs.party_id`.</li><li>The control-ledger repair.</li></ul> |
| 4 | `2026-10-25_p4_tally_gst.sql` | Tally port and last verified time; `journals.tally_guid`, unique per business |
| 5 | `2026-10-26_p5_small.sql` | `businesses.is_test` |

## Repair commands for AUDIT TEST TRADERS (Supabase → SQL Editor)

First find the ids:

```sql
select id, name from fw_fin_businesses;                                                    -- company_id
select id, name, sub_type from fw_fin_chart_of_accounts
 where business_id = '<company_id>' and sub_type in ('bank','cash');                        -- bank ledger id
-- your user id: Authentication → Users
```

Entries in a **locked** financial year are reported, not changed. Unlock FY 2025-26 under Settings → Financial Years, run the repairs, then lock it again. Run each step's preview first and check the result before applying it.

1. **Bank import posted against the wrong ledger.** It reverses each wrong entry and re-posts it against the real bank.
   ```sql
   select * from fw_fin_repair_tb('<company_id>', '<bank_ledger_id>');                                -- trial balance before vs after
   select * from fw_fin_repair_bank_mismap('<company_id>', '<bank_ledger_id>', '<user_id>');          -- preview
   select * from fw_fin_repair_bank_mismap('<company_id>', '<bank_ledger_id>', '<user_id>', false);   -- apply
   ```
2. **Duplicate voucher numbers.** Entries already pushed to Tally, and entries in locked years, are listed but not changed.
   ```sql
   select * from fw_fin_repair_renumber('<company_id>');           -- preview
   select * from fw_fin_repair_renumber('<company_id>', false);    -- apply
   ```
3. **Control ledgers moved to party ledgers.** Debtors and Creditors Control then become groups.
   ```sql
   select * from fw_fin_repair_control_ledgers('<company_id>', '<user_id>');          -- preview
   select * from fw_fin_repair_control_ledgers('<company_id>', '<user_id>', false);   -- apply
   ```
4. **Mark it as a test company, then check the result.**
   ```sql
   update fw_fin_businesses set is_test = true where id = '<company_id>';
   select * from fw_fin_trial_balance('<company_id>');
   ```

The duplicate cheque CL011206 (26 Mar ₹20 lakh, 27 Mar ₹1 lakh) isn't reversed automatically. Only you know which of the two is real. Reverse the wrong one from Journal Entries → Reverse.

## Checks after the repairs (the "done when" list)

| Check | Where |
|---|---|
| No abnormal Debtors/Creditors balance in the Trial Balance; Debtors and Creditors Control are now groups | Reports → Trial Balance |
| Balance Sheet "footed" with no warning banner | Reports → Balance Sheet |
| The same AR/AP figure in all four places | Home, MIS, Receivables, Payables |
| Sept GSTR-3B ₹0 and October ₹12,600 | Home due dates, MIS, GSTR-3B page "per books" line |
| `fw_fin_duplicate_entry_numbers` lists only Tally-pushed or locked-year rows | SQL: `select * from fw_fin_duplicate_entry_numbers where business_id = '<company_id>' and action <> 'keeps number';` |
| All tests pass | `npm run test:accounting` |

## Not done, or for you to decide

- **Entries held for review:** GST-registered sales or purchases without GST lines are now saved as drafts marked `needs_review` instead of being posted. Post them from Journals once checked. Truly exempt sales need **Post anyway**, which the chat confirm dialog doesn't offer yet.
- **Possible duplicates in bank import:** these are held back with the reason. The statement window doesn't yet have a "post anyway" toggle. Today you re-import the row with `confirm_duplicate`, or post it from FreBook.
- **Rules in the database:** same ledger on both sides, receipts/payments needing cash or bank, and dates outside a FY are enforced both in `postJournal` and in `fw_fin_post_journal`. The browser-side draft editor (`journals/[id]/edit`) still writes draft lines directly; drafts are validated when posted.
