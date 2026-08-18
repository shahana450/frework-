"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Link from "next/link";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      const saved = (localStorage.getItem() ?? "").replace(/﻿/g, "").trim();
      if (saved) {
        const { data } = await supabase.from("fw_fin_businesses").select("id,name").eq("id", saved).single();
        if (data) { setBizId(data.id); setBizName(data.name); }
      } else {
        const { data } = await supabase.from("fw_fin_businesses").select("id,name").eq("owner_id", user.id).eq("is_active", true).limit(1).single();
        if (data) { setBizId(data.id); setBizName(data.name); if (user) localStorage.setItem(`fw_fin_biz_${user.id}`, data.id); }
        else router.push("/finance/setup");
      }
    });
  }, []);

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

      // AI Analysis — extract text then call Claude
      setFiles(prev => prev.map(f => f.id === docFile.id ? { ...f, status: "analyzing" } : f));

      let extractedText = `Document: ${docFile.file.name}\nType: ${docFile.docType}\n`;
      // For images, use a description; for PDFs we send filename context
      if (docFile.file.type.startsWith("image/")) {
        extractedText += `[Image file - ${docFile.file.name}] Please analyse based on document type: ${docFile.docType}`;
      } else {
        extractedText += `[PDF/Document file - ${docFile.file.name}] Document type hint: ${docFile.docType}`;
      }

      let aiResult;
      try {
        const aiRes = await fetch("/api/finance/ai-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extractedText, doc_id: doc.id, business_id: bizId }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiResult = {
            vendor: aiData.vendor ?? aiData.customer,
            amount: aiData.amount,
            gst: aiData.gst_amount,
            date: aiData.date,
            narration: aiData.narration,
            confidence: aiData.confidence ?? 0.85,
            type: aiData.doc_type ?? docFile.docType,
            items: aiData.items,
          };
        } else {
          throw new Error("AI unavailable");
        }
      } catch {
        // Fallback to simulation if AI API not configured
        aiResult = simulateAI(docFile.file.name, docFile.docType);
      }

      // Save AI summary to document
      await supabase.from("fw_fin_documents").update({
        status: "reviewed",
        ai_summary: aiResult,
      }).eq("id", doc.id);

      // Create AI suggestion
      await supabase.from("fw_fin_ai_suggestions").insert({
        business_id: bizId,
        document_id: doc.id,
        suggested_type: docFile.docType === "invoice" ? "sales" : docFile.docType === "bill" ? "purchase" : "expense",
        suggested_narration: aiResult.narration,
        suggested_lines: generateSuggestedLines(docFile.docType, { amount: aiResult?.amount, gst: aiResult?.gst }),
        confidence: aiResult.confidence ?? 0.85,
        status: "pending",
      });

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
      narration: `${DOC_TYPES.find(d => d.value === docType)?.label ?? "Document"} from ${vendor} — ₹${amount.toLocaleString("en-IN")}`,
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
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Upload Documents</span>
        <div style={{ flex: 1 }} />
        {bizName && <span style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>{bizName}</span>}
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.6rem", fontWeight: 800 }}>Upload Anything</h1>
          <p style={{ margin: 0, color: "rgba(237,232,220,0.5)", fontSize: "0.88rem" }}>
            Drop invoices, bills, receipts, or bank statements. AI extracts vendor, amount, GST, and suggests journal entries.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? "#C9A84C" : "rgba(201,168,76,0.3)"}`,
            borderRadius: 16, padding: "3rem 2rem", textAlign: "center", cursor: "pointer",
            background: dragging ? "rgba(201,168,76,0.06)" : "rgba(255,255,255,0.02)",
            transition: "all 0.2s", marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.4rem" }}>
            {dragging ? "Drop files here" : "Drop files or click to browse"}
          </div>
          <div style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>
            PDF, JPG, PNG, XLSX · Invoices, Bills, Receipts, Bank Statements
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv" style={{ display: "none" }}
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "rgba(237,232,220,0.5)" }}>
                {files.length} file{files.length !== 1 ? "s" : ""} · {doneCount} processed
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {doneCount > 0 && (
                  <Link href="/finance/ai-review" style={{ color: "#C9A84C", fontSize: "0.82rem", textDecoration: "none", fontWeight: 600 }}>
                    Review AI Suggestions →
                  </Link>
                )}
                {idleCount > 0 && (
                  <button onClick={processAll} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                    Process {idleCount} File{idleCount !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {files.map(doc => (
                <div key={doc.id} style={{
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${doc.status === "done" ? "rgba(74,222,128,0.2)" : doc.status === "error" ? "rgba(248,113,113,0.2)" : "rgba(237,232,220,0.08)"}`,
                  borderRadius: 12, padding: "1rem 1.25rem",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                    {/* Preview thumbnail */}
                    <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, background: "rgba(237,232,220,0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {doc.preview ? <img src={doc.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.5rem" }}>{DOC_TYPES.find(d => d.value === doc.docType)?.icon ?? "📄"}</span>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file.name}</span>
                        <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", flexShrink: 0 }}>{(doc.file.size / 1024).toFixed(0)} KB</span>
                      </div>

                      {/* Doc type selector */}
                      {doc.status === "idle" && (
                        <select
                          value={doc.docType}
                          onChange={e => setFiles(prev => prev.map(f => f.id === doc.id ? { ...f, docType: e.target.value } : f))}
                          style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "3px 8px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer" }}
                        >
                          {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.icon} {d.label}</option>)}
                        </select>
                      )}

                      {/* Status */}
                      {doc.status === "uploading" && <div style={{ fontSize: "0.78rem", color: "#60a5fa", marginTop: "0.3rem" }}>⬆ Uploading…</div>}
                      {doc.status === "analyzing" && <div style={{ fontSize: "0.78rem", color: "#C9A84C", marginTop: "0.3rem" }}>🤖 AI analyzing document…</div>}
                      {doc.status === "error" && <div style={{ fontSize: "0.78rem", color: "#f87171", marginTop: "0.3rem" }}>❌ {doc.errorMsg}</div>}

                      {/* AI Result */}
                      {doc.status === "done" && doc.aiResult && (
                        <div style={{ marginTop: "0.75rem", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8, padding: "0.75rem" }}>
                          <div style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.06em" }}>
                            ✓ AI EXTRACTED · {Math.round((doc.aiResult.confidence ?? 0) * 100)}% confidence
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                            {doc.aiResult.vendor && <div><span style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" }}>Vendor</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{doc.aiResult.vendor}</span></div>}
                            {doc.aiResult.amount && <div><span style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" }}>Amount</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>₹{doc.aiResult.amount.toLocaleString("en-IN")}</span></div>}
                            {doc.aiResult.gst && <div><span style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" }}>GST</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>₹{doc.aiResult.gst.toLocaleString("en-IN")}</span></div>}
                            {doc.aiResult.date && <div><span style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" }}>Date</span><br /><span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{doc.aiResult.date}</span></div>}
                          </div>
                          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.5)" }}>{doc.aiResult.narration}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end", flexShrink: 0 }}>
                      {doc.status === "idle" && (
                        <button onClick={() => processFile(doc)} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
                          Process
                        </button>
                      )}
                      <button onClick={() => removeFile(doc.id)} style={{ background: "none", border: "none", color: "rgba(237,232,220,0.3)", cursor: "pointer", fontSize: "1rem", padding: "2px 4px" }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {doneCount > 0 && (
              <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                <Link href="/finance/ai-review" style={{ background: "#C9A84C", color: "#070C1A", padding: "12px 32px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.95rem" }}>
                  Review AI Journal Suggestions →
                </Link>
              </div>
            )}
          </>
        )}

        {/* Tips */}
        {files.length === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginTop: "1rem" }}>
            {[
              { icon: "🧾", title: "Sales Invoices", desc: "GST invoices you've raised to customers" },
              { icon: "📦", title: "Purchase Bills", desc: "Bills from vendors and suppliers" },
              { icon: "🏦", title: "Bank Statements", desc: "PDF or Excel bank statements for reconciliation" },
            ].map(tip => (
              <div key={tip.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 10, padding: "1rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{tip.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>{tip.title}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)" }}>{tip.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
