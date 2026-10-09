import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadQueryBooks, loadBusinessContext } from "@/lib/intentEngine";
import { computeCollect } from "@/lib/collect";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Receivables with ageing and each customer's phone for WhatsApp reminders
export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const today = new Date().toLocaleDateString("en-CA");
    const books = await loadQueryBooks(supabase, bizId!, today);
    if (books.error) return serverError("collect", books.error, "We couldn't load receivables right now.");
    const [biz, { data: contacts }, { data: business }] = await Promise.all([
      loadBusinessContext(supabase, bizId!),
      supabase.from("fw_fin_contacts").select("name,phone").eq("business_id", bizId!),
      supabase.from("fw_fin_businesses").select("name").eq("id", bizId!).maybeSingle(),
    ]);
    const phone = new Map((contacts ?? []).map(c => [String(c.name).trim().toLowerCase(), c.phone as string | null]));
    const c = computeCollect(books.accounts, books.journals, today);
    for (const d of c.debtors) d.phone = phone.get(d.name.toLowerCase()) ?? null;
    return NextResponse.json({ ...c, business: business?.name ?? "", currency: biz.baseCurrency, locale: biz.country === "IN" ? "en-IN" : "en-US" });
  } catch (e) {
    return serverError("collect", e, "We couldn't load receivables right now.");
  }
}
