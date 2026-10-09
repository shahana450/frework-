import type { NextRequest } from "next/server";
import { handleChatBook } from "@/lib/chatBookHandler";

// Typed FreBook messages — run at the edge nearest the user (Mumbai for India), right next to the database
export const runtime = "edge";
export function POST(req: NextRequest) { return handleChatBook(req); }
