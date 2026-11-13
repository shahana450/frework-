"use client";
// History — everything given to FreBook, kept for future reference, in three separate lists:
// FreBook chats, attachments (bills and files uploaded), and Smart Inbox files (statements, Excel, bulk bills).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

type Chat = { id: string; title: string | null; created_at: string; updated_at: string | null };
type Msg = { role: string; content: string };
type FileItem = { id: string; rack: string; title: string; file_name: string | null; size_bytes: number | null; source: string; fy: string | null; created_at: string };
type Tab = "chats" | "files" | "inbox";

const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const size = (b: number | null) => b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 16, overflow: "hidden" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: `1px solid ${HT.line}`, fontSize: 14 };
const btn: React.CSSProperties = { border: `1px solid ${HT.line}`, background: "transparent", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", color: HT.ink, fontFamily: "inherit" };

export default function HistoryPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chats");
  const [q, setQ] = useState("");
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [open, setOpen] = useState<{ id: string; msgs: Msg[] | null } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").trim();
      if (!id) { router.push("/finance/setup"); return; } setBizId(id);
    });
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "files" || t === "inbox" || t === "chats") setTab(t);
  }, [router]);
  useEffect(() => {
    if (!bizId) return;
    fetch(`/api/finance/history?business_id=${bizId}`).then(r => r.json()).then(j => j.error ? setErr(j.error) : setChats(j.chats)).catch(() => setErr("Couldn't load the history."));
    fetch(`/api/finance/shelf?business_id=${bizId}`).then(r => r.json()).then(j => setFiles(j.items ?? [])).catch(() => setFiles([]));
  }, [bizId]);

  const attachments = useMemo(() => (files ?? []).filter(f => f.source === "frebook" || f.source === "upload"), [files]);
  const inbox = useMemo(() => (files ?? []).filter(f => f.source === "inbox"), [files]);
  const needle = q.trim().toLowerCase();
  const shownChats = (chats ?? []).filter(c => !needle || (c.title ?? "").toLowerCase().includes(needle));
  const shownFiles = (tab === "inbox" ? inbox : attachments).filter(f => !needle || `${f.title} ${f.file_name ?? ""}`.toLowerCase().includes(needle));

  async function openChat(id: string) {
    if (open?.id === id) { setOpen(null); return; }
    setOpen({ id, msgs: null });
    const j = await fetch(`/api/finance/history?business_id=${bizId}&chat=${id}`).then(r => r.json()).catch(() => ({}));
    setOpen({ id, msgs: Array.isArray(j.messages) ? j.messages : [] });
  }
  async function download(id: string, inline = false) {
    const j = await fetch(`/api/finance/shelf?business_id=${bizId}&download=${id}${inline ? "&inline=1" : ""}`).then(r => r.json()).catch(() => ({}));
    if (j.url) window.open(j.url, "_blank", "noopener"); else setErr(j.error ?? "Couldn't open the file.");
  }

  const tabs: { k: Tab; label: string; n: number | null }[] = [
    { k: "chats", label: "FreBook chats", n: chats?.length ?? null },
    { k: "files", label: "Attachments", n: files ? attachments.length : null },
    { k: "inbox", label: "Smart Inbox", n: files ? inbox.length : null },
  ];

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <PageHero eyebrow="FreBook · History" title="Everything you gave FreBook," accent="kept for reference"
        sub="Every chat, every bill or file attached, and every Smart Inbox upload — in separate lists, newest first." />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); setOpen(null); }}
              style={{ ...btn, padding: "7px 16px", fontSize: 14, background: tab === t.k ? HT.ink : "transparent", color: tab === t.k ? HT.paper : HT.ink }}>
              {t.label}{t.n != null ? ` · ${t.n}` : ""}
            </button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            style={{ marginLeft: "auto", minWidth: 200, flex: "0 1 280px", border: `1px solid ${HT.line}`, borderRadius: 999, padding: "7px 14px", fontSize: 14, background: HT.paper, color: HT.ink, fontFamily: "inherit" }} />
        </div>
        {err && <div style={{ color: "#8A2A1A", fontSize: 14 }}>{err}</div>}

        {tab === "chats" ? (
          <div style={card}>
            {chats == null ? <div style={{ ...row, borderTop: 0, color: HT.muted }}>Loading…</div>
              : !shownChats.length ? <div style={{ ...row, borderTop: 0, color: HT.muted }}>No chats yet.</div>
              : shownChats.map(c => (
                <div key={c.id}>
                  <div style={row}>
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || "Untitled chat"}</div>
                    <div style={{ color: HT.muted, fontSize: 12.5, whiteSpace: "nowrap" }}>{when(c.created_at)}</div>
                    <button style={btn} onClick={() => openChat(c.id)}>{open?.id === c.id ? "Close" : "View"}</button>
                  </div>
                  {open?.id === c.id && (
                    <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 8, background: HT.cream }}>
                      {open.msgs == null ? <div style={{ color: HT.muted, fontSize: 13 }}>Opening…</div>
                        : !open.msgs.length ? <div style={{ color: HT.muted, fontSize: 13 }}>No messages saved in this chat.</div>
                        : open.msgs.map((m, k) => m.role === "user"
                          ? <div key={k} style={{ alignSelf: "flex-end", maxWidth: "75%", background: "#0F2B25", color: "#FFFFFF", borderRadius: "16px 16px 4px 16px", padding: "9px 14px", fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
                          : <div key={k} style={{ alignSelf: "flex-start", display: "flex", gap: 8, alignItems: "flex-start", maxWidth: "85%" }}>
                              <img src="/frebook-face.jpg" alt="" width={28} height={28} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: "0 0 0 2px #9FE1CB" }} />
                              <Reply text={m.content} />
                            </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <div style={card}>
            {files == null ? <div style={{ ...row, borderTop: 0, color: HT.muted }}>Loading…</div>
              : !shownFiles.length ? <div style={{ ...row, borderTop: 0, color: HT.muted }}>{tab === "inbox" ? "No Smart Inbox files yet. New uploads are kept from now on." : "No attachments yet."}</div>
              : shownFiles.map(f => (
                <div key={f.id} style={row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                    <div style={{ color: HT.muted, fontSize: 12 }}>{[f.source === "frebook" ? "From FreBook chat" : f.source === "inbox" ? "Smart Inbox" : "Uploaded", f.fy ? `FY ${f.fy}` : "", size(f.size_bytes)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div style={{ color: HT.muted, fontSize: 12.5, whiteSpace: "nowrap" }}>{when(f.created_at)}</div>
                  <button style={btn} onClick={() => download(f.id, true)}>View</button>
                  <button style={btn} onClick={() => download(f.id)}>Download</button>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}

// One FreBook reply as it looked in the chat: a drafted entry card, a "Posted" chip, or plain text
type Draft = { action?: string; transaction_type?: string; transaction_date?: string; amount?: number; payment_account?: string | null; counter_account?: string | null; party_name?: string | null; invoice_number?: string | null; narrative?: string | null; question?: string | null; clarification_question?: string | null;
  gst?: { applicable?: boolean; rate?: number } | null; tds?: { applicable?: boolean; section?: string | null; amount?: number } | null; lines?: { account: string; debit?: number; credit?: number }[] | null };
const rs = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const nice = (s?: string) => (s ?? "").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
function Reply({ text }: { text: string }) {
  const bubble: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${HT.line}`, borderRadius: "4px 16px 16px 16px", padding: "9px 14px", fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", color: HT.ink };
  const posted = text.match(/^✓\s*Posted:\s*(.+)$/);
  if (posted) return <span style={{ background: "#E3F3EC", color: "#0B5E42", borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600 }}>✓ Posted · {posted[1]}</span>;
  let d: Draft | null = null;
  const raw = text.trim().replace(/^```(?:json)?|```$/g, "").trim();
  if (raw.startsWith("{")) { try { d = JSON.parse(raw); } catch { d = null; } }
  if (!d || typeof d !== "object") return <div style={bubble}>{text}</div>;
  const q = d.clarification_question ?? d.question;
  const lines = d.lines?.length ? d.lines : d.amount ? [
    { account: d.counter_account ?? "—", debit: /receipt|sale|income/i.test(d.action ?? d.transaction_type ?? "") ? 0 : d.amount, credit: /receipt|sale|income/i.test(d.action ?? d.transaction_type ?? "") ? d.amount : 0 },
    { account: d.payment_account ?? "—", debit: /receipt|sale|income/i.test(d.action ?? d.transaction_type ?? "") ? d.amount : 0, credit: /receipt|sale|income/i.test(d.action ?? d.transaction_type ?? "") ? 0 : d.amount },
  ] : [];
  return (
    <div style={{ ...bubble, whiteSpace: "normal", padding: 0, overflow: "hidden", minWidth: 280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: "#F6F1E7", borderBottom: `1px solid ${HT.line}`, fontSize: 13 }}>
        <strong style={{ fontWeight: 600 }}>{nice(d.action ?? d.transaction_type) || "Entry"}</strong>
        <span style={{ color: HT.muted }}>{d.transaction_date ? new Date(d.transaction_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
      </div>
      {q && <div style={{ padding: "10px 14px", fontSize: 14 }}>{q}</div>}
      {lines.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ color: HT.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em" }}><th style={{ textAlign: "left", padding: "8px 14px 4px", fontWeight: 500 }}>Account</th><th style={{ textAlign: "right", padding: "8px 8px 4px", fontWeight: 500 }}>Debit</th><th style={{ textAlign: "right", padding: "8px 14px 4px", fontWeight: 500 }}>Credit</th></tr></thead>
          <tbody>{lines.map((l, i) => <tr key={i} style={{ borderTop: `1px solid ${HT.line}` }}><td style={{ padding: "7px 14px" }}>{l.account}</td><td style={{ textAlign: "right", padding: "7px 8px" }}>{l.debit ? rs(l.debit) : ""}</td><td style={{ textAlign: "right", padding: "7px 14px" }}>{l.credit ? rs(l.credit) : ""}</td></tr>)}</tbody>
        </table>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 14px 11px", fontSize: 12.5, color: HT.muted, borderTop: lines.length ? `1px solid ${HT.line}` : undefined }}>
        {d.party_name && <span>Party: {d.party_name}</span>}
        {d.invoice_number && <span>· Ref {d.invoice_number}</span>}
        {d.gst?.applicable && <span>· GST {d.gst.rate}%</span>}
        {d.tds?.applicable && <span>· TDS {d.tds.section ?? ""} {d.tds.amount ? rs(d.tds.amount) : ""}</span>}
        {d.narrative && <span style={{ flexBasis: "100%" }}>{d.narrative}</span>}
        {!d.party_name && !d.invoice_number && !d.gst?.applicable && !d.tds?.applicable && !d.narrative && <span>{d.amount ? `Amount ${rs(d.amount)}` : "Draft"}</span>}
      </div>
    </div>
  );
}
