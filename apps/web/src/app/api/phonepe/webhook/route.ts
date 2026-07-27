import { NextRequest, NextResponse } from "next/server";
import { SALT_KEY, SALT_INDEX } from "@/lib/phonepe";
import crypto from "crypto";

// PhonePe S2S server-to-server callback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { response: base64Response } = body;

    if (!base64Response) {
      return NextResponse.json({ error: "Missing response" }, { status: 400 });
    }

    // Verify checksum from X-VERIFY header
    const xVerify = req.headers.get("X-VERIFY") ?? "";
    const [receivedHash] = xVerify.split("###");
    const expectedHash = crypto
      .createHash("sha256")
      .update(base64Response + SALT_KEY)
      .digest("hex");

    if (receivedHash !== expectedHash) {
      return NextResponse.json({ error: "Invalid checksum" }, { status: 403 });
    }

    // Decode and parse response
    const decoded = JSON.parse(Buffer.from(base64Response, "base64").toString("utf-8"));
    console.log("[PhonePe webhook]", decoded);

    // Acknowledge receipt — actual DB update is handled in the redirect callback
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
