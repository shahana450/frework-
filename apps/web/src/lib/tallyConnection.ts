"use client";
// The one Tally connection for the whole app. Every page reads it; only the Tally page changes the port or company.
// Once connected it stays connected — across pages, tabs and reloads — until you press Disconnect or Tally really
// closes (two failed checks in a row, so one slow reply never drops it).
// B5: the link is PER BUSINESS. Company, session and the Disconnect flag are stored under the active business, so a
// business never shows (or pushes to) another business's Tally company. The port is per computer.
import { useEffect, useState } from "react";
import { tallyFetch } from "./tallyUtils";
import { companiesXml, companiesFrom, licenseXml, isEducational, tallyProblem } from "./integrations/tally";

export type TallyState = {
  port: string;
  company: string;            // the Tally company FreWork pushes into / imports from
  companies: string[];        // companies open in Tally right now
  status: "idle" | "connecting" | "connected" | "error";
  message: string;
  educational: boolean;       // unlicensed Tally: only accepts dates on the 1st, 2nd and 31st
  checkedAt: number;
};

const SAVED = "fw_tally_session";           // last known connection, shared by every tab
const OFF = "fw_tally_off";                  // set by Disconnect; cleared by Connect
let biz = "";                                 // active FreWork business (set by the finance layout)
const key = (base: string) => (biz ? `${base}:${biz}` : base);
const COMPANY = "fw_tally_company";
const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* */ } };

/** What Tally answered when it gave no company name (shown on the Tally page to diagnose). */
export let lastReply = "";
let state: TallyState = { port: "7001", company: "", companies: [], status: "idle", message: "", educational: false, checkedAt: 0 };
let loaded = false;
let misses = 0;
const listeners = new Set<(s: TallyState) => void>();
const set = (patch: Partial<TallyState>, persist = true) => {
  state = { ...state, ...patch };
  if (persist) write(key(SAVED), JSON.stringify({ status: state.status === "connected" ? "connected" : "off", companies: state.companies, educational: state.educational, checkedAt: state.checkedAt }));
  listeners.forEach(l => l(state));
};
export const tallyUrl = () => `http://localhost:${state.port}`;
export const tallyManuallyOff = () => read(key(OFF), "") === "1";
// Auto-push: every entry posted in FreBook is sent to Tally straight away (per business, on this computer)
const AUTO = "fw_tally_autopush";
// Keyed by the business explicitly (the shared `biz` may not be set yet when a page first renders)
const autoRaw = (bizId: string) => read(`${AUTO}:${bizId}`, "") || read(AUTO, "");
export const tallyAutoPushOn = (bizId: string) => !!bizId && autoRaw(bizId) !== "";
export const setTallyAutoPush = (bizId: string, on: boolean) => { write(`${AUTO}:${bizId}`, on ? new Date().toISOString() : null); write(AUTO, null); };
/** When auto-push was switched on — entries posted after this (e.g. from WhatsApp) are caught up. Older flags: last 24 h. */
export const tallyAutoPushSince = (bizId: string) => { const v = autoRaw(bizId); return !v || v === "1" ? new Date(Date.now() - 86400000).toISOString() : v; };

function restore() {
  try {
    const s = JSON.parse(read(key(SAVED), "{}"));
    // Still connected from before (another page, tab or a reload) — show it straight away, then confirm quietly
    if (s.status === "connected" && !tallyManuallyOff()) return { status: "connecting" as const, companies: s.companies ?? [], educational: !!s.educational, checkedAt: s.checkedAt ?? 0, message: "Checking Tally…" };
  } catch { /* */ }
  return {};
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = { ...state, port: read("fw_tally_port", "7001"), company: read(key(COMPANY), ""), ...restore() };
  // Another tab connected, disconnected, or changed the port/company
  window.addEventListener("storage", e => {
    if (e.key === "fw_tally_port" && e.newValue) set({ port: e.newValue }, false);
    if (e.key === key(COMPANY)) set({ company: e.newValue ?? "" }, false);
    if (e.key === key(SAVED) || e.key === key(OFF)) { const r = restore(); set(r.status ? r : { status: "idle", message: tallyManuallyOff() ? "Disconnected" : "" }, false); }
  });
}

