// 360° audit report as a Word document (.doc — Word opens this HTML natively, with tables, colours and page margins).
import type { AuditCheck, AuditStatus } from "./audit360";
import { fixFor } from "./auditFix";

type Section = { key: AuditCheck["section"]; title: string; note: string };
const LABEL: Record<AuditStatus, [string, string, string]> = {
  ok: ["Matched", "#E3F3EC", "#0B5E42"], warn: ["Check", "#FBF1DA", "#7A5300"], fail: ["Problem", "#FBE3DE", "#8A2A1A"], na: ["Not checked", "#EEF0EF", "#5E6B66"],
};
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const amt = (n: number | null | undefined) => n == null ? "" : `${Number(n) < 0 ? "−" : ""}₹${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-IN")}`;

export function auditReportDoc(o: { business: string; fy: string; score: number; counts: Record<AuditStatus, number>; checks: AuditCheck[]; sections: Section[] }): Blob {
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const pill = (s: AuditStatus) => `<span style="background:${LABEL[s][1]};color:${LABEL[s][2]};padding:1pt 6pt;font-weight:bold;font-size:8.5pt">${LABEL[s][0]}</span>`;
  const sec = o.sections.map(s => {
    const cs = o.checks.filter(c => c.section === s.key);
    if (!cs.length) return "";
    const rows = cs.map(c => `
      <tr>
        <td style="width:24%"><b>${esc(c.title)}</b></td>
        <td style="width:11%;text-align:center">${pill(c.status)}</td>
        <td style="width:11%" class="n">${c.books != null ? amt(c.books) : ""}</td>
        <td style="width:11%" class="n">${c.portal != null ? amt(c.portal) : ""}</td>
        <td style="width:10%" class="n">${c.diff ? amt(c.diff) : ""}</td>
        <td style="width:33%">${esc(c.summary)}${c.law ? `<br/><span class="law">${esc(c.law)}</span>` : ""}</td>
      </tr>`).join("");
    // Findings one by one: what was found, the rule, the suggested correction, and the entries behind it
    const open = cs.filter(c => c.status === "warn" || c.status === "fail");
    const findings = open.map((c, i) => {
      const f = fixFor(c);
      const list = c.items.slice(0, 50);
      return `
      <table class="f" style="width:100%;border-collapse:collapse;margin:8pt 0 2pt"><tr>
        <td style="width:4%;vertical-align:top;font-family:'Book Antiqua',Georgia,serif;font-size:13pt;color:#8A6420">${i + 1}.</td>
        <td style="vertical-align:top">
          <p style="margin:0"><b style="font-size:11pt">${esc(c.title)}</b> &nbsp;${pill(c.status)}</p>
          <p style="margin:3pt 0 0"><b>Finding:</b> ${esc(c.summary)}</p>
          ${c.books != null || c.portal != null ? `<p style="margin:2pt 0 0" class="law">Books ${amt(c.books ?? 0)} · Portal ${amt(c.portal ?? 0)} · Difference ${amt(c.diff ?? 0)}</p>` : ""}
          ${c.law ? `<p style="margin:2pt 0 0" class="law"><b>Rule:</b> ${esc(c.law)}</p>` : ""}
          ${f ? `<p style="margin:4pt 0 0;padding:4pt 6pt;background:#FBF7EE;border-left:2pt solid #D9B56F"><b style="color:#8A6420">Suggested correction:</b> ${esc(f.text)}</p>` : ""}
          ${list.length ? `
          <table class="t" style="margin-top:4pt">
            <tr><th style="width:5%">#</th><th style="width:16%">Entry</th><th style="width:12%">Date</th><th style="width:14%" class="n">Amount</th><th>Detail</th></tr>
            ${list.map((it, k) => `<tr><td>${k + 1}</td><td>${esc(it.entry_no ?? "")}</td><td>${esc(it.date ?? "")}</td><td class="n">${it.amount != null ? amt(it.amount) : ""}</td><td>${esc(it.note)}</td></tr>`).join("")}
          </table>${c.items.length > list.length ? `<p class="law">…and ${c.items.length - list.length} more (see the Excel report).</p>` : ""}` : ""}
        </td></tr></table>`;
    }).join("");
    return `
      <h2>${esc(s.title)}</h2>
      <p class="note">${esc(s.note)}</p>
      <table class="t">
        <tr><th>Check</th><th style="text-align:center">Result</th><th class="n">Books</th><th class="n">Portal</th><th class="n">Difference</th><th>Finding and rule</th></tr>
        ${rows}
      </table>
      ${findings ? `<p class="sub">Findings and suggested corrections</p>${findings}` : ""}`;
  }).join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>360° Audit — ${esc(o.business)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 54pt 48pt 54pt 48pt; }
  div.Section1 { page: Section1; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #10241F; }
  h1 { font-family: 'Book Antiqua', Georgia, serif; font-size: 22pt; font-weight: normal; color: #0F2B25; margin: 0 0 2pt; }
  h2 { font-family: 'Book Antiqua', Georgia, serif; font-size: 14pt; font-weight: normal; color: #0F2B25; margin: 16pt 0 2pt; border-bottom: 1pt solid #D9B56F; padding-bottom: 2pt; }
  .eyebrow { font-size: 8pt; letter-spacing: 2pt; color: #8A6420; text-transform: uppercase; margin: 0; }
  .note { color: #5E6B66; margin: 0 0 6pt; }
  .sub { font-weight: bold; color: #5E6B66; margin: 8pt 0 3pt; font-size: 9pt; }
  .law { color: #5E6B66; font-size: 8.5pt; }
  table.t { width: 100%; border-collapse: collapse; margin: 0 0 4pt; }
  table.t th { background: #0F2B25; color: #FFFFFF; font-size: 8.5pt; text-align: left; padding: 4pt 6pt; border: 0.5pt solid #0F2B25; }
  table.t td { padding: 4pt 6pt; border: 0.5pt solid #E6DFD0; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  table.k td { border: 0.5pt solid #E6DFD0; padding: 6pt 10pt; text-align: center; }
  .big { font-family: 'Book Antiqua', Georgia, serif; font-size: 18pt; }
</style></head><body><div class="Section1">
  <p class="eyebrow">360° Audit · ${esc(o.fy)}</p>
  <h1>${esc(o.business)}</h1>
  <p class="note">Prepared on ${today} from the posted entries in FreBook. Portal files are compared, not stored. Nothing in the books was changed.</p>
  <table class="k" style="width:100%;border-collapse:collapse"><tr>
    <td><div class="big">${o.score}/100</div>Audit score</td>
    <td style="color:#0B5E42"><div class="big">${o.counts.ok ?? 0}</div>Matched</td>
    <td style="color:#7A5300"><div class="big">${o.counts.warn ?? 0}</div>To check</td>
    <td style="color:#8A2A1A"><div class="big">${o.counts.fail ?? 0}</div>Problems</td>
    <td style="color:#5E6B66"><div class="big">${o.counts.na ?? 0}</div>Not checked</td>
  </tr></table>
  ${sec}
  <p class="note" style="margin-top:14pt">Amounts in ₹. Checks marked "Not checked" need the portal file (GSTR-1, GSTR-3B, GSTR-2B, 26AS / AIS) uploaded on the 360° Audit page.</p>
</div></body></html>`;
  return new Blob(["﻿", html], { type: "application/msword" });
}
