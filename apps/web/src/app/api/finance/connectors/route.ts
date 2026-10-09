import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { seal, open } from "@/lib/portals/secretBox";
import { resolveLedgers } from "@/lib/ledgerResolve";
import { postJournal, PostingError } from "@/lib/posting";
import { ConnectorError, type ConnectorId, type FeedItem, type ProposedLine } from "@/lib/connectors/types";
import { verifyRazorpay, fetchRazorpay, type RazorpayCreds } from "@/lib/connectors/razorpay";
import { verifyShopify, fetchShopify, normShop, type ShopifyCreds } from "@/lib/connectors/shopify";
import { startConsent, fetchBankFeed, bankFeedDemo, type BankFeedCreds } from "@/lib/connectors/bankfeed";
import { authUrl, fetchOAuth, oauthConfigured, signState, type OAuthCreds, type OAuthProvider } from "@/lib/connectors/oauth";

export const maxDuration = 60;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "Connectors need their database setup — run 2026-10-13_connectors.sql in Supabase.";
const missing = (m?: string) => /fw_fin_(connections|feed_items)|does not exist|schema cache/i.test(m ?? "");
const IDS: ConnectorId[] = ["razorpay", "shopify", "zoho_books", "quickbooks", "bank_feed"];
const VOUCHER: Record<FeedItem["kind"], string> = { payment: "payment", receipt: "receipt", settlement: "contra", order: "sales", refund: "credit_note", journal: "journal" };

export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const [conns, items] = await Promise.all([
      supabase.from("fw_fin_connections").select("provider,status,account_label,last_sync_at,last_error").eq("business_id", bizId!),
      supabase.from("fw_fin_feed_items").select("id,provider,external_id,kind,date,description,party,amount,currency,lines,status,journal_id").eq("business_id", bizId!).order("date", { ascending: false }).limit(300),
    ]);
    if (conns.error && missing(conns.error.message)) return NextResponse.json({ setup_needed: NEEDS_SQL, connections: [], items: [] });
    return NextResponse.json({
      connections: conns.data ?? [], items: items.data ?? [],
      oauth_ready: { zoho_books: oauthConfigured("zoho_books"), quickbooks: oauthConfigured("quickbooks") },
      key_ready: !!process.env.PORTAL_TOKEN_KEY, bank_feed_demo: bankFeedDemo(),
    });
  } catch (e) {
    return serverError("connectors", e, "Couldn't load connections.");
  }
}

type Body = { business_id?: string; action?: "connect" | "oauth_start" | "sync" | "disconnect" | "post" | "ignore" | "edit"; lines?: { ledger: string }[]; provider?: ConnectorId; creds?: Record<string, string>; ids?: string[]; days?: number };

