"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Member = { id: string; invited_email: string; role: string; status: string; created_at: string };

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full access — can post, edit, close FY, manage team" },
  { value: "accountant", label: "Accountant", desc: "Can create/edit journals, upload docs, run reports" },
  { value: "ca_reviewer", label: "CA / Reviewer", desc: "Read-only + can review AI suggestions, add comments" },
  { value: "viewer", label: "Viewer", desc: "Read-only access to reports and ledgers" },
];

export default function TeamPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("accountant");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = localStorage.getItem(`fw_fin_biz_${user.id}`);
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [bizRes, membersRes] = await Promise.all([
        supabase.from("fw_fin_businesses").select("name").eq("id", saved).single(),
        supabase.from("fw_fin_team_members").select("*").eq("business_id", saved).order("created_at"),
      ]);
      setBizName(bizRes.data?.name ?? "");
      setMembers((membersRes.data ?? []) as Member[]);
    });
  }, []);

  async function invite() {
    if (!bizId || !inviteEmail) return;
    setSaving(true); setError(""); setSuccess("");

    const { data: { user } } = await supabase.auth.getUser();

    const { error: e } = await supabase.from("fw_fin_team_members").insert({
      business_id: bizId,
      invited_email: inviteEmail.toLowerCase().trim(),
      role: inviteRole,
      status: "pending",
      invited_by: user?.id,
    });

    if (e) {
      setError(e.message.includes("duplicate") ? "This email is already invited." : e.message);
    } else {
      setSuccess(`Invitation sent to ${inviteEmail} as ${ROLES.find(r => r.value === inviteRole)?.label}`);
      setInviteEmail("");
      const { data } = await supabase.from("fw_fin_team_members").select("*").eq("business_id", bizId).order("created_at");
      setMembers((data ?? []) as Member[]);
    }
    setSaving(false);
  }

  async function changeRole(memberId: string, newRole: string) {
    await supabase.from("fw_fin_team_members").update({ role: newRole }).eq("id", memberId);
    setMembers(m => m.map(x => x.id === memberId ? { ...x, role: newRole } : x));
  }

  async function removeMember(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from this business?`)) return;
    await supabase.from("fw_fin_team_members").delete().eq("id", memberId);
    setMembers(m => m.filter(x => x.id !== memberId));
  }

  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "8px 10px", borderRadius: 6, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const };

  const statusColor = (s: string) => s === "active" ? "#4ade80" : s === "pending" ? "#C9A84C" : "rgba(237,232,220,0.35)";
  const roleColor = (r: string) => r === "admin" ? "#f87171" : r === "accountant" ? "#60a5fa" : r === "ca_reviewer" ? "#C9A84C" : "rgba(237,232,220,0.4)";

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Team & Access</span>
        {bizName && <span style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.3)", marginLeft: "auto" }}>{bizName}</span>}
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Team & Access Control</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Invite your CA, accountant, or business partner to collaborate on this business</p>

        {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
        {success && <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

        {/* Invite form */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem" }}>Invite Team Member</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Email Address</div>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && invite()}
                placeholder="colleague@example.com" style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Role</div>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={invite} disabled={saving || !inviteEmail} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", height: 36, opacity: (!inviteEmail || saving) ? 0.5 : 1 }}>
              {saving ? "…" : "Invite"}
            </button>
          </div>
        </div>

        {/* Roles explanation */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {ROLES.map(r => (
            <div key={r.value} style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(237,232,220,0.05)", borderRadius: 8, padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: roleColor(r.value), flexShrink: 0, marginTop: 5 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: roleColor(r.value) }}>{r.label}</div>
                <div style={{ fontSize: "0.73rem", color: "rgba(237,232,220,0.4)", marginTop: "0.15rem", lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Members list */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Team Members</span>
            <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.35)" }}>{members.length} member{members.length !== 1 ? "s" : ""}</span>
          </div>
          {members.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>👥</div>
              <div>No team members yet. Invite your CA or accountant above.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Email", "Role", "Status", "Invited On", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem" }}>{m.invited_email}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                        style={{ background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.1)", color: roleColor(m.role), padding: "3px 8px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer" }}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 8, background: `${statusColor(m.status)}18`, color: statusColor(m.status), fontWeight: 600, textTransform: "capitalize" }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>
                      {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <button onClick={() => removeMember(m.id, m.invited_email)} style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: "0.75rem" }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: "1.25rem", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 10, padding: "0.85rem 1rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.4)", lineHeight: 1.65 }}>
          <strong style={{ color: "#C9A84C" }}>Note:</strong> Invitations are stored in the system. The invited user needs to sign up/log in to FreWork with the same email to get access. Full OAuth-linked team member activation coming soon.
        </div>
      </div>
    </div>
  );
}
