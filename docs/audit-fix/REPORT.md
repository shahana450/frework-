# Launch-blocker fixes: report for review

**Branch:** `fix/launch-blockers`. It starts from the live baseline `fd7c102` and has 30 commits, including the hotfix merge.

**Not done on purpose:**
- Nothing was pushed, merged or deployed.
- No migration or SQL was run anywhere.
- No production data or secrets were touched.

**Checks (after every task):**
- `tsc --noEmit -p apps/web` is clean.
- `npm run test:accounting` gives **200 passed, 0 failed** (was 163).
- `npx playwright test --list` loads all 8 end-to-end tests. They have **not been run**: they need seeded users (section 6).

**Legal text needs lawyer review before launch.**

**No `next build` was run.** Run `npm install` on Windows first: the lockfile now pins next 15.5.27 and axios 1.20.0 (section 7).

## 1. Status by task (Cowork prompt, Part B)

| Task | Status | Commit | What changed |
|---|---|---|---|
| 1. Owner decisions | Done | 9998b2d | One FreBook plan at ₹1,499/month + GST (`FREBOOK_PLAN`). The server (Razorpay `PLAN_PRICES`, PhonePe `PLAN_PAISE`) sells only that plan, monthly. Homepage, hero and login show ₹1,499. The old four-tier `/subscribe` checkout redirects to `/pricing`. "FrePilot" is gone from `src/` and `/frepilot` redirects to `/pricing`. No platform fee anywhere. One 7-day refund rule. Old plan ids display as "FreBook (earlier plan: X)". Test `t1.ownerDecisions`. |
| 2. Legal pages | **Blocked: Part A is blank** | — | Not started. The live pages still name "FreWork Business Solutions", which has not been verified. Needs the ten Part A values (section 8). |
| 3. Tally reliability | Done | b96da20 | Push status is per Tally company (`fw_fin_integration_sync.target`). Books shows "Pushed" only for the company open now, with a "Pushed to <company>" hint. B12 confirmed: new numbers come from a locked counter per series, and new-format numbers have a unique index. New migration renumbers old duplicates that were not pushed. Old bridge copies removed. The 111 MB setup zip is untracked. Every connection error names the port and says what to check. Test `t3.tally`. |
| 4. Export signs | Done | 8c1659e | The Balance Sheet and P&L Excel exports are built only from `presentBalanceSheet` / `presentPL`. Print / PDF prints the same presented statement. Tested on the step-0 book. Test `t4.exportSigns`. |
| 5. Data export and delete | Done (needs migration) | f6e5fba | Settings → Business → Your data. "Export all my data" is a ZIP of CSVs and is for members only (the FreWork admin is excluded). "Delete this business" is for the owner only, who types the name to confirm. It soft-deletes; a scheduled job hard-deletes after 30 days (pg_cron). A deleted business is closed in the API gate and in RLS. Test `t5.dataControls`. |
| 6. Active-business context | Done | 7798106 | One store plus a React context in the finance layout, resolved before any page mounts. `<main>` is keyed by business, so a switch remounts the page. All 50 pages use `readActiveBusiness()`; none read localStorage directly. A team member's business (CA desk) is no longer replaced by their own. Test `t6.activeBusiness`. |
| 7. Tests and performance | Partly done | dcb8bcd | Playwright config (localhost only) and specs for all 7 flows. Seed scripts for local or staging only. 10k-voucher seed and a speed test. Index migration. Dependabot. npm audit: next and axios updated. **Not run:** E2E, seed and timings (section 6). |
| 8. Report and hand-back | Done | fd75caa | This report. |
| 9. CSP and PR | Done | 563e5ef | CSP enforced (owner confirmed staging reports were clean). Hotfix branch merged with `-s ours` (cb9e016). PR opened to `main`. |

Earlier work on this branch (B1–B18, security, SEO) is unchanged; see commits `9ea5764` … `04400dc`.

## 2. Migrations: run on **staging**, in this order

All files are in `apps/web/src/app/finance/migrations/`. None has been run.

1. `2026-10-15_b2_party_backfill.sql`: party ledgers and backfill.
2. `2026-10-16_b12_voucher_series.sql`: voucher series per type and financial year.
3. `2026-10-17_b5_tally_link.sql`: Tally link per business.
4. `2026-10-18_b6_rls_hardening.sql`: RLS on one membership rule.
5. **Check:** run `apps/web/tests/rls/cross_tenant.sql` as two different test users. Every cross-tenant query must return 0 rows or an error.
6. `2026-10-19_t3_renumber_duplicates.sql`: **first** run step 0 (`select * from fw_fin_duplicate_entry_numbers …`) and send me the result. Then run the file. It renumbers only duplicates that were never pushed to Tally.
7. `2026-10-20_t5_business_delete.sql`: delete-business columns, member functions and the 30-day purge. Enable **pg_cron** first (Database → Extensions); otherwise the schedule step is skipped with a notice. If B6 is ever re-run, run this file again after it.
8. `2026-10-21_t7_perf_indexes.sql`: indexes for the busiest queries. Run it after timing step 6 below shows a page over 2 seconds, or anyway; it is safe either way.
9. **Check again:** run `cross_tenant.sql` as two users after step 7, because step 7 redefines `fw_fin_is_member` / `fw_fin_can_write`.

