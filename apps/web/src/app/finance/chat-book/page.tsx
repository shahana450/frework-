"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Line = { account: string; debit: number; credit: number };
type ParsedEntry = {
  date: string;
  narration: string;
  type: string;
  lines: Line[];
  gst: { rate: number; cgst: number; sgst: number; igst: number } | null;
  party: string | null;
  reference: string | null;
  confidence: number;
  needs_clarification: string[];
};

type ChatMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "entry"; parsed: ParsedEntry; balanced: boolean }
  | { role: "confirmed"; entry_no: string; journal_id: string; confirmed_at: number }
  | { role: "error"; text: string };

const QUICK = [
  "Paid ₹5,000 rent by cash",
  "Received ₹25,000 from client via bank",
  "Bought stationery ₹850 by UPI",
  "Show today's posted entries",
];

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const TYPE_COLOR: Record<string, string> = {
  sales: "#34D399", purchase: "#F87171", payment: "#F59E0B",
  receipt: "#60A5FA", journal: "#A78BFA", expense: "#FB923C",
};

export default function ChatBookPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: "Hi! I'm your AI bookkeeper. Tell me what happened — I'll convert it into a double-entry journal for you to confirm.\n\nExample: *Paid ₹5,000 rent by cash*" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
    });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !bizId || !userId || loading) return;
    setInput("");
    setMessages(p => [...p, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/finance/chat-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, business_id: bizId, user_id: userId, session_id: sessionId }),
      });
      const json = await res.json();
      if (!res.ok) { setMessages(p => [...p, { role: "error", text: json.error ?? "Failed" }]); return; }
      setSessionId(json.session_id);
      const { parsed, balanced } = json;
      if (parsed.needs_clarification?.length) {
        setMessages(p => [...p, { role: "assistant", text: parsed.needs_clarification.join("\n") }]);
      } else {
        setMessages(p => [...p, { role: "entry", parsed, balanced }]);
      }
    } catch {
      setMessages(p => [...p, { role: "error", text: "Network error — please try again." }]);
    } finally { setLoading(false); }
  }, [input, bizId, userId, loading, sessionId]);

  const confirm = useCallback(async (parsed: ParsedEntry) => {
    if (!bizId || !userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/finance/chat-book/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: bizId, user_id: userId, parsed, session_id: sessionId }),
      });
      const json = await res.json();
      if (!res.ok) { setMessages(p => [...p, { role: "error", text: json.error ?? "Failed to post" }]); return; }
      setMessages(p => p.map(m =>
        m.role === "entry" && m.parsed === parsed
          ? { role: "confirmed" as const, entry_no: json.entry_no, journal_id: json.journal_id, confirmed_at: Date.now() }
          : m
      ));
      setMessages(p => [...p, { role: "assistant", text: `✅ Posted as **${json.entry_no}**. Tell me the next transaction, or ask anything.` }]);
    } catch {
      setMessages(p => [...p, { role: "error", text: "Failed to post entry." }]);
    } finally { setLoading(false); }
  }, [bizId, userId, sessionId]);

  const undo = useCallback(async (journal_id: string) => {
    if (!bizId || !userId) return;
    const res = await fetch("/api/finance/chat-book/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journal_id, business_id: bizId, user_id: userId }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessages(p => [...p, { role: "assistant", text: "↩ Entry voided. It's removed from your books." }]);
    } else {
      setMessages(p => [...p, { role: "error", text: json.error ?? "Undo failed" }]);
    }
  }, [bizId, userId]);

  const S = {
    page: { minHeight: "100vh", background: "#070C1A", color: "#E8EDF5", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" as const },
    nav: { borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56, flexShrink: 0 },
    body: { flex: 1, display: "flex", flexDirection: "column" as const, maxWidth: 780, margin: "0 auto", width: "100%", padding: "0 1rem" },
    messages: { flex: 1, overflowY: "auto" as const, padding: "1.5rem 0", display: "flex", flexDirection: "column" as const, gap: "0.85rem" },
    inputRow: { padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column" as const, gap: "0.6rem", flexShrink: 0 },
  };

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(232,237,245,0.3)" }}>›</span>
        <span style={{ color: "rgba(232,237,245,0.6)", fontSize: "0.85rem" }}>Chat Bookkeeping</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/journals" style={{ fontSize: "0.78rem", color: "rgba(232,237,245,0.4)", textDecoration: "none" }}>View all entries →</Link>
      </nav>

      <div style={S.body}>
        <div style={S.messages}>
          {messages.map((m, i) => {
            if (m.role === "user") return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: "#C9A84C", color: "#070C1A", borderRadius: "16px 16px 4px 16px", padding: "0.65rem 1rem", maxWidth: "72%", fontSize: "0.88rem", fontWeight: 500 }}>
                  {m.text}
                </div>
              </div>
            );
            if (m.role === "assistant") return (
              <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>🤖</div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 16px 16px 16px", padding: "0.65rem 1rem", maxWidth: "80%", fontSize: "0.88rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}
                  dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>") }} />
              </div>
            );
            if (m.role === "error") return (
              <div key={i} style={{ display: "flex", gap: "0.6rem" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(248,113,113,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>⚠️</div>
                <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "4px 16px 16px 16px", padding: "0.65rem 1rem", maxWidth: "80%", fontSize: "0.88rem", color: "#F87171" }}>{m.text}</div>
              </div>
            );
            if (m.role === "confirmed") {
              const canUndo = Date.now() - m.confirmed_at < 5 * 60 * 1000;
              return (
                <div key={i} style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>✅</div>
                  <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "0.65rem 1rem", fontSize: "0.85rem" }}>
                    <span style={{ color: "#34D399", fontWeight: 700 }}>Posted: {m.entry_no}</span>
                    {canUndo && (
                      <button onClick={() => undo(m.journal_id)}
                        style={{ marginLeft: "1rem", fontSize: "0.75rem", color: "#F87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "2px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                        ↩ Undo
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            if (m.role === "entry") {
              const { parsed, balanced } = m;
              const totalDr = parsed.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
              return (
                <div key={i} style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>📒</div>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${balanced ? "rgba(52,211,153,0.3)" : "rgba(252,211,77,0.3)"}`, borderRadius: 12, padding: "1rem", flex: 1, maxWidth: "88%" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${TYPE_COLOR[parsed.type] ?? "#A78BFA"}18`, color: TYPE_COLOR[parsed.type] ?? "#A78BFA", textTransform: "capitalize" }}>{parsed.type}</span>
                      <span style={{ fontSize: "0.8rem", color: "rgba(232,237,245,0.5)" }}>{new Date(parsed.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {parsed.party && <span style={{ fontSize: "0.78rem", color: "#C9A84C" }}>• {parsed.party}</span>}
                      {parsed.reference && <span style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.35)", fontFamily: "monospace" }}>{parsed.reference}</span>}
                      <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: parsed.confidence >= 0.85 ? "#34D399" : "#FCD34D", fontWeight: 600 }}>{Math.round(parsed.confidence * 100)}% confident</span>
                    </div>
                    <div style={{ fontSize: "0.84rem", marginBottom: "0.75rem", color: "rgba(232,237,245,0.7)", fontStyle: "italic" }}>{parsed.narration}</div>

                    {/* Journal lines table */}
                    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, overflow: "hidden", marginBottom: "0.75rem" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                            <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "rgba(232,237,245,0.4)", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase" }}>Account</th>
                            <th style={{ padding: "0.4rem 0.75rem", textAlign: "right", color: "rgba(232,237,245,0.4)", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase" }}>Debit</th>
                            <th style={{ padding: "0.4rem 0.75rem", textAlign: "right", color: "rgba(232,237,245,0.4)", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase" }}>Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.lines.map((l, j) => (
                            <tr key={j} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "0.4rem 0.75rem", color: "#E8EDF5" }}>{l.account}</td>
                              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", color: l.debit > 0 ? "#F87171" : "rgba(232,237,245,0.2)", fontVariantNumeric: "tabular-nums" }}>{l.debit > 0 ? fmt(l.debit) : "—"}</td>
                              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", color: l.credit > 0 ? "#34D399" : "rgba(232,237,245,0.2)", fontVariantNumeric: "tabular-nums" }}>{l.credit > 0 ? fmt(l.credit) : "—"}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                            <td style={{ padding: "0.4rem 0.75rem", fontWeight: 700, fontSize: "0.75rem", color: "rgba(232,237,245,0.5)" }}>TOTAL</td>
                            <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#F87171", fontVariantNumeric: "tabular-nums" }}>{fmt(totalDr)}</td>
                            <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#34D399", fontVariantNumeric: "tabular-nums" }}>{fmt(totalDr)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* GST details */}
                    {parsed.gst && (
                      <div style={{ fontSize: "0.75rem", color: "rgba(232,237,245,0.4)", marginBottom: "0.75rem" }}>
                        GST {parsed.gst.rate}% —
                        {parsed.gst.cgst > 0 && ` CGST: ${fmt(parsed.gst.cgst)}`}
                        {parsed.gst.sgst > 0 && ` SGST: ${fmt(parsed.gst.sgst)}`}
                        {parsed.gst.igst > 0 && ` IGST: ${fmt(parsed.gst.igst)}`}
                      </div>
                    )}

                    {!balanced && (
                      <div style={{ fontSize: "0.78rem", color: "#FCD34D", background: "rgba(252,211,77,0.08)", border: "1px solid rgba(252,211,77,0.2)", borderRadius: 6, padding: "0.4rem 0.75rem", marginBottom: "0.75rem" }}>
                        ⚠ Entry is unbalanced — please clarify before posting
                      </div>
                    )}

                    {/* Action buttons */}
                    {balanced && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => confirm(parsed)}
                          disabled={loading}
                          style={{ flex: 1, padding: "0.6rem", borderRadius: 8, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#34D399", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer", fontFamily: "inherit" }}>
                          ✓ Confirm & Post
                        </button>
                        <button onClick={() => { setMessages(p => p.filter((_, idx) => idx !== i)); setInput(""); inputRef.current?.focus(); }}
                          style={{ padding: "0.6rem 1rem", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(232,237,245,0.5)", fontWeight: 600, fontSize: "0.84rem", cursor: "pointer", fontFamily: "inherit" }}>
                          ✕ Discard
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })}
          {loading && (
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(201,168,76,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>🤖</div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 16px 16px 16px", padding: "0.65rem 1rem", color: "rgba(232,237,245,0.4)", fontSize: "0.85rem" }}>
                Parsing transaction…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick chips */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", paddingBottom: "0.5rem" }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => send(q)} disabled={loading}
              style={{ fontSize: "0.75rem", padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(201,168,76,0.25)", background: "rgba(201,168,76,0.07)", color: "rgba(201,168,76,0.8)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={S.inputRow}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Describe a transaction… (Enter to send, Shift+Enter for newline)"
              rows={2}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#E8EDF5", padding: "0.65rem 0.9rem", borderRadius: 10, fontSize: "0.88rem", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5 }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ padding: "0.65rem 1.25rem", borderRadius: 10, background: input.trim() ? "#C9A84C" : "rgba(201,168,76,0.2)", color: input.trim() ? "#070C1A" : "rgba(201,168,76,0.4)", fontWeight: 700, fontSize: "0.9rem", border: "none", cursor: input.trim() ? "pointer" : "default", fontFamily: "inherit", transition: "all 0.15s" }}>
              Send
            </button>
          </div>
          <div style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.2)", textAlign: "center" }}>
            AI-parsed entries require your confirmation before posting. Rate limit: 30 messages/hour.
          </div>
        </div>
      </div>
    </div>
  );
}
