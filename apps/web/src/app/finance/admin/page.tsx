"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAILS = ["auditmanagercswa@gmail.com"];
const PLANS = ["starter", "professional", "enterprise"];

type Sub = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  amount: number;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  payment_id: string | null;
  granted_by_admin: boolean;
  created_at: string;
  updated_at: string;
};

const statusColor = (s: string) =>
  s === "active" ? "#4ade80" : s === "trial" ? "#3B82F6" : s === "cancelled" ? "#f87171" : "#8A9BB8";

export default function AdminPortal() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserId, setNewUserId] = useState("");
  const [newPlan, setNewPlan] = useState("professional");
  const [trialDays, setTrialDays] = useState(7);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (tok: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/subscription/admin", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      if (!res.ok) { setMsg(`API error ${res.status}: ${data.error ?? "Check Vercel env vars (SUPABASE_SERVICE_ROLE_KEY)"}`); }
      setSubs(data.subs ?? []);
    } catch (e) {
      setMsg(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
        router.replace("/finance");
        return;
      }
      setToken(session.access_token);
      load(session.access_token);
    });
  }, [load]);

  async function act(action: string, user_id: string, extra: Record<string, unknown> = {}) {
    if (!token) return;
    setWorking(true); setMsg("");
    const res = await fetch("/api/finance/subscription/admin", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, user_id, ...extra }),
    });
    const data = await res.json();
    setMsg(data.ok ? `Done${data.ends_at ? " — expires " + new Date(data.ends_at).toLocaleDateString("en-IN") : ""}` : data.error ?? "Error");
    setWorking(false);
    load(token);
  }

  async function grantNew(status: "trial" | "active") {
    if (!newUserId.trim()) { setMsg("Enter a user ID or email"); return; }
    await act(status === "trial" ? "grant_trial" : "activate", newUserId.trim(), { plan: newPlan, trial_days: trialDays });
    setNewUserId("");
  }

  const inp: React.CSSProperties = { background: "rgba(237,232,220,0.05)", border: "1px solid rgba(237,232,220,0.15)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.83rem", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(59,130,246,0.2)", padding: "0 2rem", height: 56, display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontWeight: 900, color: "#3B82F6", fontSize: "0.95rem" }}>FrePilot Admin</span>
        <span style={{ flex: 1 }} />
        <a href="/finance" style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.8rem", textDecoration: "none" }}>← Back to Finance</a>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Subscription Management</h1>
        <p style={{ margin: "0 0 2rem", color: "rgba(237,232,220,0.4)", fontSize: "0.85rem" }}>Grant trials, activate, or revoke access without payment.</p>

        {/* Grant new access */}
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#3B82F6", marginBottom: "1rem" }}>Grant Access to a User</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>User ID (from Supabase auth)</label>
              <input value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="uuid or email" style={{ ...inp, width: 280 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Plan</label>
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Trial Days</label>
              <select value={trialDays} onChange={e => setTrialDays(Number(e.target.value))} style={{ ...inp, cursor: "pointer" }}>
                {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <button onClick={() => grantNew("trial")} disabled={working} style={{ background: "#3B82F6", border: "none", color: "#ffffff", padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.83rem", opacity: working ? 0.6 : 1 }}>
              Grant Trial
            </button>
            <button onClick={() => grantNew("active")} disabled={working} style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.83rem", opacity: working ? 0.6 : 1 }}>
              Activate (Manual Payment)
            </button>
          </div>
          {msg && <div style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: msg.startsWith("Done") ? "#4ade80" : "#f87171" }}>{msg}</div>}
        </div>

        {/* Subscriptions table */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(237,232,220,0.07)", fontWeight: 700, fontSize: "0.88rem", display: "flex", justifyContent: "space-between" }}>
            <span>All Subscriptions ({subs.length})</span>
            {token && <button onClick={() => load(token)} style={{ background: "none", border: "none", color: "rgba(237,232,220,0.4)", cursor: "pointer", fontSize: "0.78rem" }}>Refresh</button>}
          </div>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "rgba(237,232,220,0.3)" }}>Loading…</div>
          ) : subs.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "rgba(237,232,220,0.25)" }}>No subscriptions yet</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["User ID", "Plan", "Status", "Amount", "Expires", "Source", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.55rem 1rem", textAlign: "left", fontSize: "0.62rem", color: "rgba(237,232,220,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s, i) => (
                    <tr key={s.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(237,232,220,0.05)" }}>
                      <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(237,232,220,0.5)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user_id}</td>
                      <td style={{ padding: "0.65rem 1rem", fontWeight: 700, textTransform: "capitalize" }}>{s.plan}</td>
                      <td style={{ padding: "0.65rem 1rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusColor(s.status), background: `${statusColor(s.status)}18`, padding: "2px 8px", borderRadius: 20 }}>{s.status}</span>
                      </td>
                      <td style={{ padding: "0.65rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                        {s.amount ? `₹${s.amount.toLocaleString("en-IN")}` : <span style={{ color: "rgba(237,232,220,0.3)" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap", color: "rgba(237,232,220,0.5)", fontSize: "0.78rem" }}>
                        {s.subscription_ends_at ? new Date(s.subscription_ends_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td style={{ padding: "0.65rem 1rem", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)" }}>
                        {s.granted_by_admin ? "Admin" : "Razorpay"}
                      </td>
                      <td style={{ padding: "0.65rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {s.status !== "active" && (
                            <button onClick={() => act("activate", s.user_id, { plan: s.plan })} disabled={working} style={{ background: "rgba(74,222,128,0.12)", border: "none", color: "#4ade80", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>
                              Activate
                            </button>
                          )}
                          {s.status !== "trial" && (
                            <button onClick={() => act("grant_trial", s.user_id, { plan: s.plan, trial_days: 7 })} disabled={working} style={{ background: "rgba(59,130,246,0.12)", border: "none", color: "#3B82F6", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>
                              +7d Trial
                            </button>
                          )}
                          {s.status !== "cancelled" && (
                            <button onClick={() => act("revoke", s.user_id)} disabled={working} style={{ background: "rgba(248,113,113,0.1)", border: "none", color: "#f87171", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* How to find user ID */}
        <div style={{ marginTop: "1.5rem", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>How to find a User ID</div>
          <div style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.4)", lineHeight: 1.7 }}>
            Go to <strong style={{ color: "rgba(237,232,220,0.6)" }}>supabase.com → your project → Authentication → Users</strong>. Find the user by email and copy their UUID.
            The User ID looks like: <code style={{ background: "rgba(237,232,220,0.06)", padding: "1px 6px", borderRadius: 4, fontSize: "0.75rem" }}>a1b2c3d4-e5f6-...</code>
          </div>
        </div>
      </div>
    </div>
  );
}

