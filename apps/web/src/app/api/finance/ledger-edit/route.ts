import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { headByKey } from "@/lib/ledgerHeads";

// Edit a ledger: name, group (Tally-style head → type/sub_type) and code. Posted entries keep pointing at the same
// ledger, so every report follows the change. Logged in the audit trail.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { business_id?: string; account_id?: string; name?: string; head?: string; code?: string };
    const gate = await requireBusiness(req, body.business_id);
    if (gate instanceof NextResponse) return gate;
    if (!can(gate.role, "post")) return NextResponse.json({ error: "Your role can view ledgers but not change them." }, { status: 403 });
    const bizId = body.business_id!;
    // No account_id → create a new ledger under the chosen group
    if (!body.account_id) {
      const name = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      const head = body.head ? headByKey(body.head) : null;
      if (!name) return NextResponse.json({ error: "The ledger needs a name." }, { status: 400 });
      if (!head) return NextResponse.json({ error: "Choose a group from the list." }, { status: 400 });
      const { data: same } = await sb.from("fw_fin_chart_of_accounts").select("id").eq("business_id", bizId).ilike("name", name.replace(/[\\%_]/g, c => `\\${c}`)).limit(1);
      if (same?.length) return NextResponse.json({ error: `A ledger called "${name}" already exists.` }, { status: 409 });
      const code = String(body.code ?? "").trim().slice(0, 40) || `AUTO-${Date.now().toString().slice(-7)}`;
      const row: Record<string, unknown> = { business_id: bizId, name, code, type: head.type, sub_type: head.sub_type, group_key: head.key, is_group: false, is_system: false, description: "Added from Ledger" };
      let { data, error } = await sb.from("fw_fin_chart_of_accounts").insert(row).select("id,name,code,type,sub_type").single();
      if (error && /group_key/.test(error.message)) { delete row.group_key; ({ data, error } = await sb.from("fw_fin_chart_of_accounts").insert(row).select("id,name,code,type,sub_type").single()); }
      if (error || !data) return serverError("ledger-create", error, "Couldn't create the ledger.");
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "ledger_created", detail: { account: data.id, name, head: head.key } });
      return NextResponse.json({ ok: true, created: true, account: { ...data, group_key: head.key } });
    }
    const { data: acc } = await sb.from("fw_fin_chart_of_accounts").select("id,name,code,type,sub_type,is_group").eq("id", body.account_id ?? "").eq("business_id", bizId).maybeSingle();
    if (!acc || acc.is_group) return NextResponse.json({ error: "Ledger not found." }, { status: 404 });

    const name = String(body.name ?? acc.name).replace(/\s+/g, " ").trim().slice(0, 120);
    const code = String(body.code ?? acc.code ?? "").trim().slice(0, 40);
    if (!name) return NextResponse.json({ error: "The ledger needs a name." }, { status: 400 });
    const head = body.head ? headByKey(body.head) : null;
    if (body.head && !head) return NextResponse.json({ error: "Choose a group from the list." }, { status: 400 });

    if (name.toLowerCase() !== String(acc.name).toLowerCase()) {
      const { data: same } = await sb.from("fw_fin_chart_of_accounts").select("id").eq("business_id", bizId).ilike("name", name.replace(/[\\%_]/g, c => `\\${c}`)).neq("id", acc.id).limit(1);
      if (same?.length) return NextResponse.json({ error: `A ledger called "${name}" already exists. Pick another name, or merge the two in Tally.` }, { status: 409 });
    }
    if (code && code !== acc.code) {
      const { data: same } = await sb.from("fw_fin_chart_of_accounts").select("id").eq("business_id", bizId).eq("code", code).neq("id", acc.id).limit(1);
      if (same?.length) return NextResponse.json({ error: `Code ${code} is already used by another ledger.` }, { status: 409 });
    }

    const patch: Record<string, unknown> = { name, code: code || acc.code };
    if (head) { patch.type = head.type; patch.sub_type = head.sub_type; patch.group_key = head.key; }
    let { error } = await sb.from("fw_fin_chart_of_accounts").update(patch).eq("id", acc.id).eq("business_id", bizId);
    let note: string | null = null;
    if (error && /group_key/.test(error.message)) {
      delete patch.group_key;
      ({ error } = await sb.from("fw_fin_chart_of_accounts").update(patch).eq("id", acc.id).eq("business_id", bizId));
      note = "Saved. To keep groups that share a type apart (e.g. Duties & Taxes vs Current Liabilities), run 2026-11-10_ledger_group.sql in Supabase.";
    }
    if (error) return serverError("ledger-edit", error, "Couldn't save the ledger.");
    // A customer / supplier linked to this ledger keeps the same name
    if (name !== acc.name) await sb.from("fw_fin_contacts").update({ name }).eq("business_id", bizId).eq("ledger_account_id", acc.id).then(() => null, () => null);
    await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "ledger_edited", detail: { account: acc.id, from: { name: acc.name, code: acc.code, type: acc.type, sub_type: acc.sub_type }, to: patch } });
    return NextResponse.json({ ok: true, note, account: { id: acc.id, ...patch } });
  } catch (e) { return serverError("ledger-edit", e, "Couldn't save the ledger."); }
}
