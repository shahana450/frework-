import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadQueryBooks, loadBusinessContext } from "@/lib/intentEngine";
import { computeRecap } from "@/lib/recap";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Monthly recap story: ?offset=-1 is last month
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const offset = Math.max(-24, Math.min(0, parseInt(sp.get("offset") ?? "-1", 10) || -1));
    const today = new Date().toLocaleDateString("en-CA");
    const books = await loadQueryBooks(supabase, bizId!, today);
    if (books.error) return serverError("recap", books.error, "We couldn't build your recap right now.");
    const biz = await loadBusinessContext(supabase, bizId!);
    return NextResponse.json({ recap: computeRecap(books.accounts, books.journals, today, offset), currency: biz.baseCurrency, locale: biz.country === "IN" ? "en-IN" : "en-US" });
  } catch (e) {
    return serverError("recap", e, "We couldn't build your recap right now.");
  }
}
