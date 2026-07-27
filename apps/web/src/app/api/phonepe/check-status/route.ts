import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_ID, PHONEPE_BASE_URL, SALT_KEY, SALT_INDEX } from "@/lib/phonepe";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const txnId = req.nextUrl.searchParams.get("txnId");
    if (!txnId) return NextResponse.json({ error: "Missing txnId" }, { status: 400 });

    const endpoint   = `/pg/v1/status/${MERCHANT_ID}/${txnId}`;
    const hashString = endpoint + SALT_KEY;
    const checksum   = crypto.createHash("sha256").update(hashString).digest("hex") + "###" + SALT_INDEX;

    const response = await fetch(`${PHONEPE_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type":  "application/json",
        "X-VERIFY":      checksum,
        "X-MERCHANT-ID": MERCHANT_ID,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Status check failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
