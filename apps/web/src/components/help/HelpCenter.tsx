"use client";
// Help & FAQ: search, topic chips, questions that open with a simple picture (steps, chat, GST split, where to click).
import { useMemo, useState } from "react";
import Link from "next/link";
import { HELP, type Illustration, type QA } from "@/lib/helpContent";
import { FREBOOK_PLANS_LIST } from "@/lib/plans";

const NAVY = "#12352D", INK = "#10241F", MUTED = "#6B7570", LINE = "#E6DFD0", ORANGE = "#C9A24A", GREEN = "#0B7A55", SOFT = "#EFE6D3";
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", PAPER = "#FFFDF8", GOLD = "#C9A24A", GOLDINK = "#9A6B22";

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
        <span>{qa.q}</span><span className="hc-plus" aria-hidden="true">{open ? "▼" : "▶"}</span>
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
  const [topic, setTopic] = useState<string>(HELP[0]?.id ?? "all");
  const [open, setOpen] = useState<string | null>(`${HELP[0]?.id}-0`);
  const q = query.trim().toLowerCase();
  const topics = useMemo(() => HELP
    .filter(t => topic === "all" || t.id === topic || q)
    .map(t => ({ ...t, items: t.items.map((it, i) => ({ it, key: `${t.id}-${i}` })).filter(({ it }) => !q || (it.q + " " + it.a.join(" ")).toLowerCase().includes(q)) }))
    .filter(t => t.items.length), [topic, q]);
  const count = topics.reduce((s, t) => s + t.items.length, 0);

  const code = (title: string) => title.split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase().slice(0, 3);
  return (
    <div className="hc" style={{ background: "#F4EFE4", color: INK, fontFamily: SERIF, minHeight: inApp ? undefined : "100vh" }}>
      <style>{`
        .hc *{box-sizing:border-box}
        .hc-wrap{max-width:1200px;margin:0 auto;padding:0 28px}
        .hc-search{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:10px;background:${PAPER};border-radius:999px;padding:5px 5px 5px 22px;height:62px}
        .hc-search input{flex:1;border:none;outline:none;font-size:17px;color:${INK};background:transparent;min-width:0;font-family:${SERIF}}
        .hc-topics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        @media(max-width:1000px){.hc-topics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.hc-topics{grid-template-columns:minmax(0,1fr)}}
        .hc-tcard{display:flex;gap:14px;align-items:flex-start;text-align:left;padding:18px 20px;border-radius:14px;border:1px solid ${LINE};background:${PAPER};color:${INK};cursor:pointer;font-family:${SERIF}}
        .hc-tcard:hover{border-color:${GOLD}}
        .hc-tcard[aria-pressed=true]{background:${NAVY};border-color:${NAVY};color:#fff}
        .hc-tcard[aria-pressed=true] .hc-tb{color:#D3DCD8}
        .hc-tcode{width:42px;height:42px;flex-shrink:0;border-radius:10px;background:${NAVY};color:${GOLD};display:grid;place-items:center;font-size:12.5px;letter-spacing:.04em}
        .hc-tcard[aria-pressed=true] .hc-tcode{background:rgba(255,255,255,.12)}
        .hc-tb{display:block;font-size:14px;color:${MUTED};margin-top:2px;line-height:1.35}
        .hc-sec{display:grid;grid-template-columns:300px minmax(0,1fr);gap:40px;align-items:start}
        @media(max-width:860px){.hc-sec{grid-template-columns:minmax(0,1fr);gap:14px}}
        .hc-list{display:flex;flex-direction:column;gap:12px}
        .hc-item{background:${PAPER};border:1px solid ${LINE};border-radius:16px;overflow:hidden}
        .hc-q{width:100%;display:flex;align-items:center;gap:12px;background:none;border:none;text-align:left;padding:20px 24px;font-size:19px;color:${INK};cursor:pointer;font-family:${SERIF}}
        .hc-plus{order:-1;font-size:13px;color:${INK};flex-shrink:0;width:14px}
        .hc-a{margin:0 24px;padding:18px 0 22px;border-top:1px solid ${LINE};color:#33433E;font-size:16px;line-height:1.75}
        .hc-a p{margin:0 0 12px;max-width:72ch}
        .hc-pic{margin:6px 0 12px;padding:16px;border-radius:14px;background:#F8F3E8;border:1px solid ${LINE};overflow-x:auto}
        .hc-link{color:${GOLDINK};text-decoration:underline;font-size:15px}
        .hc-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
        .hc-steps li{display:flex;gap:10px;align-items:flex-start;background:${PAPER};border:1px solid ${LINE};border-radius:12px;padding:12px;font-size:14px;color:${INK}}
        .hc-num{width:24px;height:24px;border-radius:12px;background:${NAVY};color:#fff;font-size:12px;display:grid;place-items:center;flex-shrink:0}
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
        .hc-chip{padding:6px 12px;border-radius:999px;background:${PAPER};border:1px solid ${LINE};font-size:13px;color:${INK}}
        .hc-chip.end{background:${NAVY};border-color:${NAVY};color:#fff}
        .hc-sep{color:${MUTED}}
        .hc-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
        .hc-plan{background:${PAPER};border:1px solid ${LINE};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:${MUTED}}
        .hc-plan-top{display:flex;justify-content:space-between;color:${INK}}
        .hc-plan-top span{font-weight:700}.hc-plan-top small{color:${MUTED}}
        .hc-bar{height:8px;border-radius:4px;background:${SOFT};overflow:hidden}
        .hc-bar span{display:block;height:100%;background:${NAVY};border-radius:4px}
        .hc-q:focus-visible,.hc-tcard:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
      `}</style>

      <header style={{ background: NAVY, color: "#FFFFFF" }}>
        <div className="hc-wrap" style={{ paddingTop: inApp ? 22 : 96 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>Fre<span style={{ color: GOLD }}>Book</span></span>
            <Link href={inApp ? "/finance" : "/"} style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.28)", color: "#FFFFFF", textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: 15 }}>← Back to {inApp ? "FreBook" : "home"}</Link>
          </div>
          <div style={{ textAlign: "center", padding: "52px 0 48px" }}>
            <div style={{ fontSize: 13, letterSpacing: "0.3em", color: GOLD }}>HELP CENTRE</div>
            <h1 style={{ margin: "10px 0 14px", fontSize: "clamp(40px,6vw,64px)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.1 }}>How can we help?</h1>
            <p style={{ margin: "0 auto 28px", maxWidth: 760, fontSize: 18, lineHeight: 1.6, color: "#DCE4E0" }}>Answers to common questions about FreBook: bookkeeping, WhatsApp, invoices, GST, bank, reports and plans.</p>
            <form className="hc-search" role="search" onSubmit={e => e.preventDefault()}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input type="search" placeholder="Search, e.g. IGST, WhatsApp, Tally, refund" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search help" />
              {query && <button type="button" onClick={() => setQuery("")} style={{ border: "none", background: "none", color: MUTED, cursor: "pointer", fontSize: 20 }} aria-label="Clear search">×</button>}
              <button type="submit" style={{ height: 52, padding: "0 26px", borderRadius: 999, border: "none", background: GOLD, color: INK, fontFamily: SERIF, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Search</button>
            </form>
          </div>
        </div>
      </header>

      <main className="hc-wrap" style={{ paddingTop: 40, paddingBottom: 80, display: "flex", flexDirection: "column", gap: 44 }}>
        {!q && (
          <section aria-label="Topics">
            <h2 style={{ margin: "0 0 18px", fontSize: 28, fontWeight: 400, fontStyle: "italic" }}>Browse by topic</h2>
            <div className="hc-topics">
              {HELP.map(t => (
                <button key={t.id} className="hc-tcard" aria-pressed={topic === t.id} onClick={() => { setTopic(t.id); setOpen(`${t.id}-0`); }}>
                  <span className="hc-tcode">{code(t.title)}</span>
                  <span><span style={{ display: "block", fontSize: 18 }}>{t.title}</span><span className="hc-tb">{t.blurb}</span></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {q && <p style={{ margin: 0, color: MUTED, fontSize: 16, fontStyle: "italic" }}>{count ? `${count} answer${count === 1 ? "" : "s"} for “${query.trim()}”` : `Nothing found for “${query.trim()}”. Try another word, or ask us on WhatsApp.`}</p>}
        {topics.map(t => (
          <section key={t.id} className="hc-sec" aria-labelledby={`t-${t.id}`}>
            <div>
              <div style={{ fontSize: 13, letterSpacing: "0.24em", color: GOLDINK }}>TOPIC</div>
              <h2 id={`t-${t.id}`} style={{ margin: "6px 0 10px", fontSize: 36, fontWeight: 400, fontStyle: "italic", lineHeight: 1.15 }}>{t.title}</h2>
              <p style={{ margin: 0, color: MUTED, fontSize: 16, lineHeight: 1.55 }}>{t.blurb}</p>
            </div>
            <div className="hc-list">
              {t.items.map(({ it, key }) => <Item key={key} qa={it} open={open === key || (!!q && count <= 3)} onToggle={() => setOpen(open === key ? null : key)} />)}
            </div>
          </section>
        ))}

        <div style={{ background: NAVY, color: "#FFFFFF", borderRadius: 22, padding: "34px 40px", display: "flex", gap: 18, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 30, fontStyle: "italic" }}>Still stuck?</div>
            <div style={{ fontSize: 16, color: "#DCE4E0", marginTop: 6 }}>Message the FreBook team and a real person will get back to you.</div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="https://wa.me/919539028318?text=Hi%20FreWork%2C%20I%20have%20a%20question%20about%20FreBook" target="_blank" rel="noopener noreferrer" style={{ height: 50, padding: "0 26px", borderRadius: 999, background: GOLD, color: INK, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: 16 }}>Chat on WhatsApp →</a>
            <a href="mailto:support@frework.online?subject=FreBook%20help" style={{ height: 50, padding: "0 26px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: 16 }}>Email support</a>
          </div>
        </div>
      </main>
    </div>
  );
}
