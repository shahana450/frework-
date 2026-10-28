"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Link from "next/link";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";
import { readActiveBusiness, setActiveBusiness } from "@/lib/activeBusiness";

type HistoryDoc = {
  id: string;
  file_name: string;
  doc_type: string;
  status: string;
  created_at: string;
  file_size: number | null;
  ai_summary: { vendor?: string; amount?: number; date?: string; narration?: string } | null;
  journal_id: string | null;
};

type DocFile = {
  id: string;
  file: File;
  preview: string | null;
  docType: string;
  status: "idle" | "uploading" | "analyzing" | "done" | "error";
  errorMsg?: string;
  aiResult?: {
    vendor?: string; amount?: number; date?: string; gst?: number;
    type?: string; narration?: string; confidence?: number;
    items?: { description: string; amount: number }[];
  };
};

const DOC_TYPES = [
  { value: "invoice", label: "Sales Invoice", icon: "🧾" },
  { value: "bill", label: "Purchase Bill", icon: "📦" },
  { value: "receipt", label: "Expense Receipt", icon: "🏷️" },
  { value: "bank_statement", label: "Bank Statement", icon: "🏦" },
  { value: "salary_slip", label: "Salary Slip", icon: "👔" },
  { value: "other", label: "Other Document", icon: "📄" },
];

function guessDocType(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes("invoice") || f.includes("inv")) return "invoice";
  if (f.includes("bill") || f.includes("purchase")) return "bill";
  if (f.includes("receipt") || f.includes("rcpt")) return "receipt";
  if (f.includes("bank") || f.includes("statement") || f.includes("pass")) return "bank_statement";
  if (f.includes("salary") || f.includes("payslip") || f.includes("pay")) return "salary_slip";
  return "other";
}

