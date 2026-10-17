import { NextRequest, NextResponse } from "next/server";

// Daily check (Vercel Cron) that FreBook's WhatsApp can still send and receive. If anything is wrong it emails
// ALERT_EMAIL (default admin.frework@gmail.com) through Resend (RESEND_API_KEY). Without a key it only logs.
// The access token is used on the server only; nothing secret is ever put in the email.
const GRAPH = "https://graph.facebook.com/v21.0";
const env = (k: string) => (process.env[k] ?? "").trim();

async function graph(path: string) {
  const r = await fetch(`${GRAPH}/${path}`, { headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` } }).catch(() => null);
  return { ok: !!r?.ok, body: (r ? await r.json().catch(() => ({})) : {}) as Record<string, unknown> & { error?: { message?: string } } };
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; nobody else can trigger the alert
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const problems: string[] = [];
  if (env("GUPSHUP_APP_ID")) return NextResponse.json({ ok: true, skipped: "Gupshup route — checked by Gupshup" });
  if (!env("WHATSAPP_ACCESS_TOKEN") || !env("WHATSAPP_PHONE_ID")) problems.push("WhatsApp isn't configured on the server (access token or phone ID missing).");
  else {
    const phone = await graph(`${env("WHATSAPP_PHONE_ID")}?fields=display_phone_number,status,quality_rating`);
    if (!phone.ok) problems.push(`The access token doesn't work: ${phone.body.error?.message ?? "Meta refused it"}. FreBook can't send replies.`);
    else {
      if (phone.body.status && phone.body.status !== "CONNECTED") problems.push(`The number's status is ${phone.body.status}, not CONNECTED.`);
      if (phone.body.quality_rating && phone.body.quality_rating !== "GREEN") problems.push(`Message quality is ${String(phone.body.quality_rating).toLowerCase()} — Meta may lower the daily limit.`);
      const apps = await graph(`${env("WHATSAPP_WABA_ID") || "1677956173948933"}/subscribed_apps`);
      const list = (apps.body.data as unknown[] | undefined) ?? [];
      if (apps.ok && list.length === 0) problems.push("No app is receiving WhatsApp messages — incoming messages are lost. Open the dashboard and press Connect.");
    }
  }

  if (!problems.length) return NextResponse.json({ ok: true });
  console.error("wa-health:", problems);
  const key = env("RESEND_API_KEY");
  if (key) {
    const html = `<p><b>FreBook WhatsApp needs attention</b></p><ul>${problems.map(p => `<li>${p.replace(/[<>&]/g, "")}</li>`).join("")}</ul>`
      + `<p>Check it here: <a href="https://frework.online/dashboard">frework.online/dashboard</a> → FreBook WhatsApp.</p>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("ALERT_FROM") || "FreWork Alerts <onboarding@resend.dev>", to: (env("ALERT_EMAIL") || "admin.frework@gmail.com").split(","), subject: "⚠ FreBook WhatsApp needs attention", html }),
    }).catch(e => console.error("wa-health email", e));
  }
  return NextResponse.json({ ok: false, problems });
}