## 3. Staging smoke test

1. **FreBook post:** in FreBook chat, type "Paid office rent ₹15,000 in cash" → **✓ Confirm & Post**. The entry gets a series number like `PV/2026-27/0001` and shows in Books.
2. **Bulk template:** FreBook → "⬇ Excel template", fill two entries → upload → **Post 2 entries** → both appear in Books.
3. **Reversal:** Journals → open the rent entry → Reverse with a reason. A reversal pair appears, linked both ways. Reversing again is refused.
4. **Tally connect and push:** Tally page → enter the port in the box → Connect.
   - Wrong port: the message names that port and says what to check.
   - Books → Push all → the entries show "✓ Pushed".
   - Open another company in Tally → Check Tally: the entries show "Not pushed · Pushed to <first company>".
5. **Receivables:** post a credit sale to a new customer. The customer appears in Receivables with the right amount and ageing.
6. Also check:
   - Settings → Business → Export all my data downloads a ZIP of 7 files.
   - As a viewer, the delete section is hidden.
   - Balance Sheet → Excel matches the screen line by line.

## 4. Bringing the hotfixes into `fix/launch-blockers`

All three are already on this branch:
- `2b2067e` (Tally port auto-detect, also deletes `/frepilot`) = `6799e9c`.
- `db2ee0e` (year dropdown) is in 9998b2d.
- `392e38f` (clear unconfirmed "Pushed" marks) is in 9998b2d. Task 3 then made it per company.

A normal `git merge hotfix/tally-port` would conflict in four places (books, tally page, tallyUtils), because Task 3 rewrote those exact lines. **Done (approved):** the hotfixes were recorded as merged without conflicts, keeping this branch's versions:

```
git checkout fix/launch-blockers
git merge -s ours hotfix/tally-port -m "Merge hotfix/tally-port (2b2067e, db2ee0e, 392e38f already included)"
```

Don't cherry-pick them; that recreates the same conflicts.

## 5. Pushed duplicates for the owner to decide

I can't list them without running SQL. Step 6.0 in section 2 lists every duplicate entry number, with `action = 'PUSHED DUPLICATE — owner decides'` for entries already in Tally under the old number. For each one, choose one of:
- keep it (Tally and FreWork share the number);
- renumber it in FreWork and alter the voucher number in Tally;
- reverse it and re-post it.

## 6. What still needs running (Task 7)

- **E2E:**
  1. Copy `apps/web/e2e/fixtures/test-users.example.json` to `test-users.json` (git-ignored) and set two passwords.
  2. Set `FW_STAGING_SUPABASE_REF` (staging project ref).
  3. Run `node --experimental-strip-types scripts/seed-e2e.ts` against staging or local Supabase.
  4. Start `npm run dev` with staging env and run `npx playwright test`.

  The seed scripts refuse any host other than localhost or that staging ref.
- **Speed:**
  1. Run `FW_SEED_PASSWORD=… node --experimental-strip-types scripts/seed-10k.ts`.
  2. Run `E2E_PERF=1 npx playwright test perf`. Results go to `e2e-report/perf.json`.

  Fix anything over 2 seconds from those numbers. Books loads every entry with its lines, 500 at a time, and is the likely slow one.
- **`npm audit fix` for the rest:** blocked by an existing peer-dependency conflict in `apps/mobile` (expo-font vs @expo/vector-icons); npm refuses without `--legacy-peer-deps`. Most other high and critical items are in the mobile and API apps or need major upgrades (expo, react-native, nestjs, firebase-admin, multer, nodemailer, sharp).
  - `xlsx` (SheetJS on npm) has no fixed npm release.
  - `tailwindcss` 3.x has no fix within 3.x.

## 7. Notes

- Run `npm install` on Windows before building: next 15.5.27 fixes critical advisories, including RCE in image optimisation and cache poisoning. Production runs 15.5.19.
- `apps/web/public/tally-bridge-setup.zip` (111 MB) was removed from this branch's history (owner approved), so it can be pushed. Every commit hash on the branch changed; the old branch is kept locally as `backup/launch-blockers-before-rewrite`, and `hotfix/tally-port` is untouched. The file stays on disk, git-ignored.
- `public/tally-bridge.zip` (the old Chrome-extension bridge) is not linked from anywhere; it was left in place.
- The PhonePe subscription path now accepts only the `frebook` plan. Old signed links for other plans fail verification.
- CSP is enforced (Task 9). Add any new third-party origin to `next.config.ts` before using it, or the browser will block it.

## 8. Needs owner decision

1. **Part A legal values:** entity name, CIN, GSTIN, registered address, jurisdiction city, AI provider, grievance officer, support email, effective date and staging Supabase project. Task 2 waits for these.
2. **Pushed duplicate numbers** (section 5).
3. **pg_cron** on staging and production for the 30-day purge, or a Vercel Cron route instead.

---

Task 9 done. The PR is open for you to merge and deploy. Nothing has been deployed.