/** Asks Tally which companies are open. Picks the saved company, else one matching the business name, else the first. */
export async function connectTally(opts: { port?: string; preferName?: string; quiet?: boolean } = {}): Promise<TallyState> {
  load();
  if (!opts.quiet) write(key(OFF), null);                       // an explicit Connect turns it back on
  if (opts.quiet && tallyManuallyOff()) return state;       // stay off until the user connects again
  const port = (opts.port ?? state.port).replace(/\D/g, "") || "7001";
  if (!opts.quiet) set({ status: "connecting", message: "" }, false);
  try {
    const res = await tallyFetch(`http://localhost:${port}`, companiesXml(), 8000);
    // The bridge answers 502 when Tally isn't on this port — never call that "connected"
    if (!res.ok) throw new Error(res.status === 502 ? tallyProblem(port, "bridge502") : tallyProblem(port, "http", res.status));
    const first = await res.text();
    let names = companiesFrom(first);
    let raw = first;
    // Some Tally versions answer the collection without names: ask the "List of Companies" report instead
    if (!names.length) {
      try {
        const r2 = await tallyFetch(`http://localhost:${port}`, `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`, 8000);
        raw = await r2.text();
        names = companiesFrom(raw);
        if (!names.length) names = [...raw.matchAll(/<(?:COMPANYNAME|SVCURRENTCOMPANY|NAME)\b[^>]*>([^<]{2,})</gi)].map(m => m[1].trim()).filter((v, i, a) => v && a.indexOf(v) === i);
      } catch { /* keep none */ }
    }
    if (!names.length && typeof console !== "undefined") console.warn("[FreBook] Tally gave no company name. Reply:", first.slice(0, 1500), raw === first ? "" : raw.slice(0, 1500));
    lastReply = names.length ? "" : (raw || first).replace(/\s+/g, " ").slice(0, 400);
    const pick = names.includes(state.company) ? state.company
      : names.find(n => opts.preferName && n.toLowerCase() === opts.preferName.toLowerCase()) ?? names[0] ?? state.company;
    write("fw_tally_port", port);
    if (pick) { write(key(COMPANY), pick); if (pick !== state.company || !opts.quiet) linkOnServer(pick); }
    let educational = state.educational;
    try { educational = isEducational(await (await tallyFetch(`http://localhost:${port}`, licenseXml(), 8000)).text()); } catch { /* keep last */ }
    misses = 0;
    set({ port, companies: names, company: pick, status: "connected", educational, checkedAt: Date.now(),
      message: names.length ? `${names.length} compan${names.length === 1 ? "y" : "ies"} open in Tally` : `Connected, but Tally sent no company name — open your company in Tally (Gateway → Select Company) and press Reconnect.${lastReply ? ` Tally replied: ${lastReply}` : ""}` });
  } catch (e) {
    misses++;
    // A background check needs two misses in a row before calling Tally closed
    if (opts.quiet && state.status === "connected" && misses < 2) return state;
    set({ port, status: "error", checkedAt: Date.now(), message: e instanceof Error && /port \d+/.test(e.message) ? e.message : tallyProblem(port, "unreachable") });
  }
  return state;
}

/** Disconnect: stays disconnected on every page and tab until Connect is pressed again. */
export function disconnectTally() {
  load(); write(key(OFF), "1"); misses = 0;
  set({ status: "idle", companies: [], message: "Disconnected" });
}

/** Choose the Tally company (Tally page only). */
export function chooseTallyCompany(name: string) { load(); write(key(COMPANY), name); set({ company: name }, false); if (name) linkOnServer(name); }

/** Saves which Tally company this business pushes to, so the server can refuse a push to any other company. */
function linkOnServer(company: string) {
  if (!biz || typeof window === "undefined") return;
  fetch("/api/finance/tally-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: biz, company, port: state.port }) }).catch(() => { /* retried on next connect */ });
}

/** Called by the finance layout whenever the active business changes: every Tally surface follows it. */
export function setTallyBusiness(id: string) {
  if (!id || id === biz) return;
  biz = id; loaded = true; misses = 0;
  const company = read(key(COMPANY), "");
  state = { ...state, port: read("fw_tally_port", "7001"), company, companies: [], status: "idle", message: "", educational: false, checkedAt: 0, ...(company ? restore() : {}) };
  listeners.forEach(l => l(state));
  if (company && !tallyManuallyOff()) connectTally({ quiet: true });
}
export const tallyBusiness = () => biz;
/** Short Tally status with the company name, e.g. "Tally · ABC Traders". */
export function tallyLabel(t: Pick<TallyState, "status" | "company" | "companies">): string {
  if (t.status === "connected") return t.company ? `Tally · ${t.company}` : t.companies.length ? "Tally · choose company" : "Tally · no company open";
  if (t.status === "connecting") return `Tally · connecting${t.company ? ` to ${t.company}` : "…"}`;
  return t.company ? `Tally off · ${t.company}` : "Tally · not connected";
}

/** The Tally company linked to the active business (read this, never the old device-wide key). */
export const tallyCompanyNow = () => { load(); return state.company; };
/** Change the port (Tally page only). */
export function setTallyPort(port: string) { load(); const p = port.replace(/\D/g, "") || "7001"; write("fw_tally_port", p); set({ port: p }, false); }

// One quiet check a minute for the whole app (and when you come back to the tab) — never while disconnected
let timer: ReturnType<typeof setInterval> | null = null;
function startWatch() {
  if (timer || typeof window === "undefined") return;
  const tick = () => { if (listeners.size && state.company && !tallyManuallyOff() && document.visibilityState === "visible") connectTally({ quiet: true }); };
  timer = setInterval(tick, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - state.checkedAt > 30000) tick(); });
}

export function useTally(opts: { autoConnect?: boolean } = {}): TallyState {
  load();
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS); setS(state); startWatch();
    // Reconnect quietly when this device was connected before (unless you disconnected)
    if (opts.autoConnect !== false && state.company && !tallyManuallyOff() && (state.status === "idle" || Date.now() - state.checkedAt > 60000)) connectTally({ quiet: true });
    return () => { listeners.delete(setS); };
  }, [opts.autoConnect]);
  return s;
}
