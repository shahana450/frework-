"use client";
// Help & FAQ: search, topic chips, questions that open with a simple picture (steps, chat, GST split, where to click).
import { useMemo, useState } from "react";
import Link from "next/link";
import { HELP, type Illustration, type QA } from "@/lib/helpContent";
import { FREBOOK_PLANS_LIST } from "@/lib/plans";

const NAVY = "#232A63", INK = "#141A3A", MUTED = "#5A6080", LINE = "#E1E4EE", ORANGE = "#F0662B", GREEN = "#0B7A55", SOFT = "#EEF0FA";

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="hc-steps" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="hc-num">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Chat({ lines }: { lines: { from: "you" | "frebook"; text: string }[] }) {
  return (
    <div className="hc-chat" aria-label="WhatsApp example">
      <div className="hc-chat-head"><span className="hc-avatar">F</span><div><b>FreBook</b><small>WhatsApp</small></div></div>
      <div className="hc-chat-body">
        {lines.map((l, i) => <div key={i} className={`hc-bubble ${l.from === "you" ? "you" : "bot"}`}>{l.text}</div>)}
      </div>
    </div>
  );
}

function GstSplit() {
  return (
    <svg viewBox="0 0 560 190" role="img" aria-label="Same state: CGST 9% plus SGST 9%. Other state: IGST 18%." style={{ width: "100%", maxWidth: 560, height: "auto" }}>
      <rect x="200" y="70" width="160" height="50" rx="12" fill={NAVY} />
      <text x="280" y="92" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">Your business</text>
      <text x="280" y="110" textAnchor="middle" fill="#C9CEF0" fontSize="12">Kerala · 18% item</text>
      <path d="M200 95 C150 95 150 40 110 40" fill="none" stroke={GREEN} strokeWidth="2.5" markerEnd="url(#a1)" />
      <path d="M360 95 C410 95 410 40 450 40" fill="none" stroke={ORANGE} strokeWidth="2.5" markerEnd="url(#a2)" />
      <defs>
        <marker id="a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill={GREEN} /></marker>
        <marker id="a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill={ORANGE} /></marker>
      </defs>
      <rect x="10" y="12" width="150" height="56" rx="12" fill="#E3F6EE" stroke={GREEN} />
      <text x="85" y="35" textAnchor="middle" fill={INK} fontSize="13" fontWeight="700">Customer in Kerala</text>
      <text x="85" y="55" textAnchor="middle" fill={GREEN} fontSize="12" fontWeight="700">same state</text>
      <rect x="400" y="12" width="150" height="56" rx="12" fill="#FFF1EA" stroke={ORANGE} />
      <text x="475" y="35" textAnchor="middle" fill={INK} fontSize="13" fontWeight="700">Customer in Tamil Nadu</text>
      <text x="475" y="55" textAnchor="middle" fill={ORANGE} fontSize="12" fontWeight="700">other state</text>
      <rect x="10" y="132" width="150" height="46" rx="10" fill="#fff" stroke={LINE} />
      <text x="85" y="160" textAnchor="middle" fill={INK} fontSize="14" fontWeight="800">CGST 9% + SGST 9%</text>
      <rect x="400" y="132" width="150" height="46" rx="10" fill="#fff" stroke={LINE} />
      <text x="475" y="160" textAnchor="middle" fill={INK} fontSize="14" fontWeight="800">IGST 18%</text>
      <path d="M85 68 V128" stroke={GREEN} strokeWidth="2" strokeDasharray="4 4" />
      <path d="M475 68 V128" stroke={ORANGE} strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  );
}

function PathChips({ path }: { path: string[] }) {
  return (
    <div className="hc-path" aria-label="Where to click">
      {path.map((p, i) => <span key={i} className="hc-path-row"><span className={`hc-chip${i === path.length - 1 ? " end" : ""}`}>{p}</span>{i < path.length - 1 && <span className="hc-sep">›</span>}</span>)}
    </div>
  );
}

function Plans() {
  const max = Math.max(...FREBOOK_PLANS_LIST.map(p => p.businesses ?? 0));
  return (
    <div className="hc-plans">
      {FREBOOK_PLANS_LIST.map(p => (
        <div key={p.id} className="hc-plan">
          <div className="hc-plan-top"><b>{p.name}</b><span>₹{p.price.toLocaleString("en-IN")}<small>/mo</small></span></div>
          <div className="hc-bar"><span style={{ width: `${Math.max(8, ((p.businesses ?? max) / max) * 100)}%` }} /></div>
          <small>{p.businesses === 1 ? "1 business" : `${p.businesses} businesses`} · {p.pages.toLocaleString("en-IN")} PDF pages</small>
        </div>
      ))}
    </div>
  );
}

