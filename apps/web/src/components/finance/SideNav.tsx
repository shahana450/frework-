"use client";
// The open (wide) finance menu: brand + quick create, the business card, four big tiles for the main places,
// each menu group in its own glass card, and Accountant view at the bottom. The narrow rail stays in layout.tsx.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FINANCE_NAV, isActive, type NavItem } from "@/lib/financeNav";
import { navIconPath } from "@/lib/navIcons";

const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const TILES = ["/finance", "/finance/chat-book", "/finance/inbox", "/finance/portfolio"];
const HIDE_IN_GROUPS = ["/finance/sales/new", "/finance/purchases/new"];   // in the + menu instead
const RENAME: Record<string, string> = { "Credit Note": "Credit Notes", "Debit Note": "Debit Notes", "New Bill": "Bills" };

export default function SideNav({ pathname, search, accountant, onToggleMode, india, hide, bizName, tally, reviewCount, onCollapse, onPrefetch, logo }: {
  pathname: string | null; search: string; accountant: boolean; onToggleMode: () => void; india: boolean;
  hide: (i: NavItem) => boolean;   // view-only and similar filters from the layout
  bizName: string; tally: { connected: boolean; word: string; company: string | null; error: boolean };
  reviewCount: number; onCollapse: () => void; onPrefetch: (href: string) => void; logo?: { src: string; name: string; tagline: string } | null;
}) {
  const [plus, setPlus] = useState(false);
  const plusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!plus) return;
    const off = (e: MouseEvent) => { if (!plusRef.current?.contains(e.target as Node)) setPlus(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPlus(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [plus]);

  const visible = (i: NavItem) => (accountant || !i.accountant) && (india || !i.india) && !hide(i);
  const top = FINANCE_NAV[0].items.filter(visible);
  const tiles = TILES.map(h => top.find(i => i.href === h)).filter(Boolean) as NavItem[];
  const wide = top.filter(i => !TILES.includes(i.href));
  const initials = bizName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "··";
  const icon = (href: string, size = 19) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={navIconPath(href)} /></svg>;
  const link = (i: NavItem, cls: string, children: React.ReactNode) => {
    const on = isActive(i, pathname ?? "", search);
    return <Link key={i.href} href={i.href} prefetch={false} className={`${cls}${on ? " on" : ""}`} aria-current={on ? "page" : undefined} title={i.label}
      onPointerDown={() => onPrefetch(i.href)} onMouseEnter={() => onPrefetch(i.href)}>{children}</Link>;
  };

  return (
    <div className="sn">
      <style>{CSS}</style>
      <div className="sn-top">
        <Link href="/finance" className="sn-brand" aria-label="FreBook home">
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo.src} alt="" className="sn-logo-img" />
            : <span className="sn-logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h5a2 2 0 012 2v14a2 2 0 00-2-2H5zM19 4h-5a2 2 0 00-2 2v14a2 2 0 012-2h5z" /></svg></span>}
          <span style={{ minWidth: 0 }}><b>{logo?.name ?? "FreBook"}</b><i>{logo?.tagline ?? "Chat in. Books out."}</i></span>
        </Link>
        <div ref={plusRef} style={{ position: "relative" }}>
          <button className="sn-plus" aria-label="Create new" aria-expanded={plus} onClick={() => setPlus(p => !p)}>+</button>
          {plus && (
            <div className="sn-menu" role="menu">
              {[["/finance/chat-book", "Record with FreBook AI"], ["/finance/sales/new", "New invoice"], ["/finance/purchases/new", "New bill"], ["/finance/expenses", "Expense"], ["/finance/payment", "Payment / receipt"], ["/finance/journals/new", "Journal entry"], ["/finance/banking/import", "Import bank statement"]].map(([h, l]) => (
                <Link key={h} href={h} role="menuitem" onClick={() => setPlus(false)}>{icon(h, 17)}{l}</Link>
              ))}
            </div>
          )}
        </div>
        <button className="sn-col" onClick={onCollapse} aria-label="Collapse menu" title="Collapse menu">←</button>
      </div>

      <Link href="/finance/select-business" className="sn-biz" title={`${bizName} — switch business`}>
        <span className="sn-ini">{initials}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b>{bizName || "Choose a business"}</b>
          <span className="sn-tally"><span aria-hidden="true" style={{ background: tally.connected ? "#5BD39B" : tally.error ? "#F3A58F" : "#E5B85C" }} />Tally {tally.word.toLowerCase()}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </Link>

      <nav aria-label="Finance" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="sn-tiles">
          {tiles.map(i => link(i, "sn-tile", <><span className="sn-tic">{icon(i.href, 20)}</span><span>{i.label}</span></>))}
        </div>
        {wide.map(i => link(i, "sn-wide", <><span className="sn-tic">{icon(i.href, 20)}</span><span style={{ flex: 1 }}>{i.label}</span><span aria-hidden="true">→</span></>))}

        {FINANCE_NAV.slice(1).map(g => {
          const items = g.items.filter(i => visible(i) && !HIDE_IN_GROUPS.includes(i.href));
          if (!items.length) return null;
          return (
            <div key={g.label} className="sn-group">
              <div className="sn-gl">{g.label}</div>
              {items.map(i => {
                const badge = i.badge === "review" && reviewCount > 0 ? reviewCount : 0;
                return link(i, "sn-row", <><span className="sn-ric">{icon(i.href)}</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{RENAME[i.label] ?? i.label}</span>{badge > 0 && <span className="sn-badge">{badge}</span>}</>);
              })}
            </div>
          );
        })}
      </nav>

      <div className="sn-bottom">
        <button className="sn-mode" onClick={onToggleMode} role="switch" aria-checked={accountant} title="Accountant view shows journal, ledger, trial balance and other advanced pages">
          <span>{accountant ? "Accountant view" : "Simple view"}</span>
          <span className={"sn-sw" + (accountant ? " on" : "")}><span /></span>
        </button>
        <Link href="/dashboard" className="sn-main">← Main dashboard</Link>
      </div>
    </div>
  );
}

