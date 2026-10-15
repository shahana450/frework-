import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomInt, createHash } from "node:crypto";
import { normPhone } from "@/lib/whatsapp/format";
import { sendLinkCode } from "@/lib/whatsapp/linkCode";
import { loginToken, userForPhone } from "@/lib/whatsapp/loginLink";

// Sign in with a WhatsApp number already linked to FreWork: a 6-digit code goes to that WhatsApp
// (approved authentication template); typing it back gives a one-time sign-in token.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FALLBACK = "Or open WhatsApp and send LOGIN to FreBook — it replies with a one-tap sign-in link.";
const tag = (p: string) => createHash("sha256").update(p).digest("hex").slice(0, 16);
const since = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const count = async (action: string, t: string, min: number) =>
  (await supabase.from("fw_fin_audit_log").select("id", { count: "exact", head: true }).eq("action", action).eq("detail->>to", t).gte("created_at", since(min))).count ?? 0;
const log = (businessId: string, actor: string, action: string, t: string) =>
  supabase.from("fw_fin_audit_log").insert({ business_id: businessId, actor, action, source: "whatsapp", detail: { to: t } }).then(() => null, () => null);

export async function POST(req: NextRequest) {
  try {
    const { action, phone, code } = await req.json().catch(() => ({}));
    const p = normPhone(String(phone ?? ""));
    if (!/^\d{11,15}$/.test(p)) return NextResponse.json({ error: "Enter your WhatsApp number with country code, e.g. 98765 43210 (India)." }, { status: 400 });
    const who = await userForPhone(supabase, p);
    // Same answer whether the number is unknown or not: don't reveal which numbers have accounts
    const generic = NextResponse.json({ ok: true, sent: false, note: `If this number is linked to FreWork, a code is on its way. ${FALLBACK}` });
    const t = tag(p);

    if (action === "send") {
      if (who === "none") return generic;
      if (who === "many") return NextResponse.json({ error: `This number is linked to more than one FreWork account. Sign in with email instead. ${FALLBACK}` }, { status: 409 });
      if (await count("whatsapp_login_code_sent", t, 60) >= 5) return NextResponse.json({ error: `Too many codes for this number in the last hour. ${FALLBACK}` }, { status: 429 });
      const otp = String(randomInt(100000, 1000000));
      await supabase.from("fw_fin_wa_links").update({ code: otp, code_expires: new Date(Date.now() + 10 * 60000).toISOString() }).eq("phone", p).eq("verified", true);
      const r = await sendLinkCode(p, otp);
      if (!r.ok) return NextResponse.json({ ok: true, sent: false, note: `${r.error.replace(/ — use the LINK message below.*$/, ".")} ${FALLBACK}` });
      await log(who.businessId, who.userId, "whatsapp_login_code_sent", t);
      return NextResponse.json({ ok: true, sent: true });
    }

    if (action === "verify") {
      const typed = String(code ?? "").replace(/\D/g, "");
      if (who === "none" || who === "many") return NextResponse.json({ error: "That code doesn't match. Ask for a new one." }, { status: 400 });
      if (await count("whatsapp_login_bad_code", t, 30) >= 5) return NextResponse.json({ error: `Too many wrong codes. Ask for a new one later. ${FALLBACK}` }, { status: 429 });
      const { data: rows } = await supabase.from("fw_fin_wa_links").select("id,code,code_expires").eq("phone", p).eq("verified", true);
      const hit = ((rows ?? []) as { id: string; code: string | null; code_expires: string | null }[])
        .find(r => r.code && r.code === typed && r.code_expires && Date.parse(r.code_expires) > Date.now());
      if (typed.length !== 6 || !hit) { await log(who.businessId, who.userId, "whatsapp_login_bad_code", t); return NextResponse.json({ error: "That code doesn't match or has expired." }, { status: 400 }); }
      await supabase.from("fw_fin_wa_links").update({ code: null, code_expires: null }).eq("phone", p).eq("verified", true);
      const token = await loginToken(supabase, who.userId);
      if (!token) return NextResponse.json({ error: "Couldn't sign you in this way. Use email sign-in." }, { status: 500 });
      await log(who.businessId, who.userId, "whatsapp_login", t);
      return NextResponse.json({ ok: true, token });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("whatsapp-otp", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