async function syncOne(bizId: string, provider: ConnectorId, days = 30): Promise<number> {
  const { data: conn } = await supabase.from("fw_fin_connections").select("*").eq("business_id", bizId).eq("provider", provider).maybeSingle();
  if (!conn) throw new ConnectorError("INVALID", "Connect it first.");
  const since = new Date(Date.now() - Math.min(365, Math.max(1, days)) * 86400000);
  const creds = JSON.parse(open(conn.creds_enc));
  let items: FeedItem[];
  try {
    if (provider === "razorpay") items = await fetchRazorpay(creds as RazorpayCreds, since);
    else if (provider === "shopify") items = await fetchShopify(creds as ShopifyCreds, since);
    else if (provider === "bank_feed") {
      const r = await fetchBankFeed(creds as BankFeedCreds, since);
      items = r.items;
      if (r.creds.consent_status !== (creds as BankFeedCreds).consent_status) await supabase.from("fw_fin_connections").update({ creds_enc: seal(JSON.stringify(r.creds), r.creds.mode === "demo"), account_label: `${r.creds.mobile.slice(0, 2)}xxxxxx${r.creds.mobile.slice(-2)} → ${r.creds.bank_ledger}${r.creds.consent_status === "ACTIVE" ? "" : " (awaiting your approval)"}` }).eq("id", conn.id);
    }
    else {
      const r = await fetchOAuth(provider, creds as OAuthCreds, since);
      items = r.items;
      if (r.creds.access_token !== (creds as OAuthCreds).access_token) await supabase.from("fw_fin_connections").update({ creds_enc: seal(JSON.stringify(r.creds), false) }).eq("id", conn.id);
    }
  } catch (e) {
    await supabase.from("fw_fin_connections").update({ status: e instanceof ConnectorError && e.code === "AUTH" ? "expired" : "error", last_error: (e as Error).message.slice(0, 300) }).eq("id", conn.id);
    throw e;
  }
  // New items are added; items already posted or ignored keep their status
  if (items.length) {
    const { error } = await supabase.from("fw_fin_feed_items").upsert(items.map(i => ({ business_id: bizId, provider, ...i })), { onConflict: "business_id,provider,external_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  await supabase.from("fw_fin_connections").update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
  return items.length;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { business_id: bizId, action, provider } = body;
  try {
    const gate = await requireBusiness(req, bizId, { write: true, action: action === "post" ? undefined : "integrate" });
    if (gate instanceof NextResponse) return gate;
    if (action !== "post" && action !== "ignore" && action !== "edit" && (!provider || !IDS.includes(provider))) return NextResponse.json({ error: "Unknown connector." }, { status: 400 });

    if (action === "connect") {
      const c = body.creds ?? {};
      let label: string, creds: RazorpayCreds | ShopifyCreds;
      if (provider === "razorpay") { creds = { key_id: (c.key_id ?? "").trim(), key_secret: (c.key_secret ?? "").trim() }; label = await verifyRazorpay(creds); }
      else if (provider === "shopify") { creds = { shop: normShop(c.shop ?? ""), token: (c.token ?? "").trim() }; label = await verifyShopify(creds); }
      else if (provider === "bank_feed") {
        const demo = bankFeedDemo();
        const bf = await startConsent({ mode: demo ? "demo" : "setu", mobile: (c.mobile ?? "").replace(/\D/g, "").slice(-10), bank_ledger: (c.bank_ledger ?? "").trim() }, `${new URL(req.url).origin}/finance/integrations?connected=bank_feed`);
        const lbl = `${bf.mobile.slice(0, 2)}xxxxxx${bf.mobile.slice(-2)} → ${bf.bank_ledger}${demo ? " (demo data)" : bf.consent_status === "ACTIVE" ? "" : " (awaiting your approval)"}`;
        const { error } = await supabase.from("fw_fin_connections").upsert({ business_id: bizId, provider, status: "connected", creds_enc: seal(JSON.stringify(bf), demo), account_label: lbl, last_error: null, created_by: gate.user.id }, { onConflict: "business_id,provider" });
        if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS_SQL }, { status: 503 }) : serverError("connectors/connect", error, "Couldn't save the connection.");
        await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "connector_connect", source: "connectors", detail: { provider, demo } });
        if (bf.consent_url) return NextResponse.json({ ok: true, url: bf.consent_url });
        return NextResponse.json({ ok: true, label: lbl, fetched: await syncOne(bizId!, provider, body.days ?? 30) });
      }
      else return NextResponse.json({ error: "Use Sign in for this one." }, { status: 400 });
      const { error } = await supabase.from("fw_fin_connections").upsert({ business_id: bizId, provider, status: "connected", creds_enc: seal(JSON.stringify(creds), false), account_label: label, last_error: null, created_by: gate.user.id }, { onConflict: "business_id,provider" });
      if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS_SQL }, { status: 503 }) : serverError("connectors/connect", error, "Couldn't save the connection.");
      await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "connector_connect", source: "connectors", detail: { provider, account: label } });
      const n = await syncOne(bizId!, provider!, body.days ?? 30);
      return NextResponse.json({ ok: true, label, fetched: n });
    }

    if (action === "oauth_start") {
      const origin = new URL(req.url).origin;
      return NextResponse.json({ url: authUrl(provider as OAuthProvider, origin, signState({ b: bizId!, u: gate.user.id })) });
    }

    if (action === "sync") return NextResponse.json({ ok: true, fetched: await syncOne(bizId!, provider!, body.days ?? 30) });

    if (action === "disconnect") {
      await supabase.from("fw_fin_connections").delete().eq("business_id", bizId!).eq("provider", provider!);
      await supabase.from("fw_fin_feed_items").delete().eq("business_id", bizId!).eq("provider", provider!).eq("status", "new");
      await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "connector_disconnect", source: "connectors", detail: { provider } });
      return NextResponse.json({ ok: true });
    }

    const ids = (body.ids ?? []).filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
    if (!ids.length) return NextResponse.json({ error: "Choose at least one item." }, { status: 400 });

    if (action === "edit") {
      // Rename the ledgers on an item still waiting for review (e.g. Bank Feed Suspense → Rent). Amounts never change.
      const { data: it } = await supabase.from("fw_fin_feed_items").select("lines").eq("business_id", bizId!).eq("id", ids[0]).eq("status", "new").maybeSingle();
      if (!it) return NextResponse.json({ error: "That item is no longer waiting for review." }, { status: 409 });
      const cur = it.lines as ProposedLine[], next = body.lines ?? [];
      if (next.length !== cur.length || next.some(l => !l.ledger?.trim())) return NextResponse.json({ error: "Every line needs a ledger name." }, { status: 400 });
      await supabase.from("fw_fin_feed_items").update({ lines: cur.map((l, i) => { const name = next[i].ledger.trim().slice(0, 120); return name === l.ledger ? l : { ...l, ledger: name, head: "" }; }) }).eq("id", ids[0]).eq("status", "new");
      return NextResponse.json({ ok: true });
    }

    if (action === "ignore") {
      await supabase.from("fw_fin_feed_items").update({ status: "ignored" }).eq("business_id", bizId!).in("id", ids).eq("status", "new");
      return NextResponse.json({ ok: true });
    }

    if (action === "post") {
      const { data: rows } = await supabase.from("fw_fin_feed_items").select("*").eq("business_id", bizId!).in("id", ids).eq("status", "new");
      const list = (rows ?? []) as (FeedItem & { id: string; provider: ConnectorId })[];
      const all = list.flatMap(r => r.lines as ProposedLine[]);
      const heads = Object.fromEntries(all.filter(l => l.head).map(l => [l.ledger, l.head]));
      const res = await resolveLedgers(supabase, bizId!, all.map(l => ({ name: l.ledger })), heads, "Connector");
      if (!res.ok) return NextResponse.json({ error: `These ledgers aren't in your Chart of Accounts yet: ${res.needHeads.map(h => h.account).join(", ")}. Create them first (Chart of Accounts), then post again.`, need: res.needHeads }, { status: 409 });
      let posted = 0; const failed: { id: string; error: string }[] = [];
      for (const r of list) {
        // Claim the item first so a double click can't post it twice
        const { data: claim } = await supabase.from("fw_fin_feed_items").update({ status: "posted" }).eq("id", r.id).eq("status", "new").select("id");
        if (!claim?.length) continue;
        try {
          const j = await postJournal(supabase, {
            businessId: bizId!, actorId: gate.user.id, date: r.date, type: VOUCHER[r.kind] ?? "journal", narration: r.description, referenceNo: r.external_id, partyName: r.party,
            source: `connector:${r.provider}`, metadata: { connector: r.provider, external_id: r.external_id, feed_item: r.id },
            lines: (r.lines as ProposedLine[]).map(l => ({ accountId: res.ids.get(l.ledger.trim())!.id, dr: l.dr, cr: l.cr })),
          });
          await supabase.from("fw_fin_feed_items").update({ journal_id: j.id }).eq("id", r.id);
          posted++;
        } catch (e) {
          await supabase.from("fw_fin_feed_items").update({ status: "new" }).eq("id", r.id);
          failed.push({ id: r.id, error: e instanceof PostingError ? e.message : "Couldn't post." });
        }
      }
      if (posted) await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "connector_post", source: "connectors", detail: { posted, failed: failed.length } });
      return NextResponse.json({ ok: true, posted, failed, created: res.created });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof ConnectorError) return NextResponse.json({ error: e.message }, { status: e.code === "INVALID" ? 400 : e.code === "NOT_CONFIGURED" ? 503 : 502 });
    if (e instanceof Error && /PORTAL_TOKEN_KEY/.test(e.message)) return NextResponse.json({ error: "Secure key storage isn't set up yet (PORTAL_TOKEN_KEY). Ask your FreWork admin." }, { status: 503 });
    return serverError("connectors", e, "Something went wrong with the connection.");
  }
}
