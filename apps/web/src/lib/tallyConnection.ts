"use client";
// The one Tally connection for the whole app. Every page reads it; only the Tally page changes the port or company.
// Once connected it stays connected — across pages, tabs and reloads — until you press Disconnect or Tally really
// closes (two failed checks in a row, so one slow reply never drops it).
import { useEffect, useState } from "react";
import { tallyFetch } from "./tallyUtils";
import { companiesXml, companiesFrom, licenseXml, isEducational } from "./integrations/tally";

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
const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* */ } };

let state: TallyState = { port: "7001", company: "", companies: [], status: "idle", message: "", educational: false, checkedAt: 0 };
let loaded = false;
let misses = 0;
const listeners = new Set<(s: TallyState) => void>();
const set = (patch: Partial<TallyState>, persist = true) => {
  state = { ...state, ...patch };
  if (persist) write(SAVED, JSON.stringify({ status: state.status === "connected" ? "connected" : "off", companies: state.companies, educational: state.educational, checkedAt: state.checkedAt }));
  listeners.forEach(l => l(state));
};
export const tallyUrl = () => `http://localhost:${state.port}`;
export const tallyManuallyOff = () => read(OFF, "") === "1";

function restore() {
  try {
    const s = JSON.parse(read(SAVED, "{}"));
    // Still connected from before (another page, tab or a reload) — show it straight away, then confirm quietly
    if (s.status === "connected" && !tallyManuallyOff()) return { status: "connected" as const, companies: s.companies ?? [], educational: !!s.educational, checkedAt: s.checkedAt ?? 0, message: "Connected to Tally" };
  } catch { /* */ }
  return {};
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = { ...state, port: read("fw_tally_port", "7001"), company: read("fw_tally_company", ""), ...restore() };
  // Another tab connected, disconnected, or changed the port/company
  window.addEventListener("storage", e => {
    if (e.key === "fw_tally_port" && e.newValue) set({ port: e.newValue }, false);
    if (e.key === "fw_tally_company") set({ company: e.newValue ?? "" }, false);
    if (e.key === SAVED || e.key === OFF) { const r = restore(); set(r.status ? r : { status: "idle", message: tallyManuallyOff() ? "Disconnected" : "" }, false); }
  });
}

/** Asks Tally which companies are open. Picks the saved company, else one matching the business name, else the first. */
export async function connectTally(opts: { port?: string; preferName?: string; quiet?: boolean } = {}): Promise<TallyState> {
  load();
  if (!opts.quiet) write(OFF, null);                       // an explicit Connect turns it back on
  if (opts.quiet && tallyManuallyOff()) return state;       // stay off until the user connects again
  const port = (opts.port ?? state.port).replace(/\D/g, "") || "7001";
  if (!opts.quiet) set({ status: "connecting", message: "" }, false);
  try {
    const res = await tallyFetch(`http://localhost:${port}`, companiesXml(), 8000);
    const names = companiesFrom(await res.text());
    const pick = names.includes(state.company) ? state.company
      : names.find(n => opts.preferName && n.toLowerCase() === opts.preferName.toLowerCase()) ?? names[0] ?? state.company;
    write("fw_tally_port", port);
    if (pick) write("fw_tally_company", pick);
    let educational = state.educational;
    try { educational = isEducational(await (await tallyFetch(`http://localhost:${port}`, licenseXml(), 8000)).text()); } catch { /* keep last */ }
    misses = 0;
    set({ port, companies: names, company: pick, status: "connected", educational, checkedAt: Date.now(),
      message: names.length ? `${names.length} compan${names.length === 1 ? "y" : "ies"} open in Tally` : "Connected to Tally" });
  } catch (e) {
    misses++;
    // A background check needs two misses in a row before calling Tally closed
    if (opts.quiet && state.status === "connected" && misses < 2) return state;
    set({ port, status: "error", checkedAt: Date.now(), message: e instanceof Error ? e.message : "Tally isn't responding — is it still open?" });
  }
  return state;
}

/** Disconnect: stays disconnected on every page and tab until Connect is pressed again. */
export function disconnectTally() {
  load(); write(OFF, "1"); misses = 0;
  set({ status: "idle", companies: [], message: "Disconnected" });
}

/** Choose the Tally company (Tally page only). */
export function chooseTallyCompany(name: string) { load(); write("fw_tally_company", name); set({ company: name }, false); }
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
