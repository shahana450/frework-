// FreWork finance — end-to-end on localhost with seeded users (Task 7). Run: npx playwright test (from apps/web).
import { test, expect } from "@playwright/test";
import { loadUsers, NO_USERS, signIn, tokenOf, activeBusinessId, api } from "./fixtures/users";

const users = loadUsers();
test.skip(!users, NO_USERS);
const today = () => new Date().toISOString().slice(0, 10);
const tag = () => `E2E-${Date.now().toString(36)}`;

test.describe.serial("user A — books", () => {
  let token = "", biz = "", posted = { id: "", entry_no: "" };

  test("signs in and lands in the app", async ({ page }) => {
    await signIn(page, users!.userA);
    token = await tokenOf(page);
    biz = await activeBusinessId(page);
    await expect(page.getByText(users!.userA.business).first()).toBeVisible();
  });

  test("posts an entry in FreBook and sees it in Books", async ({ page, request }) => {
    await signIn(page, users!.userA);
    const t = tag();
    const r = await api(request, token).post("/api/finance/journals/post", {
      business_id: biz, mode: "post", date: today(), type: "payment", narration: `Office rent ${t}`, source: "e2e",
      account_heads: { "Office Rent": "indirect_expense", "Cash": "cash" },
      lines: [{ account_name: "Office Rent", dr: 15000, cr: 0 }, { account_name: "Cash", dr: 0, cr: 15000 }],
    });
    const body = await r.json();
    expect(r.status(), JSON.stringify(body)).toBe(200);
    expect(body.status).toBe("posted");
    posted = { id: body.id, entry_no: body.entry_no };
    expect(posted.entry_no).toMatch(/^[A-Z]{2,6}\/\d{4}-\d{2}\/\d{4}$/);   // B12 series
    await page.goto("/finance/books");
    await expect(page.getByText(posted.entry_no)).toBeVisible();
  });

  test("reverses that entry", async ({ request }) => {
    const r = await api(request, token).post("/api/finance/journals/reverse", { business_id: biz, journal_id: posted.id, reason: "E2E reversal" });
    const body = await r.json();
    expect(r.status(), JSON.stringify(body)).toBe(200);
    expect(body.reversal_entry_no).toBeTruthy();
    // Reversing twice is refused
    const again = await api(request, token).post("/api/finance/journals/reverse", { business_id: biz, journal_id: posted.id, reason: "again" });
    expect(again.status()).toBeGreaterThanOrEqual(400);
  });

  test("the Balance Sheet foots", async ({ page, request }) => {
    const r = await api(request, token).get(`/api/finance/reports?business_id=${biz}&report=balance_sheet`);
    const bs = await r.json();
    expect(r.status()).toBe(200);
    expect(bs.presented.footed, bs.presented.problems?.join("; ")).toBe(true);
    expect(bs.presented.totalAssets).toBe(bs.presented.totalLiabilities);
    await signIn(page, users!.userA);
    await page.goto("/finance/reports?tab=balance_sheet");
    await expect(page.getByRole("alert")).toHaveCount(0);   // no "doesn't add up" banner
  });

  test("receivables show a credit sale to a customer", async ({ page, request }) => {
    const party = `E2E Customer ${tag()}`;
    const r = await api(request, token).post("/api/finance/journals/post", {
      business_id: biz, mode: "post", date: today(), type: "sales", narration: `Credit sale to ${party}`, party_name: party, source: "e2e",
      account_heads: { [party]: "debtors", "Sales": "sales" },
      lines: [{ account_name: party, dr: 11800, cr: 0 }, { account_name: "Sales", dr: 0, cr: 11800 }],
    });
    expect(r.status(), JSON.stringify(await r.json())).toBe(200);
    await signIn(page, users!.userA);
    await page.goto("/finance/receivables");
    await expect(page.getByText(party)).toBeVisible();
  });

  test("bulk template upload posts entries that appear in Books", async ({ page }) => {
    const XLSX = await import("xlsx");
    const t = tag();
    const d = new Date(); const dmy = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    const ws = XLSX.utils.aoa_to_sheet([
      ["Date", "Particulars", "Debit", "Credit", "Narration"],
      [dmy, "Office Rent", 2500, "", `Bulk rent ${t}`], ["", "Cash", "", 2500, ""],
      [dmy, "Bank Charges", 118, "", `Bulk charges ${t}`], ["", "Cash", "", 118, ""],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Entries");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    await signIn(page, users!.userA);
    await page.goto("/finance/chat-book");
    await page.locator('input[type="file"]').first().setInputFiles({ name: `bulk-${t}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await page.getByRole("button", { name: /^Post \d+ entr/ }).click();
    await expect(page.getByText(/✓ Posted 2 entries/)).toBeVisible({ timeout: 45_000 });
    await page.goto("/finance/books");
    await expect(page.getByText(`Bulk rent ${t}`)).toBeVisible();
    await expect(page.getByText(`Bulk charges ${t}`)).toBeVisible();
  });
});

test("two users cannot see each other's data", async ({ browser, request }) => {
  const a = await browser.newPage(); await signIn(a, users!.userA);
  const aToken = await tokenOf(a); const aBiz = await activeBusinessId(a);
  const b = await browser.newPage(); await signIn(b, users!.userB);
  const bToken = await tokenOf(b); const bBiz = await activeBusinessId(b);
  expect(aBiz).not.toBe(bBiz);

  // B asks the API for A's business: refused everywhere
  for (const path of [`/api/finance/reports?business_id=${aBiz}&report=balance_sheet`, `/api/finance/integrations/sync?business_id=${aBiz}`, `/api/finance/data-export?business_id=${aBiz}`]) {
    const r = await api(request, bToken).get(path);
    expect(r.status(), path).toBe(403);
  }
  const post = await api(request, bToken).post("/api/finance/journals/post", {
    business_id: aBiz, mode: "post", date: today(), type: "journal", narration: "cross-tenant attempt",
    lines: [{ account_name: "Cash", dr: 1, cr: 0 }, { account_name: "Capital", dr: 0, cr: 1 }],
  });
  expect(post.status()).toBe(403);

  // Row level security: B's token reads none of A's rows straight from Supabase (needs the local Supabase env)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    for (const table of ["fw_fin_journals", "fw_fin_chart_of_accounts", "fw_fin_contacts", "fw_fin_businesses"]) {
      const col = table === "fw_fin_businesses" ? "id" : "business_id";
      const r = await request.get(`${url}/rest/v1/${table}?${col}=eq.${aBiz}&select=*&limit=5`, { headers: { apikey: anon, authorization: `Bearer ${bToken}` } });
      const rows = r.ok() ? await r.json() : [];
      expect(Array.isArray(rows) ? rows.length : 0, table).toBe(0);
    }
  }

  // And A's own API calls still work
  expect((await api(request, aToken).get(`/api/finance/reports?business_id=${aBiz}&report=trial_balance`)).status()).toBe(200);
  await a.close(); await b.close();
});