function Picture({ pic }: { pic: Illustration }) {
  if (pic.kind === "steps") return <Steps steps={pic.steps} />;
  if (pic.kind === "chat") return <Chat lines={pic.lines} />;
  if (pic.kind === "gst") return <GstSplit />;
  if (pic.kind === "path") return <PathChips path={pic.path} />;
  return <Plans />;
}

function Item({ qa, open, onToggle }: { qa: QA; open: boolean; onToggle: () => void }) {
  return (
    <div className={`hc-item${open ? " open" : ""}`}>
      <button className="hc-q" aria-expanded={open} onClick={onToggle}>
        <span>{qa.q}</span><span className="hc-plus" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="hc-a">
          {qa.a.map((p, i) => <p key={i}>{p}</p>)}
          {qa.pic && <div className="hc-pic"><Picture pic={qa.pic} /></div>}
          {qa.link && <Link href={qa.link.href} className="hc-link">{qa.link.label} →</Link>}
        </div>
      )}
    </div>
  );
}

export default function HelpCenter({ inApp = false }: { inApp?: boolean }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>("all");
  const [open, setOpen] = useState<string | null>("start-0");
  const q = query.trim().toLowerCase();
  const topics = useMemo(() => HELP
    .filter(t => topic === "all" || t.id === topic || q)
    .map(t => ({ ...t, items: t.items.map((it, i) => ({ it, key: `${t.id}-${i}` })).filter(({ it }) => !q || (it.q + " " + it.a.join(" ")).toLowerCase().includes(q)) }))
    .filter(t => t.items.length), [topic, q]);
  const count = topics.reduce((s, t) => s + t.items.length, 0);

  return (
    <div className="hc" style={{ background: "#F4F5FA", color: INK, fontFamily: "var(--font-plus-jakarta),var(--font-inter),system-ui,sans-serif", minHeight: inApp ? undefined : "100vh" }}>
      <style>{`
        .hc *{box-sizing:border-box}
        .hc-hero{padding:120px 16px 36px;text-align:center;background:radial-gradient(ellipse 60% 60% at 50% 0%,rgba(35,42,99,.09),transparent 70%)}
        .hc-hero h1{margin:0 0 10px;font-size:clamp(30px,5vw,48px);font-weight:800;letter-spacing:-.03em;text-wrap:balance}
        .hc-hero p{margin:0 auto 22px;max-width:560px;color:${MUTED};font-size:16px;line-height:1.6}
        .hc-search{max-width:560px;margin:0 auto;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid ${LINE};border-radius:16px;padding:0 16px;height:54px;box-shadow:0 14px 40px -24px rgba(20,26,58,.35)}
        .hc-search input{flex:1;border:none;outline:none;font-size:16px;color:${INK};background:transparent;min-width:0}
        .hc-search:focus-within{border-color:${NAVY}}
        .hc-chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:980px;margin:22px auto 0;padding:0 16px}
        .hc-chipbtn{border:1px solid ${LINE};background:#fff;color:${INK};border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:700;cursor:pointer}
        .hc-chipbtn[aria-pressed=true]{background:${NAVY};border-color:${NAVY};color:#fff}
        .hc-chipbtn:focus-visible,.hc-q:focus-visible{outline:2px solid ${ORANGE};outline-offset:2px}
        .hc-main{max-width:860px;margin:0 auto;padding:28px 16px 80px;display:flex;flex-direction:column;gap:28px}
        .hc-topic h2{display:flex;align-items:center;gap:10px;margin:0 0 4px;font-size:20px;font-weight:800}
        .hc-topic .blurb{margin:0 0 12px;color:${MUTED};font-size:13.5px}
        .hc-list{display:flex;flex-direction:column;gap:8px}
        .hc-item{background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;transition:box-shadow .2s,border-color .2s}
        .hc-item.open{border-color:#C9CEDF;box-shadow:0 16px 40px -28px rgba(20,26,58,.4)}
        .hc-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:14px;background:none;border:none;text-align:left;padding:16px 18px;font-size:15px;font-weight:700;color:${INK};cursor:pointer}
        .hc-plus{width:26px;height:26px;border-radius:8px;background:${SOFT};color:${NAVY};display:grid;place-items:center;font-size:18px;flex-shrink:0}
        .hc-a{padding:0 18px 18px;color:#3C4366;font-size:14.5px;line-height:1.65}
        .hc-a p{margin:0 0 10px;max-width:68ch}
        .hc-pic{margin:6px 0 12px;padding:16px;border-radius:14px;background:#F7F8FC;border:1px solid ${LINE};overflow-x:auto}
        .hc-link{color:${NAVY};font-weight:800;text-decoration:none;font-size:14px}
        .hc-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;counter-reset:s}
        .hc-steps li{position:relative;display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid ${LINE};border-radius:12px;padding:12px;font-size:13.5px;font-weight:600;color:${INK}}
        .hc-num{width:24px;height:24px;border-radius:12px;background:${NAVY};color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;flex-shrink:0}
        .hc-steps li:last-child .hc-num{background:${GREEN}}
        .hc-chat{max-width:380px;border-radius:16px;overflow:hidden;border:1px solid ${LINE};background:#ECE5DD}
        .hc-chat-head{display:flex;gap:10px;align-items:center;padding:10px 12px;background:#075E54;color:#fff}
        .hc-chat-head small{display:block;opacity:.75;font-size:11px}
        .hc-avatar{width:30px;height:30px;border-radius:15px;background:#fff;color:#075E54;font-weight:900;display:grid;place-items:center}
        .hc-chat-body{display:flex;flex-direction:column;gap:6px;padding:12px}
        .hc-bubble{max-width:85%;padding:7px 10px;border-radius:10px;font-size:13px;line-height:1.45;white-space:pre-wrap;color:#111;box-shadow:0 1px 0 rgba(0,0,0,.08)}
        .hc-bubble.you{align-self:flex-end;background:#DCF8C6;border-top-right-radius:2px}
        .hc-bubble.bot{align-self:flex-start;background:#fff;border-top-left-radius:2px}
        .hc-path{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
        .hc-path-row{display:inline-flex;align-items:center;gap:6px}
        .hc-chip{padding:6px 12px;border-radius:999px;background:#fff;border:1px solid ${LINE};font-size:13px;font-weight:700;color:${INK}}
        .hc-chip.end{background:${NAVY};border-color:${NAVY};color:#fff}
        .hc-sep{color:${MUTED};font-weight:800}
        .hc-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
        .hc-plan{background:#fff;border:1px solid ${LINE};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:${MUTED}}
        .hc-plan-top{display:flex;justify-content:space-between;color:${INK}}
        .hc-plan-top span{font-weight:800}.hc-plan-top small{font-weight:500;color:${MUTED}}
        .hc-bar{height:8px;border-radius:4px;background:${SOFT};overflow:hidden}
        .hc-bar span{display:block;height:100%;background:${NAVY};border-radius:4px}
        .hc-cta{background:${INK};color:#fff;border-radius:22px;padding:26px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .hc-cta a{background:${ORANGE};color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:12px}
        @media (prefers-reduced-motion:reduce){.hc-item{transition:none}}
      `}</style>

      <section className="hc-hero" style={inApp ? { paddingTop: 36 } : undefined}>
        <h1>How can we help?</h1>
        <p>Answers to common questions about FreBook — bookkeeping, WhatsApp, invoices, GST, bank, reports and plans.</p>
        <label className="hc-search">
          <span aria-hidden="true">🔍</span>
          <input type="search" placeholder="Search, e.g. IGST, WhatsApp, Tally, refund…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search help" />
          {query && <button onClick={() => setQuery("")} style={{ border: "none", background: "none", color: MUTED, cursor: "pointer", fontSize: 18 }} aria-label="Clear search">×</button>}
        </label>
        <div className="hc-chips" role="group" aria-label="Topics">
          <button className="hc-chipbtn" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>All topics</button>
          {HELP.map(t => <button key={t.id} className="hc-chipbtn" aria-pressed={topic === t.id} onClick={() => { setTopic(t.id); setQuery(""); }}>{t.icon} {t.title}</button>)}
        </div>
      </section>

      <main className="hc-main">
        {q && <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>{count ? `${count} answer${count === 1 ? "" : "s"} for “${query.trim()}”` : `Nothing found for “${query.trim()}”. Try another word, or ask us on WhatsApp.`}</p>}
        {topics.map(t => (
          <section key={t.id} className="hc-topic" aria-labelledby={`t-${t.id}`}>
            <h2 id={`t-${t.id}`}><span aria-hidden="true">{t.icon}</span>{t.title}</h2>
            <p className="blurb">{t.blurb}</p>
            <div className="hc-list">
              {t.items.map(({ it, key }) => <Item key={key} qa={it} open={open === key || (!!q && count <= 3)} onToggle={() => setOpen(open === key ? null : key)} />)}
            </div>
          </section>
        ))}
        <div className="hc-cta">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Still stuck?</div>
            <div style={{ opacity: .75, fontSize: 14, marginTop: 4 }}>Message us on WhatsApp — a real person replies.</div>
          </div>
          <a href="https://wa.me/919539028318?text=Hi%20FreWork%2C%20I%20have%20a%20question%20about%20FreBook" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
        </div>
      </main>
    </div>
  );
}