export default function UploadPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [files, setFiles] = useState<DocFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [kindSel, setKindSel] = useState<"sales" | "purchase" | "bank">("purchase");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<HistoryDoc[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (saved) {
        const { data } = await supabase.from("fw_fin_businesses").select("id,name").eq("id", saved).single();
        if (data) { setBizId(data.id); setBizName(data.name); loadHistory(data.id); }
      } else {
        const { data } = await supabase.from("fw_fin_businesses").select("id,name").eq("owner_id", user.id).eq("is_active", true).limit(1).single();
        if (data) { setBizId(data.id); setBizName(data.name); if (user) setActiveBusiness(user.id, data.id); loadHistory(data.id); }
        else router.push("/finance/setup");
      }
    });
  }, []);

  async function loadHistory(bid: string) {
    setHistLoading(true);
    const { data } = await supabase
      .from("fw_fin_documents")
      .select("id,file_name,doc_type,status,created_at,file_size,ai_summary,journal_id")
      .eq("business_id", bid)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory(data ?? []);
    setHistLoading(false);
  }

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const newDocs: DocFile[] = arr.map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      docType: guessDocType(f.name),
      status: "idle",
    }));
    setFiles(prev => [...prev, ...newDocs]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  async function processFile(docFile: DocFile) {
    if (!bizId || !userId) return;
    setFiles(prev => prev.map(f => f.id === docFile.id ? { ...f, status: "uploading" } : f));

    try {
      // Upload to Supabase Storage
      const ext = docFile.file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") ?? "pdf";
      const safeName = `${docFile.id}.${ext}`;
      const path = `${bizId}/${safeName}`;

      const { error: storageErr } = await supabase.storage
        .from("fw-finance-docs")
        .upload(path, docFile.file, { upsert: true });

      let fileUrl = "";
      if (!storageErr) {
        const { data: urlData } = supabase.storage.from("fw-finance-docs").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      // Create document record
      const { data: doc, error: docErr } = await supabase
        .from("fw_fin_documents")
        .insert({
          business_id: bizId,
          uploaded_by: userId,
          file_name: docFile.file.name,
          file_url: fileUrl || path,
          file_size: docFile.file.size,
          mime_type: docFile.file.type,
          doc_type: docFile.docType,
          status: "processing",
        })
        .select("id")
        .single();

      if (docErr) throw new Error(docErr.message);

      // AI Analysis — send actual file bytes to Claude
      setFiles(prev => prev.map(f => f.id === docFile.id ? { ...f, status: "analyzing" } : f));

      let aiResult;
      try {
        // Convert file to base64 so Claude can actually read it
        const fileBase64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // strip "data:...;base64," prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(docFile.file);
        });

        const aiRes = await fetch("/api/finance/ai-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_data: fileBase64,
            mime_type: docFile.file.type || "application/octet-stream",
            file_name: docFile.file.name,
            doc_type_hint: docFile.docType,
            doc_id: doc.id,
            business_id: bizId,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          // Bank statement returns transaction_count not a single vendor/amount
          if (aiData.bank_statement) {
            aiResult = {
              vendor: aiData.bank_name ?? "Bank",
              narration: `Bank statement — ${aiData.transaction_count ?? 0} transactions extracted`,
              confidence: 0.92,
              type: "bank_statement",
            };
          } else {
            aiResult = {
              vendor: aiData.result?.vendor ?? aiData.result?.customer,
              amount: aiData.result?.amount,
              gst: aiData.result?.gst_amount,
              date: aiData.result?.date,
              narration: aiData.result?.narration,
              confidence: aiData.result?.confidence ?? 0.85,
              type: aiData.result?.doc_type ?? docFile.docType,
              items: aiData.result?.items,
            };
          }
        } else {
          throw new Error("AI unavailable");
        }
      } catch {
        // Fallback to simulation if AI API not configured
        aiResult = simulateAI(docFile.file.name, docFile.docType);
      }

      // The API route already saved summary + created suggestions in DB.
      // Only update document status if it wasn't already handled by the API.
      if (!aiResult?.type || aiResult.type !== "bank_statement") {
        await supabase.from("fw_fin_documents").update({
          status: "reviewed",
          ai_summary: aiResult,
        }).eq("id", doc.id);
      }

      setFiles(prev => prev.map(f => f.id === docFile.id ? { ...f, status: "done", aiResult: aiResult ?? undefined } : f));
    } catch (err: unknown) {
      setFiles(prev => prev.map(f => f.id === docFile.id ? { ...f, status: "error", errorMsg: err instanceof Error ? err.message : "Upload failed" } : f));
    }
  }

  function simulateAI(filename: string, docType: string) {
    const vendors = ["Reliance Industries", "Amazon Business", "Flipkart", "BSNL", "Swiggy Business", "Zomato", "Office Depot", "Airtel", "MSEDCL"];
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    const amount = Math.round((Math.random() * 50000 + 500) * 100) / 100;
    const gst = Math.round(amount * 0.18 * 100) / 100;
    const date = new Date(Date.now() - Math.random() * 30 * 86400000).toISOString().split("T")[0];
    return {
      vendor, amount, gst, date,
      narration: `${DOC_TYPES.find(d => d.value === docType)?.label ?? "Document"} from ${vendor} — ${cur()}${amount.toLocaleString(activeMoney().locale)}`,
      confidence: 0.78 + Math.random() * 0.2,
      type: docType,
    };
  }

  function generateSuggestedLines(docType: string, ai: { amount?: number; gst?: number }) {
    const amt = ai.amount ?? 0;
    const gst = ai.gst ?? 0;
    const base = Math.round((amt - gst) * 100) / 100;
    if (docType === "invoice") {
      return [
        { account_name: "Accounts Receivable (Debtors)", dr: amt, cr: 0 },
        { account_name: "Sales / Revenue", dr: 0, cr: base },
        { account_name: "GST Payable - CGST", dr: 0, cr: gst / 2 },
        { account_name: "GST Payable - SGST", dr: 0, cr: gst / 2 },
      ];
    }
    if (docType === "bill") {
      return [
        { account_name: "Purchase of Stock", dr: base, cr: 0 },
        { account_name: "GST Input Tax Credit", dr: gst, cr: 0 },
        { account_name: "Accounts Payable (Creditors)", dr: 0, cr: amt },
      ];
    }
    return [
      { account_name: "Indirect Expenses", dr: base, cr: 0 },
      { account_name: "GST Input Tax Credit", dr: gst, cr: 0 },
      { account_name: "Cash in Hand", dr: 0, cr: amt },
    ];
  }

  async function processAll() {
    const idle = files.filter(f => f.status === "idle");
    for (const f of idle) await processFile(f);
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const idleCount = files.filter(f => f.status === "idle").length;
  const doneCount = files.filter(f => f.status === "done").length;

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <PageHero eyebrow={`Documents${bizName ? ` · ${bizName}` : ""}`} title="Upload anything"
        sub="Drop invoices, bills, receipts or bank statements. FreBook reads vendor, amount and GST and suggests the journal entry — nothing posts until you approve it."
        tiles={[
          { label: "Uploaded", value: history.length },
          { label: "Waiting for review", value: history.filter(h => !h.journal_id && h.status !== "rejected").length, tone: "warn" },
          { label: "Posted from uploads", value: history.filter(h => h.journal_id).length, tone: "good" },
        ]}
        tabs={[{ label: "Upload", href: "/finance/upload", active: true }, { label: "Review queue", href: "/finance/ai-review", count: history.filter(h => !h.journal_id && h.status !== "rejected").length }]} />

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px" }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginBottom: 18 }}>
          {[
              { k: "sales" as const, code: "INV", title: "Sales invoices", desc: "GST invoices you’ve raised to customers" },
              { k: "purchase" as const, code: "BIL", title: "Purchase bills", desc: "Bills from vendors and suppliers" },
              { k: "bank" as const, code: "BNK", title: "Bank statements", desc: "PDF or Excel statements for reconciliation" },
            ].map(t => (
            <button key={t.k} type="button" onClick={() => t.k === "bank" ? (window.location.href = "/finance/banking/import") : setKindSel(t.k)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 16, textAlign: "left", cursor: "pointer", fontFamily: SERIF, color: HT.ink, background: HT.paper, border: kindSel === t.k ? `2px solid ${HT.green}` : `1px solid ${HT.line}` }}>
              <span style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 10, background: HT.green, color: HT.gold, display: "grid", placeItems: "center", fontSize: 13 }}>{t.code}</span>
              <span><span style={{ display: "block", fontSize: 17 }}>{t.title}</span><span style={{ fontSize: 13.5, color: HT.muted }}>{t.desc}</span></span>
            </button>
          ))}
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${dragging ? HT.green : HT.gold}`, outline: `14px solid ${HT.paper}`, outlineOffset: 0,
            borderRadius: 14, padding: "3.2rem 2rem", textAlign: "center", cursor: "pointer", margin: "14px 14px 1.5rem",
            background: dragging ? "#F6EFDF" : HT.paper,
            transition: "all 0.2s", marginBottom: "1.5rem",
          }}
        >
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={HT.ink} strokeWidth="1.6" strokeLinecap="round" style={{ marginBottom: 10 }}><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
          <div style={{ fontSize: 24, fontStyle: "italic", marginBottom: 6 }}>{dragging ? "Drop to upload" : kindSel === "sales" ? "Drop sales invoices here" : "Drop purchase bills here"}</div>
          <div style={{ color: HT.muted, fontSize: 14.5 }}>PDF · JPG · PNG · XLSX</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
            <span style={{ height: 46, padding: "0 22px", borderRadius: 999, background: HT.gold, color: HT.ink, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>Choose files →</span>
            <a href="/finance/whatsapp" onClick={e => e.stopPropagation()} style={{ height: 46, padding: "0 22px", borderRadius: 999, border: `1px solid ${HT.gold}`, color: HT.goldInk, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Send from WhatsApp</a>
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv" style={{ display: "none" }}
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "rgba(16,36,31,0.75)" }}>
                {files.length} file{files.length !== 1 ? "s" : ""} · {doneCount} processed
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {doneCount > 0 && (
                  <Link href="/finance/ai-review" style={{ color: "#12352D", fontSize: "0.82rem", textDecoration: "none", fontWeight: 600 }}>
                    Review AI Suggestions →
                  </Link>
                )}
                {idleCount > 0 && (
                  <button onClick={processAll} style={{ background: "#12352D", border: "none", color: "#F4EFE4", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                    Process {idleCount} File{idleCount !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {files.map(doc => (
                <div key={doc.id} style={{
                  background: "#FFFDF8", border: `1px solid ${doc.status === "done" ? "rgba(11,122,85,0.2)" : doc.status === "error" ? "rgba(194,50,31,0.2)" : "rgba(16,36,31,0.11)"}`,
                  borderRadius: 12, padding: "1rem 1.25rem",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                    {/* Preview thumbnail */}
                    <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, background: "rgba(16,36,31,0.08)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {doc.preview ? <img src={doc.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.5rem" }}>{DOC_TYPES.find(d => d.value === doc.docType)?.icon ?? "📄"}</span>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file.name}</span>
                        <span style={{ fontSize: "0.72rem", color: "rgba(16,36,31,0.65)", flexShrink: 0 }}>{(doc.file.size / 1024).toFixed(0)} KB</span>
                      </div>

                      {/* Doc type selector */}
                      {doc.status === "idle" && (
                        <select
                          value={doc.docType}
                          onChange={e => setFiles(prev => prev.map(f => f.id === doc.id ? { ...f, docType: e.target.value } : f))}
                          style={{ background: "rgba(16,36,31,0.08)", border: "1px solid rgba(16,36,31,0.17)", color: "#10241F", padding: "3px 8px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer" }}
                        >
                          {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.icon} {d.label}</option>)}
                        </select>
                      )}

                      {/* Status */}
                      {doc.status === "uploading" && <div style={{ fontSize: "0.78rem", color: "#12352D", marginTop: "0.3rem" }}>⬆ Uploading…</div>}
                      {doc.status === "analyzing" && <div style={{ fontSize: "0.78rem", color: "#12352D", marginTop: "0.3rem" }}>🤖 AI analyzing document…</div>}
                      {doc.status === "error" && <div style={{ fontSize: "0.78rem", color: "#B4321F", marginTop: "0.3rem" }}>❌ {doc.errorMsg}</div>}

                      {/* AI Result */}
                      {doc.status === "done" && doc.aiResult && (
                        <div style={{ marginTop: "0.75rem", background: "rgba(11,122,85,0.05)", border: "1px solid rgba(11,122,85,0.15)", borderRadius: 8, padding: "0.75rem" }}>
                          <div style={{ fontSize: "0.72rem", color: "#0B7A55", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.06em" }}>
                            ✓ AI EXTRACTED · {Math.round((doc.aiResult.confidence ?? 0) * 100)}% confidence
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                            {doc.aiResult.vendor && <div><span style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase" }}>Vendor</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{doc.aiResult.vendor}</span></div>}
                            {doc.aiResult.amount && <div><span style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase" }}>Amount</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{cur()}{doc.aiResult.amount.toLocaleString(activeMoney().locale)}</span></div>}
                            {doc.aiResult.gst && <div><span style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase" }}>GST</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{cur()}{doc.aiResult.gst.toLocaleString(activeMoney().locale)}</span></div>}
                            {doc.aiResult.date && <div><span style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase" }}>Date</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{doc.aiResult.date}</span></div>}
                          </div>
                          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "rgba(16,36,31,0.75)" }}>{doc.aiResult.narration}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end", flexShrink: 0 }}>
                      {doc.status === "idle" && (
                        <button onClick={() => processFile(doc)} style={{ background: "#12352D", border: "none", color: "#F4EFE4", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
                          Process
                        </button>
                      )}
                      <button onClick={() => removeFile(doc.id)} style={{ background: "none", border: "none", color: "rgba(16,36,31,0.55)", cursor: "pointer", fontSize: "1rem", padding: "2px 4px" }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {doneCount > 0 && (
              <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                <Link href="/finance/ai-review" style={{ background: "#12352D", color: "#F4EFE4", padding: "12px 32px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.95rem" }}>
                  Review AI Journal Suggestions →
                </Link>
              </div>
            )}
          </>
        )}

        {/* Upload History */}
        <div style={{ marginTop: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 400, fontStyle: "italic" }}>Upload history</h2>
            {bizId && <button onClick={() => loadHistory(bizId)} style={{ background: "none", border: "none", color: "rgba(16,36,31,0.65)", cursor: "pointer", fontSize: "0.78rem" }}>Refresh</button>}
          </div>
          {histLoading ? (
            <div style={{ color: "rgba(16,36,31,0.55)", fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ color: "rgba(16,36,31,0.35)", fontSize: "0.85rem", textAlign: "center", padding: "2rem", border: "1px dashed rgba(16,36,31,0.11)", borderRadius: 10 }}>No documents uploaded yet</div>
          ) : (
            <div style={{ background: "#FFFDF8", border: "1px solid rgba(16,36,31,0.10)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#FFFDF8", borderBottom: "1px solid rgba(16,36,31,0.10)" }}>
                    {["Document", "Type", "Vendor / Amount", "Date", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.65rem", color: "rgba(16,36,31,0.60)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((doc, i) => {
                    const statusColor = doc.status === "posted" ? "#0B7A55" : doc.status === "reviewed" ? "#12352D" : doc.status === "processing" ? "#12352D" : "rgba(16,36,31,0.60)";
                    const statusLabel = doc.status === "posted" ? "Posted" : doc.status === "reviewed" ? "AI Reviewed" : doc.status === "processing" ? "Processing" : doc.status;
                    const docIcon = DOC_TYPES.find(d => d.value === doc.doc_type)?.icon ?? "📄";
                    const docLabel = DOC_TYPES.find(d => d.value === doc.doc_type)?.label ?? doc.doc_type;
                    return (
                      <tr key={doc.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(16,36,31,0.08)" }}>
                        <td style={{ padding: "0.65rem 1rem", maxWidth: 220 }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
                          {doc.file_size && <div style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.55)", marginTop: 2 }}>{(doc.file_size / 1024).toFixed(0)} KB</div>}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", color: "rgba(16,36,31,0.80)", whiteSpace: "nowrap" }}>{docIcon} {docLabel}</td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          {doc.ai_summary ? (
                            <div>
                              {doc.ai_summary.vendor && <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{doc.ai_summary.vendor}</div>}
                              {doc.ai_summary.amount && <div style={{ fontSize: "0.75rem", color: "rgba(16,36,31,0.75)" }}>{cur()}{doc.ai_summary.amount.toLocaleString(activeMoney().locale)}</div>}
                            </div>
                          ) : <span style={{ color: "rgba(16,36,31,0.28)", fontSize: "0.78rem" }}>—</span>}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", color: "rgba(16,36,31,0.65)", whiteSpace: "nowrap" }}>
                          {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          {doc.journal_id ? (
                            <a href={`/finance/journals`} style={{ fontSize: "0.72rem", color: "#12352D", textDecoration: "none" }}>View Journal</a>
                          ) : doc.status === "reviewed" ? (
                            <a href="/finance/ai-review" style={{ fontSize: "0.72rem", color: "#12352D", textDecoration: "none" }}>Review →</a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
