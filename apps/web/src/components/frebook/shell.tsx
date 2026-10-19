import Link from "next/link";

// Shared look for the FreBook marketing pages (/frebook and its keyword pages).

export const FB_APP = "/finance/chat-book";
export const FB_DEMO = "https://wa.me/919539028318?text=Hi%20FreWork%2C%20I%20want%20a%20FreBook%20demo";

export function FbHeader() {
  return (
    <header className="fb-top">
      <div className="fb-wrap fb-topbar">
        <Link href="/frebook" className="fb-brand">Fre<span>Book</span></Link>
        <nav className="fb-nav">
          <Link href="/frebook/ai-accountant">AI Accountant</Link>
          <Link href="/frebook/tally-ai">Tally + AI</Link>
          <Link href="/frebook#pricing">Pricing</Link>
          <Link href={FB_APP}>Start</Link>
        </nav>
      </div>
    </header>
  );
}

export function FbFooter() {
  return (
    <footer className="fb-foot">
      <div className="fb-wrap">
        <Link href="/">FreWork</Link>
        <Link href="/frebook">FreBook</Link>
        <Link href="/frebook/ai-accountant">AI Accountant</Link>
        <Link href="/frebook/tally-ai">Connect Tally with AI</Link>
        <Link href="/services/accounting">Virtual Accountant</Link>
        <Link href="/contact">Contact</Link>
        <p>© {new Date().getFullYear()} FreWork · FreBook is a FreWork product.</p>
      </div>
    </footer>
  );
}

/** Cross-links between the FreBook pages, so each one passes weight to the others. */
export function FbRelated({ current }: { current: "main" | "ai-accountant" | "tally-ai" }) {
  const all = [
    { k: "main", href: "/frebook", h: "FreBook overview", p: "Features, pricing and how FreBook works." },
    { k: "ai-accountant", href: "/frebook/ai-accountant", h: "AI accountant for small business", p: "What an AI accountant does and where your CA still fits." },
    { k: "tally-ai", href: "/frebook/tally-ai", h: "Connect Tally with AI", p: "Keep Tally and add chat bookkeeping on top." },
  ].filter(x => x.k !== current);
  return (
    <section className="fb-alt">
      <div className="fb-wrap">
        <h2>Read next</h2>
        <div className="fb-grid">
          {all.map(x => <Link key={x.k} href={x.href} className="fb-card fb-link"><h3>{x.h} →</h3><p>{x.p}</p></Link>)}
        </div>
      </div>
    </section>
  );
}

