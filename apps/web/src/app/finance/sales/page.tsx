"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";

type Invoice = { id: string; entry_no: string; date: string; narration: string; total_credit: number; status: string; contact_id: string | null };
type Contact = { id: string; name: string };

export default function SalesListPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "posted" | "draft">("all");
  const [search, setSearch] = useState("");
  const [bizName, setBizName] = useState("");

  const [totals, setTotals] = useState({ count: 0, total: 0, posted: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      supabase.from("fw_fin_businesses").select("name").eq("id", saved).maybeSingle().then(({ data }) => setBizName(data?.name ?? ""));

      const [invoicesRes, contactsRes] = await Promise.all([
        supabase.from("fw_fin_journals").select("id,entry_no,date,narration,total_credit,status,contact_id").eq("business_id", saved).eq("type", "sales").order("date", { ascending: false }),
        supabase.from("fw_fin_contacts").select("id,name").eq("business_id", saved),
      ]);

      const inv = (invoicesRes.data ?? []) as Invoice[];
      setInvoices(inv);
      const cMap: Record<string, string> = {};
      ((contactsRes.data ?? []) as Contact[]).forEach(c => { cMap[c.id] = c.name; });
      setContacts(cMap);
      setTotals({
        count: inv.length,
        total: inv.reduce((s, i) => s + i.total_credit, 0),
        posted: inv.filter(i => i.status === "posted").reduce((s, i) => s + i.total_credit, 0),
      });
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter(i => {
    if (filter !== "all" && i.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.entry_no?.toLowerCase().includes(q) || i.narration?.toLowerCase().includes(q) || contacts[i.contact_id ?? ""]?.toLowerCase().includes(q);
    }
    return true;
  });

  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });
  const statusColor = (s: string) => s === "posted" ? "#0B7A55" : s === "draft" ? "#232A63" : "rgba(20,26,58,0.65)";

  const T = HT;
  const counts = { all: invoices.length, posted: invoices.filter(i => i.status === "posted").length, draft: invoices.filter(i => i.status === "draft").length };
  const pill = (on: boolean): React.CSSProperties => ({ height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${on ? T.green : T.line}`, background: on ? T.green : T.paper, color: on ? "#FFFFFF" : T.ink, fontFamily: SERIF, fontSize: 15, cursor: "pointer" });

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SERIF }}>
      <PageHero eyebrow={`Sales${bizName ? ` · ${bizName}` : ""}`} title="Sales invoices"
        actions={<><HeroAction href="/finance/chat-book">✦ Chat entry</HeroAction><HeroAction href="/finance/sales/new" primary>+ New invoice</HeroAction></>}
        tiles={[
          { label: "Total invoices", value: loading ? "—" : totals.count },
          { label: "Total billed", value: `${cur()}${fmt(totals.total)}` },
          { label: "Posted to books", value: `${cur()}${fmt(totals.posted)}`, tone: "good" },
        ]} />

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {(["all", "posted", "draft"] as const).map(f => <button key={f} onClick={() => setFilter(f)} style={pill(filter === f)}>{f[0].toUpperCase() + f.slice(1)} {counts[f]}</button>)}
          <span style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice no., customer…"
            style={{ width: 340, maxWidth: "100%", height: 42, borderRadius: 999, border: `1px solid ${T.line}`, background: T.paper, padding: "0 18px", fontFamily: SERIF, fontSize: 15, color: T.ink, outline: "none" }} />
        </div>

        <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden" }}>
          {loading ? <div style={{ padding: "3rem", textAlign: "center", color: T.muted, fontStyle: "italic" }}>Loading…</div>
            : invoices.length === 0 ? (
              <>
                <div style={{ padding: "34px 24px 26px", textAlign: "center", borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 26, fontStyle: "italic" }}>No sales invoices yet</div>
                  <div style={{ color: "#4A5651", marginTop: 4 }}>Your first GST invoice is three ways away — each lands in your books and GSTR-1.</div>
                </div>
                {[
                  { t: "Fill the invoice form", d: "Customer, items, HSN and GST — totals worked out for you.", href: "/finance/sales/new" },
                  { t: "Say it on WhatsApp", d: <><i>“Invoice ABC Traders 30,000 + GST”</i> — reply YES to post.</>, href: "/finance/whatsapp" },
                  { t: "Upload invoices you raised elsewhere", d: "Read and suggested for your review.", href: "/finance/upload" },
                ].map((s, i) => (
                  <Link key={s.t} href={s.href} style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 24px", borderTop: i ? `1px solid ${T.line}` : undefined, color: T.ink, textDecoration: "none" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${T.gold}`, color: T.goldInk, display: "grid", placeItems: "center", flexShrink: 0 }}>{i + 1}</span>
                    <span><span style={{ display: "block", fontSize: 17 }}>{s.t}</span><span style={{ fontSize: 14, color: "#4A5651" }}>{s.d}</span></span>
                  </Link>
                ))}
              </>
            ) : filtered.length === 0 ? <div style={{ padding: "3rem", textAlign: "center", color: T.muted, fontStyle: "italic" }}>No invoices match.</div>
            : (
              <>
                {filtered.map((inv, i) => (
                  <Link key={inv.id} href={`/finance/invoices/${inv.id}`} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", borderTop: i ? `1px solid ${T.line}` : undefined, color: T.ink, textDecoration: "none" }}>
                    <span style={{ width: 78, color: "#4A5651", flexShrink: 0 }}>{new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contacts[inv.contact_id ?? ""] ?? (inv.narration || "—")}</span>
                      <span style={{ display: "block", fontSize: 13, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.entry_no} · {inv.narration}</span>
                    </span>
                    <span style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cur()}{fmt(inv.total_credit)}</span>
                    <span style={{ width: 70, textAlign: "right", fontSize: 13, color: inv.status === "posted" ? "#0B7A55" : T.goldInk, textTransform: "capitalize" }}>{inv.status}</span>
                  </Link>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 24px", background: T.green, color: "#FFFFFF" }}>
                  <i>Total · {filtered.length} invoice{filtered.length === 1 ? "" : "s"}</i>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(filtered.reduce((s, i) => s + i.total_credit, 0))}</span>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