const CSS = `
.sn{display:flex;flex-direction:column;gap:16px;padding:20px 16px 18px;min-height:100%;box-sizing:border-box;color:#FFFFFF;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.sn-top{display:flex;align-items:center;gap:10px}
.sn-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#FFFFFF;flex:1;min-width:0}
.sn-brand b{display:block;font-family:${SERIF};font-size:24px;line-height:1.05;font-weight:700}
.sn-brand i{display:block;font-family:${SERIF};font-size:13.5px;color:#C9D3CE;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sn-logo{width:50px;height:50px;flex-shrink:0;border-radius:14px;display:grid;place-items:center;background:linear-gradient(150deg,#F0D392,#D2A85A);color:#12352D;box-shadow:0 10px 22px -12px rgba(0,0,0,.6)}
.sn-logo-img{width:50px;height:50px;object-fit:cover;border-radius:14px;background:#FFFFFF;flex-shrink:0}
.sn-plus{width:46px;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#E9C27A;font-size:26px;line-height:1;cursor:pointer;display:grid;place-items:center}
.sn-plus:hover{background:rgba(255,255,255,.14)}
.sn-col{width:28px;height:28px;border:none;background:none;color:#8FA39B;cursor:pointer;font-size:15px;padding:0}
.sn-col:hover{color:#E9C27A}
.sn-menu{position:absolute;top:52px;right:0;z-index:80;width:250px;padding:8px;border-radius:16px;background:#FFFDF8;box-shadow:0 24px 50px -18px rgba(0,0,0,.6);display:flex;flex-direction:column}
.sn-menu a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:#10241F;text-decoration:none;font-size:14.5px}
.sn-menu a:hover,.sn-menu a:focus-visible{background:#F4EEE2;outline:none}
.sn-menu a svg{color:#9A6B22}
.sn-biz{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:20px;text-decoration:none;color:#FFFFFF;background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.sn-biz:hover{border-color:rgba(233,194,122,.5)}
.sn-biz b{display:block;font-size:15.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sn-biz>svg{color:#C9D3CE;flex-shrink:0}
.sn-ini{width:46px;height:46px;flex-shrink:0;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.1);font-weight:800;font-size:15px}
.sn-tally{display:flex;align-items:center;gap:6px;font-size:13.5px;color:#F3B8A6;margin-top:2px}
.sn-tally span{width:8px;height:8px;border-radius:50%}
.sn-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sn-tile{display:flex;flex-direction:column;gap:14px;padding:14px;border-radius:20px;text-decoration:none;color:#FFFFFF;font-size:15px;font-weight:700;background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.10);transition:transform .15s,border-color .15s}
.sn-tile:hover{transform:translateY(-1px);border-color:rgba(233,194,122,.45)}
.sn-tile span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sn-tic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.10);color:#FFFFFF}
.sn-tile.on{background:#FFFDF8;color:#10241F;border-color:#FFFDF8}
.sn-tile.on .sn-tic{background:#12352D;color:#E9C27A}
.sn-wide{display:flex;align-items:center;gap:14px;padding:12px 16px 12px 12px;border-radius:20px;text-decoration:none;color:#FFFFFF;font-size:15px;font-weight:700;background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.12)}
.sn-wide>span:last-child{color:#C9D3CE}
.sn-wide.on{background:#FFFDF8;color:#10241F}.sn-wide.on .sn-tic{background:#12352D;color:#E9C27A}
.sn-group{display:flex;flex-direction:column;gap:2px;padding:14px 10px 10px;border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.10)}
.sn-gl{font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#B9C7C1;padding:0 10px 6px}
.sn-row{display:flex;align-items:center;gap:14px;padding:10px 10px;border-radius:12px;text-decoration:none;color:#EEF2F0;font-size:15px;font-weight:600}
.sn-row:hover{background:rgba(255,255,255,.07)}
.sn-row.on{background:#FFFDF8;color:#10241F}
.sn-row.on .sn-ric{color:#9A6B22}
.sn-ric{width:22px;display:grid;place-items:center;color:#DCE6E2;flex-shrink:0}
.sn-badge{background:#E9C27A;color:#10241F;font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px}
.sn-bottom{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding-top:8px}
.sn-mode{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03));color:#FFFFFF;font:inherit;font-size:15.5px;font-weight:700;cursor:pointer}
.sn-sw{width:46px;height:26px;border-radius:999px;background:rgba(255,255,255,.2);position:relative;flex-shrink:0;transition:background .15s}
.sn-sw span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#FFFFFF;transition:left .15s}
.sn-sw.on{background:#E9C27A}.sn-sw.on span{left:23px;background:#12352D}
.sn-main{font-size:13px;color:#8FA39B;text-decoration:none;text-align:center}
.sn-main:hover{color:#E9C27A}
.sn a:focus-visible,.sn button:focus-visible{outline:2px solid #E9C27A;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.sn-tile{transition:none}}
`;
