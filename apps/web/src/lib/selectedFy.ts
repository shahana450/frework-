"use client";
// The financial year the person is looking at, shared by every FreBook tab (Home, Reports, MIS, Insights…).
// Kept per business on this device; changing it on one tab changes it on all.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type FyOption = { id: string; label: string; start_date: string; end_date: string };

const key = (bizId: string) => `fw_fy:${bizId}`;
const EVT = "fw-fy-change";

export function readSelectedFy(bizId: string | null | undefined): string | null {
  if (!bizId || typeof window === "undefined") return null;
  try { return localStorage.getItem(key(bizId)); } catch { return null; }
}

export function writeSelectedFy(bizId: string | null | undefined, fyId: string) {
  if (!bizId || typeof window === "undefined") return;
  try { localStorage.setItem(key(bizId), fyId); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: { bizId, fyId } }));
}

/** The saved year if it still exists, else the year containing today, else the latest. */
export function pickFy(list: FyOption[], bizId: string | null | undefined): FyOption | null {
  const saved = readSelectedFy(bizId);
  const today = new Date().toLocaleDateString("en-CA");
  return list.find(f => f.id === saved) ?? list.find(f => f.start_date <= today && f.end_date >= today) ?? list[0] ?? null;
}

/** Years of the business plus the chosen one; setFy saves the choice for every tab. */
export function useFinancialYear(bizId: string | null | undefined) {
  const [years, setYears] = useState<FyOption[]>([]);
  const [fy, setFyState] = useState<FyOption | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!bizId) return;
    let live = true;
    supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date").eq("business_id", bizId).order("start_date", { ascending: false })
      .then(({ data }) => { if (!live) return; const saved = readSelectedFy(bizId);
        // A year saved twice shows once (figures go by its dates, so either copy gives the same numbers)
        const byDates = new Map<string, FyOption>();
        for (const f of (data ?? []) as FyOption[]) { const k = f.start_date + "|" + f.end_date; if (!byDates.has(k) || f.id === saved) byDates.set(k, f); }
        const list = [...byDates.values()]; setYears(list); setFyState(pickFy(list, bizId)); setLoaded(true); });
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.bizId === bizId) setYears(list => { setFyState(y => list.find(f => f.id === d.fyId) ?? y); return list; }); };
    window.addEventListener(EVT, on);
    return () => { live = false; window.removeEventListener(EVT, on); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId]);
  const setFy = (id: string) => { const f = years.find(y => y.id === id); if (f) { setFyState(f); writeSelectedFy(bizId, id); } };
  return { years, fy, setFy, loaded };
}
