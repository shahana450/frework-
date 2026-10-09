import type { NextRequest } from "next/server";
import { handleChatBook } from "@/lib/chatBookHandler";
import { readAttachment } from "@/lib/attachments";

// Messages with files (bills, Excel, PDF) — needs Node for the file readers
export const maxDuration = 300;
export type { ParsedTransaction } from "@/lib/intentEngine";
export function POST(req: NextRequest) { return handleChatBook(req, { readAttachment }); }
