"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Employee = {
  id: string;
  name: string;
  designation: string;
  monthly_ctc: number;
  pan: string;
  pf_eligible: boolean;
  esi_eligible: boolean;
  pt_applicable: boolean;
  bank_account: string;
};

type PayrollLine = {
  employee: Employee;
  basic: number;
  hra: number;
  other_allowance: number;
  gross: number;
  pf_emp: number;
  pf_er: number;
  esi_emp: number;
  esi_er: number;
  pt: number;
  tds: number;
  net_pay: number;
};

const MONTHS = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
const fmtD = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function calcPayroll(emp: Employee): PayrollLine {
  const ctc = emp.monthly_ctc;
  const basic = Math.round(ctc * 0.5);
  const hra = Math.round(basic * 0.4);
  const other_allowance = ctc - basic - hra;
  const gross = ctc;

  // PF: 12% of basic, capped at ₹15,000 basic
  const pfBase = Math.min(basic, 15000);
  const pf_emp = emp.pf_eligible ? Math.round(pfBase * 0.12) : 0;
  const pf_er = emp.pf_eligible ? Math.round(pfBase * 0.12) : 0;

  // ESI: if gross <= ₹21,000
  const esiEligible = emp.esi_eligible && gross <= 21000;
  const esi_emp = esiEligible ? Math.round(gross * 0.0075) : 0;
  const esi_er = esiEligible ? Math.round(gross * 0.0325) : 0;

  // PT: Kerala ₹200/month if salary > ₹20,000
  const pt = emp.pt_applicable && gross > 20000 ? 200 : 0;

  // Simplified TDS (annual salary check, slab-based)
  const annualGross = gross * 12;
  let annualTds = 0;
  if (annualGross > 1500000) annualTds = (annualGross - 1500000) * 0.3 + 187500;
  else if (annualGross > 1200000) annualTds = (annualGross - 1200000) * 0.2 + 127500;
  else if (annualGross > 900000) annualTds = (annualGross - 900000) * 0.15 + 82500;
  else if (annualGross > 600000) annualTds = (annualGross - 600000) * 0.1 + 52500;
  else if (annualGross > 300000) annualTds = (annualGross - 300000) * 0.05;
  const tds = Math.round(annualTds / 12);

  const net_pay = gross - pf_emp - esi_emp - pt - tds;

  return { employee: emp, basic, hra, other_allowance, gross, pf_emp, pf_er, esi_emp, esi_er, pt, tds, net_pay };
}

const EMPTY_EMP: Omit<Employee, "id"> = {
  name: "", designation: "", monthly_ctc: 0, pan: "",
  pf_eligible: true, esi_eligible: true, pt_applicable: true, bank_account: "",
};

