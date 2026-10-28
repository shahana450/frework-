"use client";
import { SettingsHero } from "@/components/finance/PageHero";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

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
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
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
      setSuccess(`Access added for ${inviteEmail} as ${ROLES.find(r => r.value === inviteRole)?.label}. Send them the invite below — no email goes out automatically.`);
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

  const inviteText = (m: Member) => `You've been given ${ROLES.find(r => r.value === m.role)?.label ?? m.role} access to ${bizName || "our business"} on FreWork. Sign in at https://frework.online/login?next=/finance with ${m.invited_email} (Google sign-in works) and pick the business.`;

  async function removeMember(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from this business?`)) return;
    await supabase.from("fw_fin_team_members").delete().eq("id", memberId);
    setMembers(m => m.filter(x => x.id !== memberId));
  }

  const inputStyle = { background: "rgba(16,36,31,0.08)", border: "1px solid rgba(16,36,31,0.17)", color: "#10241F", padding: "8px 10px", borderRadius: 6, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const };

  const statusColor = (s: string) => s === "active" ? "#0B7A55" : s === "pending" ? "#12352D" : "rgba(16,36,31,0.60)";
  const roleColor = (r: string) => r === "admin" ? "#B4321F" : r === "accountant" ? "#12352D" : r === "ca_reviewer" ? "#12352D" : "rgba(16,36,31,0.65)";

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <SettingsHero active="team" eyebrow="Team & access" title="Who can see and post"
        sub="Invite your CA, accountant or business partner to work on this business." />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 100px", display: "flex", flexDirection: "column", gap: 18 }}>

        {error && <div style={{ background: "rgba(194,50,31,0.1)", border: "1px solid rgba(194,50,31,0.3)", color: "#B4321F", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
        {success && <div style={{ background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.25)", color: "#0B7A55", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

        {/* Invite form */}
        <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem" }}>Invite Team Member</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Email Address</div>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && invite()}
                placeholder="colleague@example.com" style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Role</div>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={invite} disabled={saving || !inviteEmail} style={{ background: "#12352D", border: "none", color: "#F4EFE4", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", height: 36, opacity: (!inviteEmail || saving) ? 0.5 : 1 }}>
              {saving ? "…" : "Invite"}
            </button>
          </div>
        </div>

        {/* Roles explanation */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {ROLES.map(r => (
            <div key={r.value} style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.08)", borderRadius: 8, padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: roleColor(r.value), flexShrink: 0, marginTop: 5 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: roleColor(r.value) }}>{r.label}</div>
                <div style={{ fontSize: "0.73rem", color: "rgba(16,36,31,0.65)", marginTop: "0.15rem", lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Members list */}
        <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid rgba(16,36,31,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Team Members</span>
            <span style={{ fontSize: "0.72rem", color: "rgba(16,36,31,0.60)" }}>{members.length} member{members.length !== 1 ? "s" : ""}</span>
          </div>
          {members.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "rgba(16,36,31,0.55)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>👥</div>
              <div>No team members yet. Invite your CA or accountant above.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FFFDF8" }}>
                  {["Email", "Role", "Status", "Invited On", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.65rem", color: "rgba(16,36,31,0.60)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderTop: "1px solid rgba(16,36,31,0.08)" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem" }}>{m.invited_email}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                        style={{ background: "rgba(16,36,31,0.08)", border: "1px solid rgba(16,36,31,0.14)", color: roleColor(m.role), padding: "3px 8px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer" }}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 8, background: `${statusColor(m.status)}18`, color: statusColor(m.status), fontWeight: 600, textTransform: "capitalize" }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(16,36,31,0.65)" }}>
                      {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {m.status === "pending" && <>
                        <a href={`https://wa.me/?text=${encodeURIComponent(inviteText(m))}`} target="_blank" rel="noopener noreferrer" style={{ marginRight: 6, background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.25)", color: "#0B7A55", padding: "3px 10px", borderRadius: 5, fontSize: "0.75rem", textDecoration: "none" }}>WhatsApp</a>
                        <button onClick={() => { navigator.clipboard?.writeText(inviteText(m)); setSuccess(`Invite message for ${m.invited_email} copied.`); }} style={{ marginRight: 6, background: "rgba(18,53,45,0.06)", border: "1px solid rgba(18,53,45,0.2)", color: "#12352D", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: "0.75rem" }}>Copy invite</button>
                      </>}
                      <button onClick={() => removeMember(m.id, m.invited_email)} style={{ background: "rgba(194,50,31,0.08)", border: "1px solid rgba(194,50,31,0.2)", color: "#B4321F", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: "0.75rem" }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: "1.25rem", background: "rgba(18,53,45,0.05)", border: "1px solid rgba(18,53,45,0.12)", borderRadius: 10, padding: "0.85rem 1rem", fontSize: "0.78rem", color: "rgba(16,36,31,0.65)", lineHeight: 1.65 }}>
          <strong style={{ color: "#12352D" }}>Note:</strong> FreWork doesn't email invitations yet. Send the invite by WhatsApp or copy it. The person signs in at frework.online with <b>exactly the invited email</b> (Google sign-in, or an email they have confirmed); this business then appears in their company list and the status turns <b>Active</b>. They work under your plan — they don't need their own subscription. Remove them any time to cut access.
        </div>
      </div>
    </div>
  );
}
