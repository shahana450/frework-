import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadQueryBooks } from "@/lib/intentEngine";
import { reviewChecks, type DraftLine } from "@/lib/reviewChecks";

// Runs at the edge nearest the user (Mumbai for India) — next to the database, not across the world
export const runtime = "edge";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Smart checks for a FreBook draft (read-only — nothing is posted here)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { business_id?: string; date?: string; lines?: DraftLine[] };
    const gate = await requireBusiness(req, body.business_id);
    if (gate instanceof NextResponse) return gate;
    if (!Array.isArray(body.lines) || !body.lines.length) return NextResponse.json({ checks: [], impact: [] });
    const today = new Date().toLocaleDateString("en-CA");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : today;
    const books = await loadQueryBooks(supabase, body.business_id!, [today, date].sort().pop()!);
    if (books.error) return serverError("chat-book/checks", books.error, "Checks are unavailable right now.");
    const lines = body.lines.slice(0, 40).map(l => ({ account: String(l.account ?? ""), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    return NextResponse.json(reviewChecks(books.accounts, books.journals, today, { date, lines }));
  } catch (e) {
    return serverError("chat-book/checks", e, "Checks are unavailable right now.");
  }
}
