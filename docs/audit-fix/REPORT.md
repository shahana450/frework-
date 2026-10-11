# Round 2 (COWORK_PROMPT_2): report for review

**Branch:** `fix/launch-blockers`, four new commits on top of `2d51052`. **Nothing was pushed, merged or deployed. No SQL was run. No secrets were touched.** The `wsg-hotfix` folder was only read, to copy wording.

**Checks after every task:** `tsc --noEmit -p apps/web` is clean. `npm run test:accounting` (with `.test-dist` deleted first) gives **250 passed, 0 failed** (was 225).

**Part A as answered by the owner (11 Oct 2026):**
- Old Starter / Professional / Enterprise plans: **no**, only FreBook ₹1,499.
- Income-tax portal provider: **sandbox** at first. Sandbox has no ITR-status API, so the owner then chose **Deepvue**.
- Legal entity name, CIN, GSTIN, address, jurisdiction, grievance officer and email: **not given yet**, so Task 4 waits.

## R2.1 Status by task

| Task | Status | Commit | What changed |
|---|---|---|---|
| 1. Pricing on the launch branch | Done | d7114ee | `/pricing` and `/finance/pricing` show only FreBook with **🎁 Claim 1 month free**. It calls `POST /api/finance/subscription/claim-trial`, shows the result and goes to `/finance/start`. Wording is from production: "Start with one month free" and "₹0 for the first month · then ₹1,499 + GST/month". Logged-out visitors go to `/register?plan=frebook`. Anyone with any subscription row (paid, trial or expired) sees Subscribe instead. The claim logic moved to `lib/claimTrial.ts`. **Bug fixed:** the route used `maybeSingle()`, which returns no row when a user has several rows, so the claim went through; it now uses `limit(1)`. Test `claimTrial`: a second claim returns 409, also after expiry, for old-plan accounts and in a race. The database is mocked. |
| 2. Income tax | Done, **through Deepvue** (owner's choice) | 3c116ee | Sandbox has no ITR-status API (R2.2), so the owner chose Deepvue. `createDeepvueItProvider()` in `lib/portals/deepvue.ts`, registered as `ADAPTERS.deepvue` for `portal === "it"` (`ERI_PROVIDER=deepvue`). Shows ITR filed, e-verified and processed, with acknowledgement number and date, one row per assessment year (a revised return replaces the original), plus a refund row when the portal's status mentions a refund. **Deepvue links with the Income-tax portal password, not an OTP** (R2.2a). `ERI_PROVIDER=sandbox` now fails clearly instead of showing demo data. Test `deepvue.portal` uses Deepvue's documented sample reply. |
| 3. Portal Connect data on the GST pages | Done | 93efc61 | When the GSTIN is linked through Sandbox: the GST Returns centre shows **Filed ✓** with date and ARN on each due card that is already filed; GSTR-3B and GSTR-9 show "Filed on … (ARN …)". Demo data never marks anything filed. **GSTR-2B:** Sandbox can fetch it with a taxpayer OTP session, so ITC Match has **Fetch 2B from portal** (shown only when `GSP_PROVIDER=sandbox`). Flow: GST portal username → OTP → verify and fetch. Upload still works. See R2.3. Test `portalGst`. |
| 4. Legal pages | **Blocked: Part A legal values are blank** | — | Not started. `DRAFTS.md`, `/terms`, `/privacy` and `/refund-policy` are unchanged. When done: lawyer review before launch. |
| 5. Hand-back | Done | (this commit) | This section, R2.4–R2.6. |

## R2.2 Why Task 2 stopped

Sandbox's official docs (developer.sandbox.co.in, read 11 Oct 2026) offer, for income tax:
- **Calculator, Report and OCR** (`/api-reference/it/overview`): tax P&L, capital gains, Form 16 / 26AS reading;
- **ITR compliance** (`/api-reference/it/compliance/openapi.json`): validate, e-file, e-verify OTP (by acknowledgement number), discard, and get ITR form.

There is **no** endpoint to log in a PAN holder with an OTP, and none for ITR filed / e-verified / processed / refund status. So `createSandboxItProvider()` with `requestOtp`, `verifyOtp` and `fetchStatuses` can't be built without guessing.

**Owner decided (11 Oct):** use Deepvue for income tax and keep Sandbox for GST. A draft email asking Sandbox about an ITR-status API was also prepared, in case they add one later.

## R2.2a Deepvue: what to know before launch

- **Password, not OTP.** Deepvue's `create-client` takes the taxpayer's Income-tax portal username (the PAN) and password. FreWork:
  - sends the password to Deepvue once, when linking;
  - never stores it, logs it or writes it to the audit log (a test enforces this);
  - keeps only Deepvue's `itr_client_id`, encrypted with `PORTAL_TOKEN_KEY`;
  - asks for a consent tick ("I am the PAN holder or have their permission…") before the password field works.
- **Legal and privacy review before launch:** the privacy policy must say that the Income-tax login is shared with Deepvue to read filing status. Have the lawyer check this together with Task 4, and check Deepvue's data-processing terms.
- **Refunds:** Deepvue gives no refund amount or refund-status field; FreWork reads refunds from the portal's status lines ("Refund has been issued", "processed with refund due"). In Deepvue's sample, `no demand no refund` shows no refund row.
- **To confirm on the first Deepvue test** (the docs don't show these):
  - the exact wording of refund status lines;
  - how long an `itr_client_id` stays valid. FreWork treats a link as good for a year and asks the user to reconnect when Deepvue answers `INACTIVE CLIENT`;
  - that `username` is the PAN. The docs' example is just "John Doe", but the Income-tax portal user ID is the PAN.
- The user's PAN password changes on the Income-tax portal will break the link; the user reconnects from Portal Connect.

## R2.3 Notes on the Sandbox GST work (Task 3)

- **The taxpayer token is never stored.** Sandbox's taxpayer token (6 hours) can also file returns, so `/api/finance/gst/portal-2b` uses it once inside the fetch request and drops it. Each fetch asks for a new OTP. No new table or migration was needed.
- **The taxpayer enables API access first:** GST portal → View Profile → Manage API Access → Enable API Request = Yes. The ITC Match panel says this.
- **To confirm on the first Sandbox test** (the docs don't show these):
  - Month format in `/gstrs/gstr-2b/{year}/{month}`: the docs only show `2023/12`. FreWork sends two digits (`2026/09`), like the portal's `MMYYYY`.
  - Where `fc` (file count) sits when a big 2B is split (`status_cd = "3"`). FreWork reads `data.data.fc`, then `data.fc`. If neither is there, it asks the user to upload the file.
  - How GSTR-9 appears in the track list. FreWork matches a GSTR-9 row with any period inside that financial year.
- Filing marks need the GSTIN linked in Portal Connect (`/finance/portals`) with `GSP_PROVIDER=sandbox`.

## R2.4 Migrations still to run on **staging**, in order

Nothing new this round. Still outstanding from round 1 (files in `apps/web/src/app/finance/migrations/`):

1. If staging was made before them: `2026-10-12_portals.sql`, `2026-10-13_connectors.sql`, `2026-10-14_whatsapp.sql`. Portal Connect and Task 3 need `2026-10-12_portals.sql`.
2. `2026-10-15_b2_party_backfill.sql`
3. `2026-10-16_b12_voucher_series.sql`
4. `2026-10-17_b5_tally_link.sql`
5. `2026-10-18_b6_rls_hardening.sql`, then run `apps/web/tests/rls/cross_tenant.sql` as two test users. Every cross-tenant query must return 0 rows or an error.
6. `2026-10-19_t3_renumber_duplicates.sql`: run step 0 first and send me the result.
7. `2026-10-20_t5_business_delete.sql` (enable pg_cron first).
8. `2026-10-21_t7_perf_indexes.sql`: already run in **production** by the owner; run it on staging too.
9. Run `cross_tenant.sql` again after step 7.

## R2.5 Vercel environment variables the owner adds (names only)

- `SANDBOX_API_KEY`
- `SANDBOX_API_SECRET`
- `GSP_PROVIDER` = `sandbox`
- `PORTAL_TOKEN_KEY`: 32 random bytes, base64. It encrypts the stored public-record link, not the 2B session.
- Optional: `SANDBOX_API_BASE`, only to point at Sandbox's test host.
- `ERI_PROVIDER` = `deepvue`
- `DEEPVUE_CLIENT_ID`
- `DEEPVUE_CLIENT_SECRET`
- Optional: `DEEPVUE_API_BASE`, only if Deepvue gives you a test host.

## R2.6 Plan for retiring `hotfix/tally-port`

Production runs `hotfix/tally-port` (`3992b47`), deployed from the `wsg-hotfix` worktree. `fix/launch-blockers` should replace it like this. **Each step that changes something waits for the owner's word.**

1. **Check that nothing is lost (read-only, done 11 Oct):**
   - `git diff --name-status fix/launch-blockers hotfix/tally-port` shows 5 files only on the hotfix: `run-tally-bridge.bat`, `tally-bridge-setup.zip`, `tally-bridge.js`, `components/landing/pricing.tsx` and `promo-offer.tsx`. Round 1 removed all five on purpose (old bridge copies, the 111 MB zip, old pricing).
   - The features listed in the prompt (Smart Inbox, bill match, ITC match, PDF split, GST returns centre, setup, calculators, MIS, ledger groups, R&P template, speed-ups, icon bar, FreBook ₹1,499 with the free month, Sandbox connector) were copied across and are on `fix/launch-blockers`.
   - Before step 4, run `git diff hotfix/tally-port fix/launch-blockers -- apps/web/src/app/finance/inbox apps/web/src/lib/billMatch.ts apps/web/src/lib/itcMatch.ts` and similar for each feature. Every difference should be a launch-branch improvement.
2. **Staging:**
   - Deploy `fix/launch-blockers` to a Vercel **preview** (not `--prod`) with the staging Supabase env.
   - Run R2.4 on staging.
   - Run REPORT §3 (smoke test) plus: claim the free month twice (the second says it's used); link a GSTIN through Sandbox and see Filed ✓ on the Returns centre and 3B; Fetch 2B on ITC Match with a real OTP; link a test PAN through Deepvue on Portal Connect and check the ITR rows and the Home reminder.
   - Run Playwright (§6).
3. **Owner approves staging.**
4. **Record the hotfix as merged.** The hotfix has commits made after round 1's `-s ours` merge, which was done on the old history before the rewrite. On the owner's "merge":

   ```
   git checkout fix/launch-blockers
   git merge -s ours hotfix/tally-port -m "Merge hotfix/tally-port (features already copied across)"
   ```

   Then merge the PR into `main`.
5. **Production database:** run the R2.4 migrations that production lacks (B2, B12, B5, B6, T3 after step 0, T5), in the same order, in a quiet hour. T7 indexes are already there. Back up first (Supabase → Database → Backups).
6. **Deploy:**
   - On the owner's "deploy", run the clean-clone deploy from the prompt with `--branch main` (or `fix/launch-blockers`), from the repo root: `npx vercel@59 --prod --yes`.
   - Keep the previous production deployment's URL. Vercel → Deployments → Promote is the one-click rollback.
7. **After 7 quiet days:** stop deploying from `wsg-hotfix`. Keep the branch as a tag (`git tag prod-before-launch-blockers hotfix/tally-port`), then remove the worktree (`git worktree remove "../wsg-hotfix"`). From then on, only `main` is deployed.

**Waiting for the owner's "approved".** Nothing will be merged or deployed before that.

---

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
