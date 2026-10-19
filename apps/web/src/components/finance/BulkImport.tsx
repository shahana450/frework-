"use client";
// Import customers or items from Excel/CSV: download the template, fill it, upload, check the preview, import.
// Rows whose name already exists update that record (only the cells you filled); new names are added.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { TEMPLATES, parseCustomers, parseItems, type ImportKind, type CustomerRow, type ItemRow, type Parsed } from "@/lib/bulkImport";

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", soft: "#EEF0FA", good: "#0B7A55", goodSoft: "#E3F6EE", bad: "#C2321F", badSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };

async function downloadTemplate(kind: ImportKind) {
  const t = TEMPLATES[kind];
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t.title, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = t.cols.map(c => ({ header: c.h, width: Math.max(14, c.h.length + 4, String(c.ex).length + 4) }));
  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF232A63" } };
    cell.alignment = { vertical: "middle" };
  });
  ws.getRow(1).height = 22;
  const ex = ws.addRow(t.cols.map(c => c.ex));
  ex.eachCell(cell => { cell.font = { italic: true, color: { argb: "FF8A93C8" } }; });
  if (kind === "customers") ws.getColumn(4).numFmt = "@";   // phone as text
  const help = wb.addWorksheet("Instructions");
  help.columns = [{ width: 18 }, { width: 80 }];
  help.addRow([`How to fill the ${t.title} sheet`]).font = { bold: true, size: 13, color: { argb: "FF232A63" } };
  help.addRow(["", "One row per " + (kind === "customers" ? "customer or supplier" : "item") + ". Replace or delete the grey example row. Keep the headings as they are."]);
  help.addRow(["", "A name that already exists in FreBook is updated with the cells you filled; new names are added."]);
  help.addRow([]);
  for (const c of t.cols) { const r = help.addRow([c.h, c.help]); r.getCell(1).font = { bold: true }; }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = `FreBook-${t.title}-template.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

const clean = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ""));

export default function BulkImport({ kind, bizId, onClose, onDone }: { kind: ImportKind; bizId: string; onClose: () => void; onDone: (count: number) => void }) {
  const t = TEMPLATES[kind];
  const [parsed, setParsed] = useState<Parsed<CustomerRow | ItemRow> | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onFile(f: File) {
    setMsg(""); setParsed(null); setFileName(f.name);
    try {
      const XLSX = await import("xlsx");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const wb = /\.csv$/i.test(f.name) ? XLSX.read(new TextDecoder().decode(bytes), { type: "string", raw: true }) : XLSX.read(bytes, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames.find(n => !/instruction/i.test(n)) ?? wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
      setParsed(kind === "customers" ? parseCustomers(grid) : parseItems(grid));
    } catch { setMsg("Couldn't read this file. Save it as .xlsx or .csv and try again."); }
  }

  async function doImport() {
    if (!parsed?.rows.length) return;
    setBusy(true); setMsg("");
    try {
      const table = kind === "customers" ? "fw_fin_contacts" : "fw_fin_items";
      const { data: existing, error: exErr } = await supabase.from(table).select("id,name").eq("business_id", bizId);
      if (exErr) throw new Error(/fw_fin_items/.test(exErr.message) ? "Items need a one-time database setup — run 2026-11-01_items.sql in Supabase." : exErr.message);
      const idOf = new Map((existing ?? []).map(r => [String(r.name).trim().toLowerCase(), r.id as string]));
      const fresh: Record<string, unknown>[] = [], updates: { id: string; patch: Record<string, unknown> }[] = [];
      for (const r of parsed.rows) {
        const id = idOf.get(r.name.toLowerCase());
        if (id) updates.push({ id, patch: clean({ ...r, name: undefined }) });
        else fresh.push({ ...clean(r as unknown as Record<string, unknown>), business_id: bizId, is_active: true });
      }
      for (let i = 0; i < fresh.length; i += 200) {
        const { error } = await supabase.from(table).insert(fresh.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      for (let i = 0; i < updates.length; i += 10) {
        await Promise.all(updates.slice(i, i + 10).map(u => supabase.from(table).update({ ...u.patch, ...(kind === "items" ? { updated_at: new Date().toISOString() } : {}) }).eq("id", u.id)));
      }
      setMsg(`✓ ${fresh.length} added${updates.length ? `, ${updates.length} updated` : ""}.`);
      onDone(fresh.length + updates.length);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    } finally { setBusy(false); }
  }

  const btn: React.CSSProperties = { height: 40, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#FFFFFF", color: C.ink, fontWeight: 700, fontSize: 14, cursor: "pointer" };
  return (
    <div role="dialog" aria-modal="true" aria-label={`Import ${t.title.toLowerCase()}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(20,26,58,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 80 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 18, width: "min(640px,100%)", maxHeight: "88vh", overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 16, color: C.ink, boxShadow: "0 30px 80px -30px rgba(20,26,58,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Import {t.title.toLowerCase()} from Excel</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: C.muted }}>Add many {t.title.toLowerCase()} at once. Existing names are updated, new ones added.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", fontSize: 22, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          <li style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 12, background: C.soft }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: C.navy, color: "#FFF", fontWeight: 800, fontSize: 13, display: "grid", placeItems: "center", flexShrink: 0 }}>1</span>
            <span style={{ flex: 1, fontSize: 14 }}>Download the template and fill one row per {kind === "customers" ? "customer" : "item"}.</span>
            <button onClick={() => downloadTemplate(kind)} style={{ ...btn, background: C.navy, color: "#FFF", border: "none" }}>⬇ Template</button>
          </li>
          <li style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 12, background: C.soft }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: C.navy, color: "#FFF", fontWeight: 800, fontSize: 13, display: "grid", placeItems: "center", flexShrink: 0 }}>2</span>
            <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName ? `📄 ${fileName}` : "Upload the filled file (.xlsx or .csv)."}</span>
            <label style={{ ...btn, display: "inline-flex", alignItems: "center" }}>
              ⬆ Upload
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </label>
          </li>
        </ol>

        {parsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13, fontWeight: 700 }}>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: C.goodSoft, color: C.good }}>{parsed.rows.length} ready</span>
              {parsed.warnings.length > 0 && <span style={{ padding: "4px 10px", borderRadius: 999, background: C.warnSoft, color: C.warn }}>{parsed.warnings.length} to check</span>}
              {parsed.errors.length > 0 && <span style={{ padding: "4px 10px", borderRadius: 999, background: C.badSoft, color: C.bad }}>{parsed.errors.length} skipped</span>}
            </div>
            {parsed.rows.length > 0 && (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "auto", maxHeight: 220 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#F7F8FC", textAlign: "left", color: C.muted }}>
                    {(kind === "customers" ? ["Name", "Type", "GSTIN", "Phone", "State"] : ["Item", "HSN/SAC", "Unit", "Price", "GST"]).map(h => <th key={h} style={{ padding: "8px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {parsed.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                        {(kind === "customers"
                          ? [(r as CustomerRow).name, (r as CustomerRow).type === "vendor" ? "Supplier" : (r as CustomerRow).type === "both" ? "Both" : "Customer", (r as CustomerRow).gstin ?? "—", (r as CustomerRow).phone ?? "—", (r as CustomerRow).state ?? "—"]
                          : [(r as ItemRow).name, (r as ItemRow).hsn ?? "—", (r as ItemRow).unit, `₹${(r as ItemRow).rate.toLocaleString("en-IN")}`, `${(r as ItemRow).gst_rate}%`]
                        ).map((v, k) => <td key={k} style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 50 && <div style={{ padding: 8, fontSize: 12, color: C.muted, textAlign: "center" }}>…and {parsed.rows.length - 50} more</div>}
              </div>
            )}
            {[...parsed.errors.map(x => ({ ...x, bad: true })), ...parsed.warnings.map(x => ({ ...x, bad: false }))].slice(0, 12).map((x, i) => (
              <div key={i} style={{ fontSize: 12.5, color: x.bad ? C.bad : C.warn }}>{x.row ? `Row ${x.row}: ` : ""}{x.text}</div>
            ))}
          </div>
        )}

        {msg && <div role="status" style={{ fontSize: 14, fontWeight: 700, color: msg.startsWith("✓") ? C.good : C.bad }}>{msg}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btn}>{msg.startsWith("✓") ? "Done" : "Cancel"}</button>
          {!msg.startsWith("✓") && (
            <button onClick={doImport} disabled={busy || !parsed?.rows.length} style={{ ...btn, background: parsed?.rows.length ? C.navy : C.line, color: "#FFF", border: "none", cursor: parsed?.rows.length ? "pointer" : "default" }}>
              {busy ? "Importing…" : `Import ${parsed?.rows.length ?? 0} ${t.title.toLowerCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
