// Turns ledger names (from the AI, a statement or a user) into account ids.
// Missing ledgers are created only when their group is clear or was chosen by the user.
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferHead, headByKey, headFromType, type LedgerHead } from "./ledgerHeads";

export type Wanted = { name: string; suggestedType?: string | null };
export type Resolved =
  | { ok: true; ids: Map<string, { id: string; name: string }>; created: { name: string; head: string }[] }
  | { ok: false; needHeads: { account: string; suggested: string }[]; willCreate: { account: string; head: string }[] };

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

export function makeFinder(accounts: { id: string; name: string }[]) {
  const exact = new Map(accounts.map(a => [norm(a.name), a]));
  return (name: string) => {
    const key = norm(name);
    const hit = exact.get(key);
    if (hit) return hit;
    // Close variants only ("HDFC" ↔ "HDFC Bank"), never short fragments
    for (const [k, v] of exact) if (k.length > 3 && key.length > 3 && (k.includes(key) || key.includes(k))) return v;
    return undefined;
  };
}

export async function resolveLedgers(sb: SupabaseClient, businessId: string, wanted: Wanted[], chosenHeads: Record<string, string> = {}, createdBy = "FreBook"): Promise<Resolved> {
  const accounts: { id: string; name: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("fw_fin_chart_of_accounts").select("id,name").eq("business_id", businessId).eq("is_group", false).range(from, from + 999);
    accounts.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  let find = makeFinder(accounts);

  const toCreate = new Map<string, LedgerHead>();
  const needHeads = new Map<string, string>();
  for (const w of wanted) {
    const name = w.name.trim();
    if (!name || find(name) || toCreate.has(name) || needHeads.has(name)) continue;
    const head = (chosenHeads[name] && headByKey(chosenHeads[name])) || inferHead(name);
    if (head) toCreate.set(name, head); else needHeads.set(name, headFromType(w.suggestedType).key);
  }
  if (needHeads.size) {
    return { ok: false, needHeads: [...needHeads].map(([account, suggested]) => ({ account, suggested })), willCreate: [...toCreate].map(([account, h]) => ({ account, head: h.label })) };
  }

  const created: { name: string; head: string }[] = [];
  if (toCreate.size) {
    const stamp = Date.now().toString().slice(-6);
    const { data, error } = await sb.from("fw_fin_chart_of_accounts").insert(
      [...toCreate].map(([name, h], i) => ({ business_id: businessId, name, type: h.type, sub_type: h.sub_type, code: `AUTO-${stamp}${i}`, is_group: false, is_system: false, description: `Created by ${createdBy} under ${h.label}` })),
    ).select("id,name");
    if (error) throw new Error(`Could not create ledgers: ${error.message}`);
    for (const a of data ?? []) { accounts.push(a); created.push({ name: a.name, head: toCreate.get(a.name)?.label ?? "" }); }
    find = makeFinder(accounts);
    // A new customer / supplier ledger is also a contact, so Customers & Suppliers and every party picker list it
    const parties = (data ?? []).map(a => ({ a, h: toCreate.get(a.name) })).filter(x => x.h?.key === "debtors" || x.h?.key === "creditors");
    if (parties.length) {
      const rows = parties.map(({ a, h }) => ({ business_id: businessId, name: a.name, type: h!.key === "debtors" ? "customer" : "vendor", is_active: true, ledger_account_id: a.id }));
      const ins = await sb.from("fw_fin_contacts").insert(rows);
      // Older databases without the ledger link column (P3) still get the contact
      if (ins.error && /ledger_account_id/.test(ins.error.message)) await sb.from("fw_fin_contacts").insert(rows.map(({ ledger_account_id: _l, ...r }) => { void _l; return r; }));
    }
  }

  const ids = new Map<string, { id: string; name: string }>();
  for (const w of wanted) { const a = find(w.name); if (a) ids.set(w.name.trim(), a); }
  return { ok: true, ids, created };
}
