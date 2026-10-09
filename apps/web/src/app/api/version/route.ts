import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The build that is live right now — open apps compare it with the build they loaded
export function GET() {
  return NextResponse.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
