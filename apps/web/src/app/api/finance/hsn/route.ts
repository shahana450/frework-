import { NextRequest, NextResponse } from "next/server";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { getAI } from "@/lib/ai";

// HSN / SAC search by description or code. The GST portal's own search is tried first; it often refuses server
// requests, so the fallback suggests codes with the AI — always marked "suggested" for the user to confirm.
export const maxDuration = 30;
type Hit = { hsn: string; description: string; gst_rate: number | null };

async function portal(q: string): Promise<Hit[] | null> {
  const byCode = /^\d{2,8}$/.test(q);
  try {
    const r = await fetch(`https://services.gst.gov.in/commonservices/hsn/search/qsearch?inputText=${encodeURIComponent(q)}&selectedType=${byCode ? "byCode" : "byDesc"}&category=null`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    const t = await r.text();
    if (!r.ok || !t.trim().startsWith("{") && !t.trim().startsWith("[")) return null;
    const j = JSON.parse(t) as { data?: { c?: string; n?: string }[] } | { c?: string; n?: string }[];
    const list = Array.isArray(j) ? j : j.data ?? [];
    const hits = list.filter(x => x?.c).slice(0, 12).map(x => ({ hsn: String(x.c), description: String(x.n ?? ""), gst_rate: null }));
    return hits.length ? hits : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const gate = await requireBusiness(req, sp.get("business_id"));
  if (gate instanceof NextResponse) return gate;
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [], source: null });
  try {
    const p = await portal(q);
    if (p) return NextResponse.json({ hits: p, source: "gst_portal" });
    const res = await getAI().messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 900, messages: [{ role: "user", content:
      `Indian GST: list up to 6 HSN (goods) or SAC (services) codes that best match "${q}". Prefer 8-digit HSN where common, else 4/6. ` +
      `Give the usual GST rate (%). Reply ONLY with JSON: [{"hsn":"10063020","description":"Basmati rice","gst_rate":5}]` }] });
    const txt = res.content[0]?.type === "text" ? res.content[0].text : "";
    const arr = JSON.parse(txt.match(/\[[\s\S]*\]/)?.[0] ?? "[]") as Hit[];
    const hits = arr.filter(h => /^\d{4,8}$/.test(String(h.hsn))).slice(0, 6).map(h => ({ hsn: String(h.hsn), description: String(h.description ?? "").slice(0, 160), gst_rate: Number.isFinite(Number(h.gst_rate)) ? Number(h.gst_rate) : null }));
    return NextResponse.json({ hits, source: "suggested" });
  } catch (e) { return serverError("hsn", e, "Couldn't search HSN codes right now."); }
}