export default function PayrollPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState<"employees" | "run" | "history">("employees");

  // Employee form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Omit<Employee, "id">>(EMPTY_EMP);

  // Payroll run
  const [runMonth, setRunMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [slipEmp, setSlipEmp] = useState<PayrollLine | null>(null);
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState("");
  const [history, setHistory] = useState<{ month: string; total_net: number; entry_no: string; created_at: string }[]>([]);

  const STORAGE_KEY_EMP = `fw_payroll_employees_${bizId}`;
  const STORAGE_KEY_HIS = `fw_payroll_history_${bizId}`;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const emps = JSON.parse(localStorage.getItem(`fw_payroll_employees_${saved}`) ?? "[]") as Employee[];
      setEmployees(emps);
      const hist = JSON.parse(localStorage.getItem(`fw_payroll_history_${saved}`) ?? "[]");
      setHistory(hist);
    });
  }, []);

  useEffect(() => {
    if (!bizId) return;
    setLines(employees.map(calcPayroll));
  }, [employees, bizId]);

  const saveEmployees = (emps: Employee[]) => {
    setEmployees(emps);
    if (bizId) localStorage.setItem(`fw_payroll_employees_${bizId}`, JSON.stringify(emps));
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY_EMP); setShowForm(true); };
  const openEdit = (e: Employee) => { setEditing(e); setForm({ ...e }); setShowForm(true); };

  const saveForm = () => {
    if (!form.name || form.monthly_ctc <= 0) return;
    if (editing) {
      saveEmployees(employees.map(e => e.id === editing.id ? { ...form, id: editing.id } : e));
    } else {
      saveEmployees([...employees, { ...form, id: Math.random().toString(36).slice(2, 10) }]);
    }
    setShowForm(false);
  };

  const removeEmp = (id: string) => {
    if (!confirm("Remove this employee?")) return;
    saveEmployees(employees.filter(e => e.id !== id));
  };

  const postPayroll = useCallback(async () => {
    if (!bizId || !userId || !lines.length) return;
    setPosting(true);
    setPostMsg("");
    try {
      const totalGross = lines.reduce((s, l) => s + l.gross, 0);
      const totalPfEr = lines.reduce((s, l) => s + l.pf_er, 0);
      const totalEsiEr = lines.reduce((s, l) => s + l.esi_er, 0);
      const totalNet = lines.reduce((s, l) => s + l.net_pay, 0);
      const totalDeductions = lines.reduce((s, l) => s + l.pf_emp + l.esi_emp + l.pt + l.tds, 0);

      const monthLabel = new Date(runMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

      // Build journal lines
      const journalLines = [
        { account: "Salary & Wages", debit: totalGross, credit: 0 },
        { account: "PF Employer Contribution", debit: totalPfEr, credit: 0 },
        { account: "ESI Employer Contribution", debit: totalEsiEr, credit: 0 },
        { account: "Salary Payable", debit: 0, credit: totalNet },
        { account: "PF Payable", debit: 0, credit: lines.reduce((s, l) => s + l.pf_emp + l.pf_er, 0) },
        { account: "ESI Payable", debit: 0, credit: lines.reduce((s, l) => s + l.esi_emp + l.esi_er, 0) },
        { account: "PT Payable", debit: 0, credit: lines.reduce((s, l) => s + l.pt, 0) },
        { account: "TDS Payable (192 - Salary)", debit: 0, credit: lines.reduce((s, l) => s + l.tds, 0) },
      ].filter(l => l.debit > 0 || l.credit > 0);

      const { data: fyData } = await supabase
        .from("fw_fin_financial_years")
        .select("id,start_date,entry_prefix")
        .eq("business_id", bizId)
        .order("start_date", { ascending: false })
        .limit(1)
        .single();

      const { count: jCount } = await supabase
        .from("fw_fin_journals")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bizId);

      const entry_no = `${fyData?.entry_prefix ?? "JV"}-${String((jCount ?? 0) + 1).padStart(4, "0")}`;

      const { data: journal } = await supabase
        .from("fw_fin_journals")
        .insert({
          business_id: bizId, created_by: userId,
          financial_year_id: fyData?.id ?? null,
          date: runMonth + "-01",
          narration: `Payroll for ${monthLabel} — ${employees.length} employees`,
          type: "journal", status: "posted", entry_no,
          total_debit: totalGross + totalPfEr + totalEsiEr,
          total_credit: totalGross + totalPfEr + totalEsiEr,
        })
        .select("id")
        .single();

      if (journal?.id) {
        const lineRows = journalLines.map((l, i) => ({
          journal_id: journal.id,
          business_id: bizId,
          account_name: l.account,
          debit: l.debit,
          credit: l.credit,
          sort_order: i,
        }));
        await supabase.from("fw_fin_journal_lines").insert(lineRows);

        const newHist = [
          { month: monthLabel, total_net: totalNet, entry_no, created_at: new Date().toISOString() },
          ...history,
        ].slice(0, 24);
        setHistory(newHist);
        if (bizId) localStorage.setItem(`fw_payroll_history_${bizId}`, JSON.stringify(newHist));
        setPostMsg(`✅ Payroll posted as ${entry_no}`);
      }
    } catch (e) {
      setPostMsg("❌ " + (e instanceof Error ? e.message : "Failed to post"));
    } finally {
      setPosting(false);
    }
  }, [bizId, userId, lines, runMonth, employees, history]);

  const S = {
    page: { minHeight: "100vh", background: "#0A0D14", color: "#E8EDF5", fontFamily: "Inter,system-ui,sans-serif" },
    nav: { borderBottom: "1px solid #1F2937", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 52 },
    main: { maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" },
    card: { background: "#111827", border: "1px solid #1F2937", borderRadius: 12, padding: "1.5rem" },
    btn: { padding: "0.5rem 1.1rem", borderRadius: 8, border: "1px solid #374151", background: "#1F2937", color: "#E8EDF5", cursor: "pointer", fontSize: "0.84rem", fontFamily: "inherit" },
    btnPrimary: { padding: "0.55rem 1.2rem", borderRadius: 8, border: "none", background: "#C9A84C", color: "#0A0D14", fontWeight: 700, cursor: "pointer", fontSize: "0.84rem", fontFamily: "inherit" },
    label: { fontSize: "0.75rem", color: "#6B7280", marginBottom: "0.3rem", display: "block" },
    input: { width: "100%", background: "#0A0D14", border: "1px solid #374151", color: "#E8EDF5", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" as const },
    tab: (active: boolean) => ({
      padding: "0.45rem 1rem", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.84rem", fontFamily: "inherit",
      background: active ? "#C9A84C" : "transparent", color: active ? "#0A0D14" : "#9CA3AF", fontWeight: active ? 700 : 400,
    }),
  };

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "#374151" }}>›</span>
        <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Payroll</span>
      </nav>

      <div style={S.main}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Payroll</h1>
            <p style={{ color: "#6B7280", fontSize: "0.84rem", margin: "0.3rem 0 0" }}>Salary calculation with PF, ESI, PT & TDS</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={S.tab(tab === "employees")} onClick={() => setTab("employees")}>Employees</button>
            <button style={S.tab(tab === "run")} onClick={() => setTab("run")}>Run Payroll</button>
            <button style={S.tab(tab === "history")} onClick={() => setTab("history")}>History</button>
          </div>
        </div>

        {/* ── EMPLOYEES TAB ── */}
        {tab === "employees" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#6B7280", fontSize: "0.84rem" }}>{employees.length} employees</span>
              <button style={S.btnPrimary} onClick={openAdd}>+ Add Employee</button>
            </div>

            {employees.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "3rem", color: "#6B7280" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👤</div>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No employees yet</div>
                <div style={{ fontSize: "0.84rem" }}>Add employees to start running payroll</div>
              </div>
            ) : (
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                  <thead>
                    <tr style={{ background: "#0A0D14", borderBottom: "1px solid #1F2937" }}>
                      {["Name", "Designation", "CTC/Month", "PF", "ESI", "PT", "Actions"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#6B7280", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(e => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #1F2937" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ fontWeight: 600 }}>{e.name}</div>
                          {e.pan && <div style={{ fontSize: "0.72rem", color: "#6B7280", fontFamily: "monospace" }}>{e.pan}</div>}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#9CA3AF" }}>{e.designation}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#C9A84C", fontVariantNumeric: "tabular-nums" }}>{fmt(e.monthly_ctc)}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, background: e.pf_eligible ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)", color: e.pf_eligible ? "#34D399" : "#6B7280" }}>
                            {e.pf_eligible ? "Yes" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, background: e.esi_eligible ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)", color: e.esi_eligible ? "#60A5FA" : "#6B7280" }}>
                            {e.esi_eligible ? "Yes" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, background: e.pt_applicable ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.04)", color: e.pt_applicable ? "#A78BFA" : "#6B7280" }}>
                            {e.pt_applicable ? "₹200" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button style={{ ...S.btn, padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => openEdit(e)}>Edit</button>
                            <button style={{ ...S.btn, padding: "4px 10px", fontSize: "0.75rem", color: "#F87171", borderColor: "rgba(248,113,113,0.2)" }} onClick={() => removeEmp(e.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── RUN PAYROLL TAB ── */}
        {tab === "run" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={S.label}>Payroll Month</label>
                <input type="month" value={runMonth} onChange={e => setRunMonth(e.target.value)}
                  style={{ ...S.input, width: "auto", padding: "0.45rem 0.75rem" }} />
              </div>
              <div style={{ flex: 1 }} />
              {lines.length > 0 && (
                <div style={{ display: "flex", gap: "2rem", fontSize: "0.84rem" }}>
                  <div><span style={{ color: "#6B7280" }}>Total Gross </span><strong style={{ color: "#C9A84C" }}>{fmt(lines.reduce((s, l) => s + l.gross, 0))}</strong></div>
                  <div><span style={{ color: "#6B7280" }}>Net Payable </span><strong style={{ color: "#34D399" }}>{fmt(lines.reduce((s, l) => s + l.net_pay, 0))}</strong></div>
                </div>
              )}
            </div>

            {employees.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "2rem", color: "#6B7280" }}>
                Add employees first to run payroll.
              </div>
            ) : (
              <>
                <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 760 }}>
                    <thead>
                      <tr style={{ background: "#0A0D14", borderBottom: "1px solid #1F2937" }}>
                        {["Employee", "Basic", "HRA", "Other Allow.", "Gross", "PF(E)", "ESI(E)", "PT", "TDS", "Net Pay", ""].map(h => (
                          <th key={h} style={{ padding: "0.65rem 0.75rem", textAlign: h === "Employee" || h === "" ? "left" : "right", color: "#6B7280", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map(l => (
                        <tr key={l.employee.id} style={{ borderBottom: "1px solid #1F2937" }}>
                          <td style={{ padding: "0.65rem 0.75rem" }}>
                            <div style={{ fontWeight: 600 }}>{l.employee.name}</div>
                            <div style={{ fontSize: "0.68rem", color: "#6B7280" }}>{l.employee.designation}</div>
                          </td>
                          {[l.basic, l.hra, l.other_allowance, l.gross, l.pf_emp, l.esi_emp, l.pt, l.tds].map((v, i) => (
                            <td key={i} style={{ padding: "0.65rem 0.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums", color: i === 3 ? "#C9A84C" : "#E8EDF5" }}>
                              {v > 0 ? fmt(v) : <span style={{ color: "#374151" }}>—</span>}
                            </td>
                          ))}
                          <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#34D399", fontVariantNumeric: "tabular-nums" }}>{fmt(l.net_pay)}</td>
                          <td style={{ padding: "0.65rem 0.75rem" }}>
                            <button style={{ ...S.btn, padding: "3px 10px", fontSize: "0.72rem" }} onClick={() => setSlipEmp(l)}>Slip</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "rgba(201,168,76,0.06)", borderTop: "1px solid #374151" }}>
                        <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, fontSize: "0.78rem" }}>TOTAL ({employees.length} employees)</td>
                        {[
                          lines.reduce((s, l) => s + l.basic, 0),
                          lines.reduce((s, l) => s + l.hra, 0),
                          lines.reduce((s, l) => s + l.other_allowance, 0),
                          lines.reduce((s, l) => s + l.gross, 0),
                          lines.reduce((s, l) => s + l.pf_emp, 0),
                          lines.reduce((s, l) => s + l.esi_emp, 0),
                          lines.reduce((s, l) => s + l.pt, 0),
                          lines.reduce((s, l) => s + l.tds, 0),
                        ].map((v, i) => (
                          <td key={i} style={{ padding: "0.65rem 0.75rem", textAlign: "right", fontWeight: 700, color: i === 3 ? "#C9A84C" : "#E8EDF5", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</td>
                        ))}
                        <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#34D399", fontVariantNumeric: "tabular-nums" }}>{fmt(lines.reduce((s, l) => s + l.net_pay, 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  <button style={S.btnPrimary} onClick={postPayroll} disabled={posting}>
                    {posting ? "Posting…" : "Post Payroll Journal →"}
                  </button>
                  {postMsg && <span style={{ fontSize: "0.85rem", color: postMsg.startsWith("✅") ? "#34D399" : "#F87171" }}>{postMsg}</span>}
                </div>

                {/* Employer contributions note */}
                <div style={{ ...S.card, background: "rgba(167,139,250,0.04)", borderColor: "rgba(167,139,250,0.15)", fontSize: "0.78rem", color: "#9CA3AF" }}>
                  <strong style={{ color: "#A78BFA" }}>Employer contributions (also posted):</strong>
                  {" "}PF Employer: {fmt(lines.reduce((s, l) => s + l.pf_er, 0))} |
                  {" "}ESI Employer: {fmt(lines.reduce((s, l) => s + l.esi_er, 0))} |
                  {" "}Total Employer Cost: {fmt(lines.reduce((s, l) => s + l.gross + l.pf_er + l.esi_er, 0))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div style={S.card}>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6B7280" }}>No payroll runs yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1F2937" }}>
                    {["Month", "Net Payable", "Entry No.", "Posted On"].map(h => (
                      <th key={h} style={{ padding: "0.65rem 0", textAlign: "left", color: "#6B7280", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1F2937" }}>
                      <td style={{ padding: "0.65rem 0", fontWeight: 600 }}>{h.month}</td>
                      <td style={{ padding: "0.65rem 0", color: "#34D399", fontVariantNumeric: "tabular-nums" }}>{fmt(h.total_net)}</td>
                      <td style={{ padding: "0.65rem 0", fontFamily: "monospace", color: "#C9A84C", fontSize: "0.8rem" }}>{h.entry_no}</td>
                      <td style={{ padding: "0.65rem 0", color: "#6B7280", fontSize: "0.8rem" }}>{new Date(h.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── ADD/EDIT EMPLOYEE MODAL ── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem" }}>{editing ? "Edit Employee" : "Add Employee"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={S.label}>Name *</label>
                  <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rajan K" />
                </div>
                <div>
                  <label style={S.label}>Designation</label>
                  <input style={S.input} value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="Accountant" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={S.label}>Monthly CTC (₹) *</label>
                  <input style={S.input} type="number" value={form.monthly_ctc || ""} onChange={e => setForm(f => ({ ...f, monthly_ctc: +e.target.value }))} placeholder="30000" />
                </div>
                <div>
                  <label style={S.label}>PAN</label>
                  <input style={S.input} value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} />
                </div>
              </div>
              <div>
                <label style={S.label}>Bank Account / UPI (for slip)</label>
                <input style={S.input} value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} placeholder="ICICI 0012345678" />
              </div>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                {[
                  { key: "pf_eligible" as const, label: "PF Eligible (12%)" },
                  { key: "esi_eligible" as const, label: "ESI Eligible" },
                  { key: "pt_applicable" as const, label: "Prof. Tax" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.84rem" }}>
                    <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button style={S.btn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={S.btnPrimary} onClick={saveForm}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SALARY SLIP MODAL ── */}
      {slipEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setSlipEmp(null)}>
          <div style={{ background: "#fff", color: "#111", borderRadius: 12, padding: "2rem", width: "100%", maxWidth: 440, fontFamily: "Georgia,serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: "1rem", marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>SALARY SLIP</div>
              <div style={{ fontSize: "0.8rem", color: "#555" }}>
                {new Date(runMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem 1rem", fontSize: "0.82rem", marginBottom: "1rem" }}>
              <div><strong>Name:</strong></div><div>{slipEmp.employee.name}</div>
              <div><strong>Designation:</strong></div><div>{slipEmp.employee.designation}</div>
              {slipEmp.employee.pan && <><div><strong>PAN:</strong></div><div>{slipEmp.employee.pan}</div></>}
              {slipEmp.employee.bank_account && <><div><strong>Bank A/c:</strong></div><div>{slipEmp.employee.bank_account}</div></>}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "0.4rem", textAlign: "left" }}>Earnings</th>
                  <th style={{ padding: "0.4rem", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "0.4rem", textAlign: "left" }}>Deductions</th>
                  <th style={{ padding: "0.4rem", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: "0.3rem 0.4rem" }}>Basic Salary</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.basic)}</td><td style={{ padding: "0.3rem 0.4rem" }}>PF (Employee)</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.pf_emp)}</td></tr>
                <tr><td style={{ padding: "0.3rem 0.4rem" }}>HRA</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.hra)}</td><td style={{ padding: "0.3rem 0.4rem" }}>ESI (Employee)</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.esi_emp)}</td></tr>
                <tr><td style={{ padding: "0.3rem 0.4rem" }}>Other Allowance</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.other_allowance)}</td><td style={{ padding: "0.3rem 0.4rem" }}>Prof. Tax</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.pt)}</td></tr>
                <tr><td /><td /><td style={{ padding: "0.3rem 0.4rem" }}>TDS (Sec 192)</td><td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{fmtD(slipEmp.tds)}</td></tr>
                <tr style={{ borderTop: "1px solid #333", fontWeight: 700 }}>
                  <td style={{ padding: "0.4rem" }}>Gross Salary</td>
                  <td style={{ padding: "0.4rem", textAlign: "right" }}>{fmtD(slipEmp.gross)}</td>
                  <td style={{ padding: "0.4rem" }}>Total Deductions</td>
                  <td style={{ padding: "0.4rem", textAlign: "right" }}>{fmtD(slipEmp.pf_emp + slipEmp.esi_emp + slipEmp.pt + slipEmp.tds)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ background: "#111", color: "#fff", padding: "0.75rem 1rem", borderRadius: 6, marginTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Net Pay</span>
              <span>{fmtD(slipEmp.net_pay)}</span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
              <button style={{ ...S.btn, color: "#111", borderColor: "#ccc", background: "#f5f5f5" }} onClick={() => window.print()}>🖨 Print</button>
              <button style={{ ...S.btn, color: "#111", borderColor: "#ccc", background: "#f5f5f5" }} onClick={() => setSlipEmp(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
