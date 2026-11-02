"use client";
// Client access — for a CA firm with many clients: every business you own, and who from the client's side may VIEW
// that business's books. Each client sees only the business they were added to, read-only (reports, ledgers,
// documents). Access is per business; the server and database refuse any change from a view-only person.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

type Biz = { id: string; name: string; gstin: string | null };
type Member = { id: string; business_id: string; invited_email: string; role: string; status: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClientAccess() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [list, setList] = useState<Biz[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(userId: string) {
    const { data: biz } = await supabase.from("fw_fin_businesses").select("id,name,gstin").eq("owner_id", userId).order("name");
    const rows = (biz ?? []) as Biz[];
    setList(rows);
    const ids = rows.map(b => b.id);
    const all: Member[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from("fw_fin_team_members").select("id,business_id,invited_email,role,status").in("business_id", ids.slice(i, i + 100)).eq("role", "viewer");
      all.push(...((data ?? []) as Member[]));
    }
    setMembers(all);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login?next=/finance/clients"); return; }
      setUid(user.id); void load(user.id);
    });
  }, [router]);

  async function add(b: Biz) {
    const e = (email[b.id] ?? "").trim().toLowerCase();
    if (!EMAIL.test(e)) { setMsg(m => ({ ...m, [b.id]: { ok: false, text: "Type the client's email address." } })); return; }
    const { error } = await supabase.from("fw_fin_team_members").insert({ business_id: b.id, invited_email: e, role: "viewer", status: "pending", invited_by: uid });
    if (error) { setMsg(m => ({ ...m, [b.id]: { ok: false, text: /duplicate/i.test(error.message) ? `${e} already has access to ${b.name}.` : error.message } })); return; }
    setEmail(x => ({ ...x, [b.id]: "" }));
    setMsg(m => ({ ...m, [b.id]: { ok: true, text: `${e} can now view ${b.name}. Send them the invite (Copy invite) — no email goes out automatically.` } }));
    if (uid) void load(uid);
  }
  async function remove(m: Member, b: Biz) {
    if (!confirm(`Stop ${m.invited_email} viewing ${b.name}?`)) return;
    await supabase.from("fw_fin_team_members").delete().eq("id", m.id);
    if (uid) void load(uid);
  }
  const invite = (m: Member, b: Biz) => `${b.name}'s books are on FreBook. You can view your reports, ledgers and documents (view only).\n\nSign in at https://frework.online/login?next=/finance/client with ${m.invited_email} — Google sign-in works — and choose ${b.name}.`;
  const copy = async (m: Member, b: Biz) => { try { await navigator.clipboard.writeText(invite(m, b)); setCopied(m.id); setTimeout(() => setCopied(""), 2000); } catch { /* clipboard blocked */ } };

  const shown = list.filter(b => !q.trim() || b.name.toLowerCase().includes(q.trim().toLowerCase()) || (b.gstin ?? "").toLowerCase().includes(q.trim().toLowerCase()));
  const withAccess = new Set(members.map(m => m.business_id)).size;
  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18 };
  const input: React.CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 12px", fontFamily: "inherit", fontSize: 14, background: "#FFFFFF", minWidth: 0 };
  const btn: React.CSSProperties = { height: 38, padding: "0 16px", borderRadius: 999, border: "none", background: "#12352D", color: "#FFFFFF", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <PageHero eyebrow="CA desk · client access" title="Give clients a view of their books"
        sub="Each client sees only their own business — reports, ledgers and documents — and can't change anything."
        tiles={loading ? undefined : [
          { label: "Client businesses", value: String(list.length) },
          { label: "With client access", value: String(withAccess), tone: "good" },
          { label: "Client logins", value: String(members.length) },
        ]} />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a client by name or GSTIN" aria-label="Find a client" style={{ ...input, height: 44, fontSize: 15 }} />
        {loading && <div style={{ ...card, padding: 20, color: HT.muted, fontStyle: "italic" }}>Loading your clients…</div>}
        {!loading && !list.length && <div style={{ ...card, padding: 20, color: HT.muted }}>You don&apos;t own any businesses yet. Add a client business first.</div>}
        {shown.map(b => {
          const ms = members.filter(m => m.business_id === b.id);
          return (
            <section key={b.id} style={{ ...card, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                <b style={{ fontSize: 17 }}>{b.name}</b>
                <span style={{ fontSize: 13, color: HT.muted }}>{b.gstin ? `GSTIN ${b.gstin}` : "No GSTIN"} · {ms.length ? `${ms.length} client login${ms.length === 1 ? "" : "s"}` : "no client access"}</span>
              </div>
              {ms.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, padding: "8px 12px", borderRadius: 10, background: "#F7F2E7" }}>
                  <span style={{ flex: 1, minWidth: 180 }}>{m.invited_email}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 9px", borderRadius: 999, background: m.status === "active" ? "#E3F3EC" : "#FBF1DA", color: m.status === "active" ? "#0B7A55" : "#9A6B22" }}>{m.status === "active" ? "Signed in" : "Invited"}</span>
                  <button type="button" onClick={() => copy(m, b)} style={{ ...btn, height: 30, background: "#FFFFFF", color: HT.ink, border: `1px solid ${HT.line}`, fontSize: 13 }}>{copied === m.id ? "✓ Copied" : "Copy invite"}</button>
                  <button type="button" onClick={() => remove(m, b)} style={{ ...btn, height: 30, background: "transparent", color: "#B4321F", border: "1px solid rgba(180,50,31,0.3)", fontSize: 13 }}>Remove</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="email" value={email[b.id] ?? ""} onChange={e => setEmail(x => ({ ...x, [b.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && add(b)}
                  placeholder="Client's email (Google account works)" aria-label={`Client email for ${b.name}`} style={{ ...input, flex: 1, minWidth: 220 }} />
                <button type="button" onClick={() => add(b)} style={btn}>Give view access</button>
              </div>
              {msg[b.id] && <div role="status" style={{ fontSize: 13.5, color: msg[b.id].ok ? "#0B7A55" : "#B4321F" }}>{msg[b.id].text}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
