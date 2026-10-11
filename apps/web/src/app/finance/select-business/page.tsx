"use client";
import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { setActiveBusiness } from "@/lib/activeBusiness";

type Business = {
  id: string;
  name: string;
  legal_name: string | null;
  gstin: string | null;
  business_type: string | null;
  is_active: boolean;
};

const TYPE_COLORS: Record<string, [string, string, string]> = {
  "Proprietorship":  ["#8A5A00", "rgba(184,120,0,0.12)", "🏪"],
  "Partnership":     ["#1F5EFF", "rgba(31,94,255,0.12)",  "🤝"],
  "LLP":             ["#6366F1", "rgba(99,102,241,0.12)",  "⚖️"],
  "Private Limited": ["#0B7A55", "rgba(11,122,85,0.12)", "🏢"],
  "Public Limited":  ["#D4A843", "rgba(212,168,67,0.12)", "🏛️"],
  "Trust":           ["#EC4899", "rgba(236,72,153,0.12)",  "🏥"],
  "HUF":             ["#F97316", "rgba(249,115,22,0.12)",  "👨‍👩‍👧"],
};

export default function SelectBusinessPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);

      // is_test arrives with 2026-10-26_p5_small.sql; older databases fall back to the plain list
      let { data, error } = await supabase.from("fw_fin_businesses").select("id,name,legal_name,gstin,business_type,is_active,is_test").eq("owner_id", user.id).order("created_at");
      if (error) ({ data } = await supabase.from("fw_fin_businesses").select("id,name,legal_name,gstin,business_type,is_active").eq("owner_id", user.id).order("created_at") as unknown as { data: typeof data; error: null });

      if (!data || data.length === 0) {
        router.replace("/finance/setup");
        return;
      }
      if (data.length === 1) {
        setActiveBusiness(user.id, data[0].id);
        router.replace("/finance");
        return;
      }
      setBusinesses(data as Business[]);
      setLoading(false);
    });
  }, [router]);

  function enter(biz: Business) {
    if (!userId) return;
    setSelecting(biz.id);
    setActiveBusiness(userId, biz.id);
    router.replace("/finance");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #FFFFFF", borderTopColor: "#1F5EFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .biz-card { background: #FFFFFF; border: 1px solid #FFFFFF; border-radius: 16px; padding: 1.4rem 1.5rem; cursor: pointer; transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s; display: flex; align-items: center; gap: 1.1rem; }
        .biz-card:hover { border-color: #232A63; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(37,99,235,0.12); }
        .biz-card:active { transform: translateY(0); }
        .enter-btn { background: #232A63; color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-family: inherit; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; }
        .enter-btn:hover { opacity: 0.85; }
        .enter-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .bg-dots { background-image: radial-gradient(circle, rgba(31,94,255,0.06) 1px, transparent 1px); background-size: 28px 28px; }
      `}</style>

      {/* Background grid */}
      <div className="bg-dots" style={{ position: "fixed", inset: 0, pointerEvents: "none" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 560 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🛩️</div>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Select a Business</h1>
          <p style={{ margin: 0, color: "#5A6080", fontSize: "0.9rem" }}>You have {businesses.length} businesses. Choose one to continue.</p>
        </div>

        {/* Business cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[...businesses].sort((a, b) => Number(!!(a as { is_test?: boolean }).is_test) - Number(!!(b as { is_test?: boolean }).is_test)).map((biz, i, all) => {
            const test = !!(biz as { is_test?: boolean }).is_test, firstTest = test && !(all[i - 1] as { is_test?: boolean } | undefined)?.is_test;
            const btype = biz.business_type ?? "Proprietorship";
            const [color, bg, icon] = TYPE_COLORS[btype] ?? ["#7A93B4", "rgba(122,147,180,0.1)", "🏢"];
            const isSelecting = selecting === biz.id;

            return (
              <Fragment key={biz.id}>
              {firstTest && <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A5A00", margin: "0.5rem 0 0" }}>Test companies</div>}
              <div className="biz-card" onClick={() => enter(biz)} style={{ borderColor: isSelecting ? "#232A63" : undefined, background: isSelecting ? "rgba(37,99,235,0.06)" : undefined }}>
                {/* Icon */}
                <div style={{ width: 48, height: 48, borderRadius: 13, background: bg, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>{icon}</div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{biz.name}</div>
                  {biz.legal_name && biz.legal_name !== biz.name && (
                    <div style={{ fontSize: "0.72rem", color: "#5A6080", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.2rem" }}>{biz.legal_name}</div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 20 }}>{btype}</span>
                    {biz.gstin && <span style={{ fontSize: "0.62rem", color: "#C9CEDF", fontFamily: "monospace" }}>GST: {biz.gstin}</span>}
                    {!biz.is_active && <span style={{ fontSize: "0.62rem", color: "#C2321F", background: "rgba(194,50,31,0.1)", padding: "2px 7px", borderRadius: 20 }}>Inactive</span>}
                  </div>
                </div>

                {/* Enter button */}
                <button className="enter-btn" disabled={!!selecting} onClick={e => { e.stopPropagation(); enter(biz); }}>
                  {isSelecting ? "Opening…" : "Enter →"}
                </button>
              </div>
              </Fragment>
            );
          })}
        </div>

        {/* Add new business */}
        <div style={{ textAlign: "center" }}>
          <Link href="/finance/setup" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#1F5EFF", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none", padding: "8px 20px", border: "1px dashed #FFFFFF", borderRadius: 10, transition: "border-color 0.2s" }}>
            + Add New Business
          </Link>
        </div>

        {/* Sign out */}
        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }} style={{ background: "none", border: "none", color: "#C9CEDF", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
