"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const WEBHOOK_URL = typeof window !== "undefined" ? `${window.location.origin}/api/finance/whatsapp-webhook` : "https://frework.online/api/finance/whatsapp-webhook";

const STEPS = [
  {
    title: "Create a Meta App",
    desc: "Go to developers.facebook.com → My Apps → Create App → Choose 'Business' type → Add WhatsApp product.",
    link: "https://developers.facebook.com/apps/",
    linkLabel: "Open Meta Developer Console →",
  },
  {
    title: "Get your credentials",
    desc: "In WhatsApp → API Setup, copy: Phone Number ID, WhatsApp Business Account ID, and generate a Permanent Access Token.",
  },
  {
    title: "Configure Webhook",
    desc: "In WhatsApp → Configuration → Webhooks, set the URL below and verify token. Subscribe to 'messages' events.",
  },
  {
    title: "Save credentials here",
    desc: "Paste your credentials below. We'll store them securely and start processing messages automatically.",
  },
];

const DEMO_MSGS = [
  { from: "user", text: "Paid 5000 rent by cash today" },
  { from: "bot", text: "📒 *Rent Payment - Sep 2026*\n\nRent Expense Dr ₹5,000\nCash Cr ₹5,000\n\nReply *YES* to post, *NO* to cancel." },
  { from: "user", text: "YES" },
  { from: "bot", text: "✅ Posted as JV-0042! Your books are updated." },
];

export default function WhatsAppPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [phoneId, setPhoneId] = useState("");
  const [wabId, setWabId] = useState("");
  const [token, setToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("frework_wh_2026");
  const [saved, setSaved] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://frework.online/api/finance/whatsapp-webhook");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/finance/whatsapp-webhook`);
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (saved) setBizId(saved);

      // Load saved config
      const cfg = JSON.parse(localStorage.getItem(`fw_whatsapp_cfg_${saved}`) ?? "{}");
      if (cfg.phoneId) setPhoneId(cfg.phoneId);
      if (cfg.wabId) setWabId(cfg.wabId);
      if (cfg.token) setToken(cfg.token);
      if (cfg.verifyToken) setVerifyToken(cfg.verifyToken);
    });
  }, []);

  const saveConfig = () => {
    if (!bizId) return;
    localStorage.setItem(`fw_whatsapp_cfg_${bizId}`, JSON.stringify({ phoneId, wabId, token, verifyToken }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1500); });
  };

  const S = {
    page: { minHeight: "100vh", background: "#0A0D14", color: "#E8EDF5", fontFamily: "Inter,system-ui,sans-serif" },
    nav: { borderBottom: "1px solid #1F2937", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 52 },
    main: { maxWidth: 860, margin: "0 auto", padding: "2rem 1rem" },
    card: { background: "#111827", border: "1px solid #1F2937", borderRadius: 12, padding: "1.5rem", marginBottom: "1rem" },
    label: { fontSize: "0.72rem", color: "#6B7280", marginBottom: "0.3rem", display: "block", textTransform: "uppercase" as const },
    input: { width: "100%", background: "#0A0D14", border: "1px solid #374151", color: "#E8EDF5", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" as const },
    btnPrimary: { padding: "0.55rem 1.3rem", borderRadius: 8, border: "none", background: "#25D366", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit" },
  };

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "#374151" }}>›</span>
        <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>WhatsApp Bot</span>
      </nav>

      <div style={S.main}>
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "1.5rem" }}>💬</span>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>WhatsApp Bookkeeping Bot</h1>
          </div>
          <p style={{ color: "#6B7280", fontSize: "0.84rem", margin: 0 }}>Your clients type transactions on WhatsApp → AI auto-books them. No app install needed.</p>
        </div>

        {/* Demo chat */}
        <div style={{ ...S.card, background: "#0D1B0F", borderColor: "#1a3520" }}>
          <div style={{ fontSize: "0.75rem", color: "#25D366", fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Demo Conversation</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {DEMO_MSGS.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "72%", borderRadius: m.from === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: m.from === "user" ? "#25D366" : "#1F2D22",
                  color: m.from === "user" ? "#fff" : "#E8EDF5",
                  padding: "0.6rem 0.9rem", fontSize: "0.84rem", whiteSpace: "pre-wrap",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Setup Steps */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: "1.25rem" }}>Setup Guide</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "1rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: i < 2 ? "#25D366" : "#1F2937", border: `1px solid ${i < 2 ? "#25D366" : "#374151"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0, color: i < 2 ? "#fff" : "#6B7280" }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.2rem" }}>{s.title}</div>
                  <div style={{ fontSize: "0.82rem", color: "#9CA3AF", lineHeight: 1.6 }}>{s.desc}</div>
                  {s.link && (
                    <a href={s.link} target="_blank" rel="noopener" style={{ fontSize: "0.78rem", color: "#25D366", textDecoration: "none", marginTop: "0.3rem", display: "inline-block" }}>
                      {s.linkLabel}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook URL */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: "1rem" }}>Your Webhook URL</div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <code style={{ flex: 1, background: "#0A0D14", border: "1px solid #374151", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "#34D399", wordBreak: "break-all" }}>
              {webhookUrl}
            </code>
            <button onClick={() => copy(webhookUrl, "url")} style={{ padding: "0.5rem 0.9rem", borderRadius: 6, border: "1px solid #374151", background: "#1F2937", color: "#E8EDF5", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", flexShrink: 0 }}>
              {copied === "url" ? "Copied!" : "Copy"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Verify Token (paste this in Meta console)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input style={S.input} value={verifyToken} onChange={e => setVerifyToken(e.target.value)} />
                <button onClick={() => copy(verifyToken, "vt")} style={{ padding: "0.5rem 0.9rem", borderRadius: 6, border: "1px solid #374151", background: "#1F2937", color: "#E8EDF5", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", flexShrink: 0 }}>
                  {copied === "vt" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: "1rem" }}>Meta API Credentials</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label style={S.label}>Phone Number ID</label>
              <input style={S.input} value={phoneId} onChange={e => setPhoneId(e.target.value)} placeholder="1234567890123456" />
            </div>
            <div>
              <label style={S.label}>WhatsApp Business Account ID</label>
              <input style={S.input} value={wabId} onChange={e => setWabId(e.target.value)} placeholder="9876543210987654" />
            </div>
            <div>
              <label style={S.label}>Permanent Access Token</label>
              <input style={S.input} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="EAAxxxxxxxxxx…" />
            </div>
          </div>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button style={S.btnPrimary} onClick={saveConfig}>Save Configuration</button>
            {saved && <span style={{ color: "#25D366", fontSize: "0.84rem" }}>✅ Saved!</span>}
          </div>
        </div>

        {/* Status */}
        <div style={{ ...S.card, background: "rgba(245,158,11,0.04)", borderColor: "rgba(245,158,11,0.2)", fontSize: "0.82rem", color: "#9CA3AF" }}>
          <strong style={{ color: "#F59E0B" }}>Status: Setup Required</strong> — The webhook endpoint is ready at FreWork. Complete the Meta App setup above to start receiving WhatsApp messages. Once live, your clients can WhatsApp any transaction and it gets auto-booked with AI.
        </div>
      </div>
    </div>
  );
}
