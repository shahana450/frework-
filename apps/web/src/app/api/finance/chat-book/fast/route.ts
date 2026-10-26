import type { NextRequest } from "next/server";
import { handleChatBook } from "@/lib/chatBookHandler";

// Typed FreBook messages. Node runtime in Mumbai (bom1, next to the database): an AI answer may take longer than
// the edge limit of ~25 s before the first byte, which showed people a plain-text error instead of a reply.
export const runtime = "nodejs";
export const maxDuration = 60;
export function POST(req: NextRequest) { return handleChatBook(req); }
