"use client";
// Month / Quarter / Financial-year picker for reconciliations. Value is a key: "2026-10", "2026-Q3" (FY 2026-27, Oct–Dec), "FY2025" (Apr 2025–Mar 2026).
export type PeriodKey = string;

const pad = (n: number) => String(n).padStart(2, "0");
export function periodMonths(key: PeriodKey): string[] {
  const fy = key.match(/^FY(\d{4})$/), q = key.match(/^(\d{4})-Q([1-4])$/);
  const from = fy ? [+fy[1], 4] : q ? [+q[1], 4 + (+q[2] - 1) * 3] : null;
  if (!from) return [key];
  const n = fy ? 12 : 3, out: string[] = [];
  for (let i = 0; i < n; i++) { const m = from[1] - 1 + i; out.push(`${from[0] + Math.floor(m / 12)}-${pad(m % 12 + 1)}`); }
  return out;
}
export const periodFrom = (k: PeriodKey) => `${periodMonths(k)[0]}-01`;
export const periodTo = (k: PeriodKey) => { const last = periodMonths(k).slice(-1)[0]; const [y, m] = last.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export function periodLabel(k: PeriodKey): string {
  const fy = k.match(/^FY(\d{4})$/), q = k.match(/^(\d{4})-Q([1-4])$/);
  if (fy) return `FY ${fy[1]}-${String(+fy[1] + 1).slice(2)}`;
  if (q) return `Q${q[2]} FY ${q[1]}-${String(+q[1] + 1).slice(2)} (${["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"][+q[2] - 1]})`;
  return new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
const fyOf = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m >= 4 ? y : y - 1; };

export default function PeriodPicker({ value, onChange, style }: { value: PeriodKey; onChange: (k: PeriodKey) => void; style?: React.CSSProperties }) {
  const kind = value.startsWith("FY") ? "fy" : value.includes("-Q") ? "q" : "m";
  const base = kind === "m" ? value : kind === "q" ? `${value.slice(0, 4)}-${pad(4 + (+value.slice(-1) - 1) * 3)}` : `${value.slice(2)}-04`;
  const nowFy = fyOf(new Date().toISOString().slice(0, 7));
  const fys = [nowFy, nowFy - 1, nowFy - 2, nowFy - 3];
  const box: React.CSSProperties = { height: 40, borderRadius: 10, border: "1px solid #E6DFD0", padding: "0 10px", fontSize: 14, fontFamily: "inherit", background: "#FFFFFF", color: "#10241F", ...style };
  const switchTo = (k: string) => {
    const fy = fyOf(base);
    if (k === "m") onChange(base);
    else if (k === "q") { const m = +base.slice(5); onChange(`${fy}-Q${m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4}`); }
    else onChange(`FY${fy}`);
  };
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select aria-label="Period type" value={kind} onChange={e => switchTo(e.target.value)} style={box}>
        <option value="m">Month</option><option value="q">Quarter</option><option value="fy">Financial year</option>
      </select>
      {kind === "m" && <input type="month" aria-label="Month" value={value} onChange={e => e.target.value && onChange(e.target.value)} style={box} />}
      {kind === "q" && <select aria-label="Quarter" value={value} onChange={e => onChange(e.target.value)} style={box}>
        {fys.flatMap(f => [1, 2, 3, 4].map(n => `${f}-Q${n}`)).map(k => <option key={k} value={k}>{periodLabel(k)}</option>)}
      </select>}
      {kind === "fy" && <select aria-label="Financial year" value={value} onChange={e => onChange(e.target.value)} style={box}>
        {fys.map(f => <option key={f} value={`FY${f}`}>{periodLabel(`FY${f}`)}</option>)}
      </select>}
    </span>
  );
}
