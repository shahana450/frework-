import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type APIRequestContext } from "@playwright/test";

export type TestUser = { email: string; password: string; business: string };
export type Users = { userA: TestUser; userB: TestUser };

const FILE = join(__dirname, "test-users.json");

/** Seeded users from e2e/fixtures/test-users.json; tests skip with a clear reason when it's missing. */
export function loadUsers(): Users | null {
  if (!existsSync(FILE)) return null;
  const u = JSON.parse(readFileSync(FILE, "utf8")) as Users;
  return u.userA?.password && !u.userA.password.startsWith("<") ? u : null;
}
export const NO_USERS = "e2e/fixtures/test-users.json is missing — run scripts/seed-e2e.ts on local/staging Supabase first";

export async function signIn(page: Page, u: TestUser) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(u.email);
  await page.getByPlaceholder("••••••••").fill(u.password);
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** The signed-in user's Supabase access token, read from the browser session. */
export async function tokenOf(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        try { return (JSON.parse(localStorage.getItem(k) ?? "{}") as { access_token?: string }).access_token ?? ""; } catch { return ""; }
      }
    }
    return "";
  });
  expect(token, "signed-in session").toBeTruthy();
  return token;
}

/** The active business shown in the header (the finance layout keeps one per user). */
export async function activeBusinessId(page: Page): Promise<string> {
  await page.goto("/finance/books");
  const id = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) ?? ""; if (k.startsWith("fw_fin_biz_")) return localStorage.getItem(k) ?? ""; }
    return "";
  });
  expect(id, "active business").toMatch(/^[0-9a-f-]{36}$/);
  return id;
}

export const api = (request: APIRequestContext, token: string) => ({
  get: (path: string) => request.get(path, { headers: { authorization: `Bearer ${token}` } }),
  post: (path: string, data: unknown) => request.post(path, { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, data }),
});
