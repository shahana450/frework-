"use client";
// The dark green page header used across FreBook: gold eyebrow, italic serif title, optional actions, summary tiles and tabs.
import Link from "next/link";
import type { ReactNode } from "react";

export const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
export const HT = { ink: "#10241F", green: "#16342D", tile: "#1F3F38", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", mint: "#8FD9B6", rose: "#F0A792", sand: "#E9C987", muted: "#6B7570" };

export type HeroTile = { label: string; value: ReactNode; sub?: ReactNode; tone?: "plain" | "good" | "bad" | "warn"; bar?: number };
export type HeroTab = { label: string; href?: string; onClick?: () => void; active?: boolean; count?: number };

const toneColor = (t?: HeroTile["tone"]) => t === "good" ? HT.mint : t === "bad" ? HT.rose : t === "warn" ? HT.sand : "#FFFFFF";

/** A pill button for the hero's action area: gold (primary) or outlined. */
export function HeroAction({ href, onClick, children, primary, disabled, title }: { href?: string; onClick?: () => void; children: ReactNode; primary?: boolean; disabled?: boolean; title?: string }) {
  const style: React.CSSProperties = { height: 48, padding: "0 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: SERIF, fontSize: 15, fontWeight: primary ? 700 : 400, textDecoration: "none", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, border: primary ? "none" : "1px solid rgba(255,255,255,0.28)", background: primary ? HT.gold : "transparent", color: primary ? HT.ink : "#FFFFFF" };
  return href ? <Link href={href} title={title} style={style}>{children}</Link> : <button type="button" onClick={onClick} disabled={disabled} title={title} style={style}>{children}</button>;
}

/** Financial-year chooser for the dark hero; the choice is shared by every tab (see lib/selectedFy). */
export function HeroFyPicker({ years, value, onChange }: { years: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  if (!years.length) return null;
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Financial year" title="Financial year"
      style={{ height: 48, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.28)", background: "transparent", color: "#FFFFFF", fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>
      {years.map(y => <option key={y.id} value={y.id} style={{ color: "#10241F" }}>FY {y.label}</option>)}
    </select>
  );
}

const SETTINGS_TABS: { key: string; label: string; href: string }[] = [
  { key: "business", label: "Business", href: "/finance/settings/business" },
  { key: "region", label: "Region & currency", href: "/finance/settings/region" },
  { key: "team", label: "Team & access", href: "/finance/team" },
  { key: "whatsapp", label: "WhatsApp", href: "/finance/whatsapp" },
  { key: "portals", label: "Portal connect", href: "/finance/portals" },
  { key: "integrations", label: "Integrations", href: "/finance/integrations" },
];
/** Header shared by every Settings page, with the same six tabs. */
export function SettingsHero({ active, eyebrow, title, sub, tiles, actions }: { active: string; eyebrow: string; title: ReactNode; sub?: ReactNode; tiles?: HeroTile[]; actions?: ReactNode }) {
  return <PageHero eyebrow={`Settings · ${eyebrow}`} title={title} sub={sub} tiles={tiles} actions={actions}
    tabs={SETTINGS_TABS.map(t => ({ label: t.label, href: t.href, active: t.key === active }))} />;
}

export default function PageHero({ eyebrow, title, accent, sub, actions, tiles, side, tabs }: {
  eyebrow: string; title: ReactNode; accent?: ReactNode; sub?: ReactNode; actions?: ReactNode;
  tiles?: HeroTile[]; side?: ReactNode; tabs?: HeroTab[];
}) {
  const cols = (tiles?.length ?? 0) + (side ? 1 : 0);
  return (
    <header style={{ background: HT.green, color: "#FFFFFF", fontFamily: SERIF }}>
      <style>{`.ph-tiles{display:grid;gap:14px;grid-template-columns:repeat(${Math.max(cols, 1)},minmax(0,1fr))}
        @media(max-width:900px){.ph-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.ph-tiles{grid-template-columns:1fr}}
        .ph-tab{height:36px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,0.28);background:transparent;color:#FFFFFF;font-family:${SERIF};font-size:14.5px;text-decoration:none;display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap}
        .ph-tab.on{background:${HT.cream};color:${HT.ink};border-color:${HT.cream}}`}</style>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 28px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.28em", color: HT.gold, textTransform: "uppercase" }}>{eyebrow}</div>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(30px,4vw,44px)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.12, textWrap: "balance" }}>{title}{accent && <> <span style={{ color: HT.sand }}>{accent}</span></>}</h1>
            {sub && <div style={{ marginTop: 8, maxWidth: 680, fontSize: 15.5, lineHeight: 1.6, color: "#D3DCD8" }}>{sub}</div>}
          </div>
          {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{actions}</div>}
        </div>
        {(tiles?.length || side) ? (
          <div className="ph-tiles">
            {tiles?.map(t => (
              <div key={t.label} style={{ background: HT.tile, borderRadius: 14, padding: "18px 20px", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "#D3DCD8" }}>{t.label}</div>
                <div style={{ fontSize: 30, lineHeight: 1.25, color: toneColor(t.tone), fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.value}</div>
                {t.bar !== undefined && <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.12)", marginTop: 10, overflow: "hidden" }}><div style={{ width: `${Math.round(Math.min(1, Math.max(0, t.bar)) * 100)}%`, height: "100%", background: HT.sand }} /></div>}
                {t.sub && <div style={{ fontSize: 13, color: "#C9D3CE", marginTop: 4 }}>{t.sub}</div>}
              </div>
            ))}
            {side && <div style={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: "18px 20px", minWidth: 0 }}>{side}</div>}
          </div>
        ) : null}
        {tabs?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tabs.map(t => t.href
              ? <Link key={t.label} href={t.href} className={"ph-tab" + (t.active ? " on" : "")}>{t.label}{t.count !== undefined ? ` · ${t.count}` : ""}</Link>
              : <button key={t.label} type="button" onClick={t.onClick} className={"ph-tab" + (t.active ? " on" : "")}>{t.label}{t.count !== undefined ? ` · ${t.count}` : ""}</button>)}
          </div>
        ) : null}
      </div>
    </header>
  );
}