export const FB_CSS = `
.fb{--navy:#0D2137;--navy2:#0F2044;--gold:#C9A84C;--sky:#BDD7EE;--ink:#1b2430;--muted:#5b6675;--soft:#f5f8fc;--line:#e3e9f1;
  background:#fff;color:var(--ink);line-height:1.65;font-size:17px;font-family:var(--font-inter),system-ui,sans-serif}
.fb h1,.fb h2,.fb h3,.fb-brand{font-family:var(--font-plus-jakarta),var(--font-inter),system-ui,sans-serif}
.fb a{color:inherit}
.fb-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.fb-top{background:var(--navy);color:#fff}
.fb-topbar{display:flex;justify-content:space-between;align-items:center;height:64px}
.fb-brand{font-weight:800;font-size:20px;text-decoration:none}
.fb-brand span{color:var(--gold)}
.fb-nav a{color:#dfe7f1;text-decoration:none;margin-left:22px;font-size:15px}
.fb-nav a:hover{color:var(--gold)}
.fb-crumb{font-size:13px;color:var(--muted);padding:14px 20px}
.fb-crumb a{text-decoration:none;color:var(--muted)}
.fb section{padding:70px 0}
.fb-hero{background:linear-gradient(160deg,var(--navy) 0%,var(--navy2) 70%);color:#fff;padding:72px 0 80px!important}
.fb-tag{display:inline-block;border:1px solid var(--gold);color:var(--gold);padding:4px 12px;border-radius:999px;font-size:13px;letter-spacing:.6px;text-transform:uppercase}
.fb-hero h1{font-size:clamp(32px,5vw,52px);line-height:1.15;margin:18px 0 16px;max-width:820px;font-weight:800}
.fb-lead{font-size:20px;color:#d6e2ef;max-width:720px}
.fb-cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}
.fb-btn{display:inline-block;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px}
.fb-gold{background:var(--gold);color:var(--navy)!important}
.fb-ghost{border:1px solid #8aa3bf;color:#fff!important}
.fb-chat{margin-top:44px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px;max-width:640px}
.fb-msg{padding:10px 14px;border-radius:10px;margin:8px 0;font-size:15px;max-width:90%;width:fit-content}
.fb-u{background:var(--sky);color:var(--navy);margin-left:auto}
.fb-b{background:#fff;color:var(--ink)}
.fb-note{font-size:12px;color:#8fa3bb;margin-top:8px}
.fb h2{font-size:clamp(26px,3.4vw,36px);color:var(--navy);margin-bottom:12px;font-weight:800;line-height:1.2}
.fb-sub{color:var(--muted);max-width:760px;margin-bottom:36px}
.fb h3{font-size:20px;color:var(--navy);margin-bottom:8px;font-weight:700;line-height:1.3}
.fb-alt{background:var(--soft)}
.fb-grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.fb-grid3{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.fb-card{background:#fff;border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:10px;padding:24px}
.fb-link{text-decoration:none;display:block}
.fb-link:hover{border-color:var(--gold)}
.fb-prose{max-width:760px}
.fb-prose p{margin-bottom:16px;color:#2d3846}
.fb-prose h2{margin-top:44px}
.fb-prose ol,.fb-prose ul.fb-list{padding-left:22px;margin-bottom:16px;color:#2d3846}
.fb-prose ul.fb-list{list-style:disc}
.fb-prose ol{list-style:decimal}
.fb-prose ol li::marker,.fb-prose ul.fb-list li::marker{color:var(--gold);font-weight:700}
.fb-prose li{margin-bottom:8px}
.fb-card p{color:var(--muted);font-size:16px}
.fb-steps{counter-reset:s;display:grid;gap:22px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.fb-step{position:relative;padding:24px 24px 24px 74px;background:#fff;border:1px solid var(--line);border-radius:10px}
.fb-step::before{counter-increment:s;content:counter(s);position:absolute;left:22px;top:22px;width:36px;height:36px;border-radius:50%;background:var(--navy);color:var(--gold);display:grid;place-items:center;font-weight:700}
.fb-tally{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.fb-ticks{list-style:none;padding:0;margin:0}
.fb-ticks li{padding:9px 0 9px 28px;border-bottom:1px solid var(--line);position:relative;text-align:left}
.fb-ticks li::before{content:"✓";position:absolute;left:0;color:var(--gold);font-weight:700}
.fb-sync{background:var(--navy);color:#fff;border-radius:14px;padding:34px;text-align:center}
.fb-row{display:flex;justify-content:center;align-items:center;gap:18px;font-size:22px;font-weight:700}
.fb-pill{background:#fff;color:var(--navy);padding:12px 20px;border-radius:10px}
.fb-arrow{color:var(--gold);font-size:28px}
.fb-sync p{color:#c8d6e6;margin-top:16px;font-size:15px}
.fb-tablewrap{overflow-x:auto}
.fb-cmp{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;min-width:520px}
.fb-cmp th,.fb-cmp td{padding:14px 16px;border-bottom:1px solid var(--line);text-align:left;font-size:16px}
.fb-cmp th{background:var(--navy);color:#fff}
.fb-cmp td:nth-child(3){color:var(--navy);font-weight:700}
.fb-center{text-align:center}
.fb-price{max-width:500px;margin:0 auto;text-align:center;background:#fff;border:2px solid var(--gold);border-radius:14px;padding:36px}
.fb-amt{font-size:52px;color:var(--navy);font-weight:800}
.fb-amt small{font-size:18px;color:var(--muted);font-weight:400}
.fb-price .fb-ticks{margin:20px 0 26px}
.fb details{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin-bottom:12px}
.fb summary{cursor:pointer;font-weight:700;color:var(--navy);font-size:18px}
.fb details p{margin-top:10px;color:var(--muted)}
.fb-final{background:var(--navy);color:#fff;text-align:center}
.fb-final h2{color:#fff!important}
.fb-final p{color:#c8d6e6;margin-bottom:26px}
.fb-foot{background:#08182a;color:#9fb0c4;font-size:14px;padding:30px 0}
.fb-foot a{color:#c9d6e5;text-decoration:none;margin-right:16px}
.fb-foot p{margin-top:12px}
@media (max-width:760px){.fb-nav{display:none}.fb-tally{grid-template-columns:1fr}.fb-row{flex-direction:column}.fb-arrow{transform:rotate(90deg)}}
`;
