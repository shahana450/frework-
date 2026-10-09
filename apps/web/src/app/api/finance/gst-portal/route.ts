import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";

const PORTAL = "https://services.gst.gov.in/services";

// Common headers that mimic a real browser session to avoid bot detection
function portalHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://services.gst.gov.in",
    "Referer": "https://services.gst.gov.in/services/auth/fowelcome",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    ...extra,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const body = await req.json();
    const { action } = body;

    // ── 1. Send OTP to GST portal ──────────────────────────────────────────
    if (action === "sendOTP") {
      const { username } = body;
      if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

      const res = await fetch(`${PORTAL}/api/commonapi/login`, {
        method: "POST",
        headers: portalHeaders(),
        body: JSON.stringify({ action: "OTPGEN", username }),
        signal: AbortSignal.timeout(15000),
      });

      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* non-JSON */ }

      if (!res.ok) {
        return NextResponse.json({ error: `Portal returned ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
      }

      // Portal returns { status_cd: "1", sessionid: "...", data: { ... } }
      const statusCd = (data.status_cd ?? data.statusCd ?? "") as string;
      if (statusCd === "1" || statusCd === "0") {
        // OTP sent — return session id for next step
        return NextResponse.json({
          ok: true,
          sessionid: (data.sessionid ?? data.data) as string,
          msg: "OTP sent to your GST-registered mobile number",
        });
      }

      return NextResponse.json({
        ok: false,
        error: (data.message ?? data.msg ?? `Unexpected response: ${text.slice(0, 200)}`) as string,
      }, { status: 502 });
    }

    // ── 2. Verify OTP and get auth token ───────────────────────────────────
    if (action === "verifyOTP") {
      const { username, otp, sessionid } = body;
      if (!username || !otp) return NextResponse.json({ error: "username and otp required" }, { status: 400 });

      const res = await fetch(`${PORTAL}/api/commonapi/login`, {
        method: "POST",
        headers: portalHeaders(),
        body: JSON.stringify({ action: "AUTHTOKEN", username, otp, sessionid }),
        signal: AbortSignal.timeout(15000),
      });

      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* */ }

      if (!res.ok) return NextResponse.json({ error: `Portal ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });

      const authToken = (data.auth_token ?? data.authtoken ?? data.token) as string;
      if (!authToken) {
        return NextResponse.json({ ok: false, error: (data.message ?? data.msg ?? "OTP verification failed. Check OTP and retry.") as string });
      }

      return NextResponse.json({ ok: true, auth_token: authToken });
    }

    // ── 3. Fetch GSTR-2B data ──────────────────────────────────────────────
    if (action === "fetch2B") {
      const { gstin, auth_token, ret_period } = body; // ret_period: "082025" format
      if (!gstin || !auth_token || !ret_period) return NextResponse.json({ error: "gstin, auth_token, ret_period required" }, { status: 400 });

      const url = `${PORTAL}/api/returns/gstr2b?gstin=${gstin}&ret_period=${ret_period}&action=GET2B`;
      const res = await fetch(url, {
        method: "GET",
        headers: portalHeaders({ "auth-token": auth_token }),
        signal: AbortSignal.timeout(30000),
      });

      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid response from portal" }, { status: 502 }); }

      if (!res.ok) return NextResponse.json({ error: `Portal ${res.status}` }, { status: 502 });
      return NextResponse.json({ ok: true, data });
    }

    // ── 4. Fetch GSTR-3B data ──────────────────────────────────────────────
    if (action === "fetch3B") {
      const { gstin, auth_token, ret_period } = body;
      if (!gstin || !auth_token || !ret_period) return NextResponse.json({ error: "gstin, auth_token, ret_period required" }, { status: 400 });

      const url = `${PORTAL}/api/returns/gstr3b?gstin=${gstin}&ret_period=${ret_period}&action=RETSUM`;
      const res = await fetch(url, {
        method: "GET",
        headers: portalHeaders({ "auth-token": auth_token }),
        signal: AbortSignal.timeout(30000),
      });

      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid response from portal" }, { status: 502 }); }

      if (!res.ok) return NextResponse.json({ error: `Portal ${res.status}` }, { status: 502 });
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    // Timeout or network error — portal may be blocking server IPs
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("fetch failed")) {
      return NextResponse.json({ error: "GST portal did not respond. Download JSON manually from gst.gov.in and upload below.", blocked: true }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
