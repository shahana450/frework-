import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

// Activity history for one business, read-only: every FreBook chat (all team members), or one chat's messages (?chat=<id>).
// Attachments and Smart Inbox files come from the Shelf API.
export const runtime = "nodejs";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams; const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const chat = sp.get("chat");
    if (chat) {
      const { data, error } = await sb.from("fw_fin_chat_sessions").select("id,title,messages,created_at").eq("id", chat).eq("business_id", bizId!).maybeSingle();
      if (error) return serverError("history chat", error, "Couldn't open the chat.");
      if (!data) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.from("fw_fin_chat_sessions").select("id,title,user_id,created_at,updated_at")
      .eq("business_id", bizId!).order("created_at", { ascending: false }).limit(1000);
    if (error) return serverError("history", error, "Couldn't load the history.");
    return NextResponse.json({ chats: data ?? [] });
  } catch (e) { return serverError("history", e, "Couldn't load the history."); }
}
