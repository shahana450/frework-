"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Message = { role: "user" | "assistant"; content: string; ts?: number };

const QUICK_PROMPTS = [
  "What is the net profit of my business this year?",
  "How much GST do I owe this month?",
  "Explain TDS on professional fees for my business",
  "What documents do I need for ITR filing?",
  "How to record a purchase with GST in double entry?",
  "When is the GSTR-3B due date for this month?",
  "What is the TDS rate for contractor payments above ₹30,000?",
  "Explain the composition scheme eligibility for my business",
];

function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:rgba(35,42,99,0.15);padding:1px 5px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/^### (.+)$/gm, '<div style="font-weight:700;font-size:0.95em;color:#232A63;margin:0.75rem 0 0.3rem">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:800;font-size:1em;color:#232A63;margin:0.75rem 0 0.35rem">$1</div>')
    .replace(/^- (.+)$/gm, '<div style="padding-left:1rem;margin:0.15rem 0">• $1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:1rem;margin:0.15rem 0">$1</div>')
    .replace(/\n\n/g, '<div style="margin:0.5rem 0"></div>')
    .replace(/\n/g, "<br/>");
  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.65, fontSize: "0.88rem" }} />;
}

export default function FreWorkAIPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_businesses").select("name").eq("id", saved).single();
      if (data) setBizName(data.name);
      setMessages([{
        role: "assistant",
        content: `Namaste! I'm **FreWork AI** — your AI financial co-pilot for **${data?.name ?? "your business"}**.\n\n — I have full access to your financial data and can help you with:\n\n- **Accounting queries** — journal entries, ledgers, double-entry\n- **GST** — GSTR-1, GSTR-3B, ITC reconciliation\n- **Income Tax** — ITR filing, advance tax, TDS\n- **Financial analysis** — P&L interpretation, cash flow\n- **Compliance** — due dates, penalties, notices\n\nAsk me anything about your finances or Indian tax laws.`,
        ts: Date.now(),
      }]);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !bizId || loading) return;
    setInput("");
    setError("");

    const userMsg: Message = { role: "user", content: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/finance/virtual-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, business_id: bizId, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI error");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get response");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request. Please try again.", ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function clearChat() {
    setMessages([{
      role: "assistant",
      content: `Chat cleared. I'm FreWork AI — how can I help with ${bizName}'s finances?`,
      ts: Date.now(),
    }]);
  }

  return (
    <div style={{ height: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56, flexShrink: 0 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span style={{ color: "#232A63", fontWeight: 800, fontSize: "0.88rem" }}>FreWork AI</span>
          <span style={{ color: "rgba(20,26,58,0.35)", fontSize: "0.6rem", letterSpacing: "0.04em" }}>Ask about your books</span>
        </div>
        <div style={{ flex: 1 }} />
        {bizName && <span style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>{bizName}</span>}
        <button onClick={clearChat} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "rgba(20,26,58,0.65)", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem" }}>
          Clear
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", maxWidth: 860, width: "100%", margin: "0 auto", padding: "0 1rem" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 0" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", gap: "0.75rem", marginBottom: "1.25rem",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
                  background: msg.role === "assistant" ? "rgba(35,42,99,0.15)" : "rgba(31,94,255,0.15)",
                  border: `1px solid ${msg.role === "assistant" ? "rgba(35,42,99,0.3)" : "rgba(31,94,255,0.3)"}`,
                }}>
                  {msg.role === "assistant" ? "🛩️" : "👤"}
                </div>
                <div style={{
                  maxWidth: "78%", padding: "0.85rem 1.1rem", borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  background: msg.role === "assistant" ? "#FFFFFF" : "rgba(31,94,255,0.1)",
                  border: `1px solid ${msg.role === "assistant" ? "rgba(20,26,58,0.10)" : "rgba(31,94,255,0.2)"}`,
                }}>
                  {msg.role === "assistant" ? <MarkdownText text={msg.content} /> : (
                    <div style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(35,42,99,0.15)", border: "1px solid rgba(35,42,99,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🛩️</div>
                <div style={{ padding: "0.85rem 1.1rem", borderRadius: "4px 14px 14px 14px", background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)" }}>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#232A63", animation: `pulse 1.2s ${i * 0.2}s infinite`, opacity: 0.7 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", paddingBottom: "0.75rem" }}>
              {QUICK_PROMPTS.map(q => (
                <button key={q} onClick={() => sendMessage(q)} style={{
                  background: "rgba(35,42,99,0.07)", border: "1px solid rgba(35,42,99,0.2)", color: "rgba(20,26,58,0.95)",
                  padding: "5px 12px", borderRadius: 16, cursor: "pointer", fontSize: "0.78rem", textAlign: "left", lineHeight: 1.4,
                }}>{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ borderTop: "1px solid rgba(20,26,58,0.11)", paddingTop: "1rem", paddingBottom: "1rem" }}>
            {error && <div style={{ color: "#C2321F", fontSize: "0.78rem", marginBottom: "0.5rem" }}>{error}</div>}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask FreWork AI anything — GST, TDS, ITR, journal entries, financial advice…"
                rows={2}
                style={{
                  flex: 1, background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.21)", color: "#141A3A",
                  padding: "10px 14px", borderRadius: 10, fontSize: "0.88rem", resize: "none", outline: "none", lineHeight: 1.55, fontFamily: "inherit",
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  background: "#232A63", border: "none", color: "#F5F6FA", padding: "10px 20px", borderRadius: 10,
                  cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", height: 44,
                  opacity: (loading || !input.trim()) ? 0.5 : 1,
                }}
              >
                {loading ? "…" : "Send"}
              </button>
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.35)", marginTop: "0.4rem" }}>Press Enter to send · Shift+Enter for new line · FreWork AI powered by Claude AI</div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
