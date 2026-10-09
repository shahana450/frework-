"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTally } from "@/lib/tallyConnection";
import TallyBar from "@/components/TallyBar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { tallyFetch, parseTallyVouchers, tallyVoucherTypeToFP, monthsInRange, VOUCHER_FETCH_XML } from "@/lib/tallyUtils";
import { tallyProblem } from "@/lib/integrations/tally";
import { readActiveBusiness } from "@/lib/activeBusiness";

const DUTIES_LEDGERS_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_DutyLedgers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_DutyLedgers" ISMODIFY="No"><TYPE>Ledger</TYPE><CHILDOF>$$GroupDutiesTaxes</CHILDOF><BELONGSTO>Yes</BELONGSTO><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
const xmlDecode = (s: string) => s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();

// ── Types ────────────────────────────────────────────────────────────────────
type FY = { id: string; label: string; is_current: boolean; start_date: string; end_date: string };
type GSTLine = {
  journal_id: string; entry_no: string; date: string; narration: string;
  jType: string; reference_no: string | null;
  account_name: string; dr: number; cr: number;
  gstCategory: "output" | "input"; gstType: "cgst" | "sgst" | "igst" | "other";
  amount: number;
};
type MonthSummary = {
  month: string; label: string;
  outputCGST: number; outputSGST: number; outputIGST: number; outputOther: number;
  inputCGST: number; inputSGST: number; inputIGST: number; inputOther: number;
  outputTotal: number; inputTotal: number; netPayable: number;
};
type PortalInvoice = {
  gstin: string; trade_name: string; invoice_no: string; invoice_date: string;
  taxable_value: number; cgst: number; sgst: number; igst: number;
  matched?: boolean; matchedEntry?: string; source?: "2a" | "2b" | "tally_xls";
};
type TallyXLSRow = {
  date: string; voucherType: string; voucherNo: string; narration: string;
  party: string; amount: number; cgst: number; sgst: number; igst: number;
  matched?: boolean; matchedEntry?: string;
};
type GSTR3BSummary = {
  ret_period: string;
  output: { taxable: number; cgst: number; sgst: number; igst: number };
  itc_avail: { cgst: number; sgst: number; igst: number };
  itc_reversed: { cgst: number; sgst: number; igst: number };
  net_itc: { cgst: number; sgst: number; igst: number };
  tax_payable: { cgst: number; sgst: number; igst: number };
  tax_paid: { cgst: number; sgst: number; igst: number };
};
type BizSettings = {
  gstin: string; gst_username: string; gst_trade_name: string;
};

// ── Constants ────────────────────────────────────────────────────────────────
const BG = "#F5F6FA", CARD = "#FFFFFF", BORDER = "rgba(20,26,58,0.11)";
const GOLD = "#232A63", GREEN = "#0B7A55", RED = "#C2321F", BLUE = "#1F5EFF";
const PURPLE = "#5B4BC4", AMBER = "#8A5A00";
const TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.70)";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtS = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function isGSTAccount(name: string): { category: "output" | "input"; gstType: "cgst" | "sgst" | "igst" | "other" } | null {
  const n = name.toLowerCase();
  if (/\b(tds|tcs)\b|professional tax|income tax|advance tax/.test(n)) return null;
  const isCGST = n.includes("cgst") || (n.includes("central") && n.includes("gst"));
  const isSGST = n.includes("sgst") || n.includes("utgst") || (n.includes("state") && n.includes("gst"));
  const isIGST = n.includes("igst") || (n.includes("integrated") && n.includes("gst"));
  const isInput = n.includes("input") || n.includes("itc") || n.includes("tax credit") || n.includes("receivable") || n.includes("claimable");
  const isOutput = n.includes("output") || n.includes("payable") || n.includes("collected");
  const isGeneric = n.includes("gst") || n.includes("input tax") || n.includes("output tax") || n.includes("itc") || n.includes("tax credit") || n.includes("cess");
  if (!(isCGST || isSGST || isIGST || isGeneric)) return null;
  if (!(isCGST || isSGST || isIGST) && !isInput && !isOutput) return null;
  const category = isInput ? "input" : "output";
  return { category, gstType: isCGST ? "cgst" : isSGST ? "sgst" : isIGST ? "igst" : "other" };
}

function groupByMonth(lines: GSTLine[]): MonthSummary[] {
  const map = new Map<string, MonthSummary>();
  for (const l of lines) {
    const month = l.date.slice(0, 7);
    const label = new Date(month + "-01").toLocaleString("en-IN", { month: "short", year: "numeric" });
    if (!map.has(month)) map.set(month, { month, label, outputCGST:0,outputSGST:0,outputIGST:0,outputOther:0,inputCGST:0,inputSGST:0,inputIGST:0,inputOther:0,outputTotal:0,inputTotal:0,netPayable:0 });
    const r = map.get(month)!;
    if (l.gstCategory === "output") { if(l.gstType==="cgst") r.outputCGST+=l.amount; else if(l.gstType==="sgst") r.outputSGST+=l.amount; else if(l.gstType==="igst") r.outputIGST+=l.amount; else r.outputOther+=l.amount; }
    else { if(l.gstType==="cgst") r.inputCGST+=l.amount; else if(l.gstType==="sgst") r.inputSGST+=l.amount; else if(l.gstType==="igst") r.inputIGST+=l.amount; else r.inputOther+=l.amount; }
  }
  for (const r of map.values()) { r.outputTotal=r.outputCGST+r.outputSGST+r.outputIGST+r.outputOther; r.inputTotal=r.inputCGST+r.inputSGST+r.inputIGST+r.inputOther; r.netPayable=r.outputTotal-r.inputTotal; }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,v])=>v);
}

// Parse GSTR-2A or GSTR-2B JSON
function parseGSTRJson(json: unknown): PortalInvoice[] {
  const j = json as Record<string, unknown>;
  const invoices: PortalInvoice[] = [];
  const b2b = (j?.data as Record<string,unknown>)?.docdata as Record<string,unknown>[] ?? (j?.b2b as Record<string,unknown>[]) ?? [];
  for (const sup of b2b) {
    const gstin = (sup.ctin ?? sup.gstin ?? "") as string;
    const tradeName = (sup.trdnm ?? sup.trade_name ?? "") as string;
    for (const inv of ((sup.inv ?? sup.invoices ?? []) as Record<string,unknown>[])) {
      const taxable = Number(inv.val ?? inv.txval ?? 0);
      let cgst=0,sgst=0,igst=0;
      for (const item of ((inv.itms ?? inv.items ?? []) as Record<string,unknown>[])) {
        const d = (item.itm_det ?? item) as Record<string,unknown>;
        cgst+=Number(d.camt??d.cgst??0); sgst+=Number(d.samt??d.sgst??0); igst+=Number(d.iamt??d.igst??0);
      }
      invoices.push({ gstin, trade_name:tradeName, invoice_no:(inv.inum??inv.invoice_no??"") as string, invoice_date:(inv.idt??inv.invoice_date??"") as string, taxable_value:taxable, cgst, sgst, igst, source:"2b" });
    }
  }
  return invoices;
}

// Parse GSTR-3B JSON
function parseGSTR3B(json: unknown): GSTR3BSummary | null {
  try {
    const j = json as Record<string, unknown>;
    const root = (j?.data ?? j) as Record<string, unknown>;
    const ret_period = (root?.ret_period ?? root?.fp ?? "") as string;
    const sup = (root?.sup_details ?? {}) as Record<string, Record<string, number>>;
    const osup = sup?.osup_det ?? {};
    const itc_elg = (root?.itc_elg ?? {}) as Record<string, unknown[]>;
    const avl = (itc_elg?.itc_avl ?? []) as Record<string, number>[];
    const rev = (itc_elg?.itc_rev ?? []) as Record<string, number>[];
    const intr = (root?.intr_ltfee ?? {}) as Record<string, unknown>;
    const intr_dtls = ((intr?.intr_det ?? []) as Record<string, number>[]);
    // Sum all ITC available rows (IMPG, IMPS, ISRC, ISD, OTH)
    type Tax = { cgst: number; sgst: number; igst: number };
    const sumTax = (rows: Record<string, number>[]): Tax => rows.reduce<Tax>((a, r) => ({ cgst: a.cgst + (r.camt ?? 0), sgst: a.sgst + (r.samt ?? 0), igst: a.igst + (r.iamt ?? 0) }), { cgst: 0, sgst: 0, igst: 0 });
    const itc_a = sumTax(avl);
    const itc_r = sumTax(rev);
    const tax_pay = (root?.tax_pay ?? {}) as Record<string, unknown[]>;
    const payable = ((tax_pay?.itc ?? []) as Record<string, number>[]).reduce<Tax>((a, r) => ({ cgst: a.cgst + (r.csamt ?? 0), sgst: a.sgst + (r.samt ?? 0), igst: a.igst + (r.iamt ?? 0) }), { cgst: 0, sgst: 0, igst: 0 });
    void intr_dtls;
    return {
      ret_period,
      output: { taxable: osup.txval ?? 0, cgst: osup.camt ?? 0, sgst: osup.samt ?? 0, igst: osup.iamt ?? 0 },
      itc_avail: itc_a,
      itc_reversed: itc_r,
      net_itc: { cgst: itc_a.cgst - itc_r.cgst, sgst: itc_a.sgst - itc_r.sgst, igst: itc_a.igst - itc_r.igst },
      tax_payable: payable,
      tax_paid: payable,
    };
  } catch { return null; }
}

// Parse Tally Day Book Excel (tab-separated or comma-separated export)
function parseTallyXLS(text: string): TallyXLSRow[] {
  const rows: TallyXLSRow[] = [];
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  // Find header row
  let headerIdx = -1;
  for (let i=0;i<Math.min(20,lines.length);i++) {
    const l = lines[i].toLowerCase();
    if ((l.includes("date") || l.includes("voucher")) && (l.includes("amount") || l.includes("debit") || l.includes("credit"))) { headerIdx=i; break; }
  }
  if (headerIdx<0) return [];
  const sep = lines[headerIdx].includes("\t") ? "\t" : ",";
  const headers = lines[headerIdx].split(sep).map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,""));
  const idx = (keys: string[]) => { for(const k of keys){const i=headers.findIndex(h=>h.includes(k));if(i>=0)return i;} return -1; };
  const iDate=idx(["date"]), iVType=idx(["vouchertype","vtype","type"]), iVNo=idx(["voucherno","vno","number"]);
  const iNarr=idx(["narration","particulars","remarks"]), iParty=idx(["party","ledger","account"]);
  const iAmt=idx(["amount","total","net"]), iDr=idx(["debit","dr"]), iCr=idx(["credit","cr"]);
  const iCGST=idx(["cgst"]), iSGST=idx(["sgst"]), iIGST=idx(["igst"]);

  for (let i=headerIdx+1;i<lines.length;i++) {
    const cols = lines[i].split(sep).map(c=>c.trim().replace(/^"|"$/g,""));
    if (cols.length<3) continue;
    const get = (idx: number) => idx>=0 ? cols[idx]??"" : "";
    const getNum = (idx: number) => { const v=get(idx).replace(/[₹,\s]/g,""); return parseFloat(v)||0; };
    const rawDate = get(iDate);
    if (!rawDate || rawDate.toLowerCase().includes("date")) continue;
    let date = "";
    // Parse Indian date formats: DD-MM-YYYY, DD/MM/YYYY, DD-MMM-YYYY
    const dm = rawDate.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/) ?? rawDate.match(/(\d{1,2})[-\/]([A-Za-z]+)[-\/](\d{2,4})/);
    if (dm) {
      const months: Record<string,string> = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
      const month = /[a-z]/i.test(dm[2]) ? months[dm[2].toLowerCase().slice(0,3)]??"01" : dm[2].padStart(2,"0");
      const year = dm[3].length===2 ? "20"+dm[3] : dm[3];
      date = `${year}-${month}-${dm[1].padStart(2,"0")}`;
    }
    if (!date) continue;
    const amt = getNum(iAmt) || getNum(iDr) || getNum(iCr);
    rows.push({ date, voucherType:get(iVType)||"Journal", voucherNo:get(iVNo), narration:get(iNarr), party:get(iParty), amount:amt, cgst:getNum(iCGST), sgst:getNum(iSGST), igst:getNum(iIGST) });
  }
  return rows;
}

export default function GSTReconPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string|null>(null);
  const [bizName, setBizName] = useState("");
  const [fys, setFys] = useState<FY[]>([]);
  const [selectedFy, setSelectedFy] = useState<FY|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary"|"recon3b"|"itc"|"output"|"portal"|"tally_xls">("summary");
  const [gstLines, setGstLines] = useState<GSTLine[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthSummary[]>([]);
  const [portalInvoices, setPortalInvoices] = useState<PortalInvoice[]>([]);
  const [tallyRows, setTallyRows] = useState<TallyXLSRow[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");
  const [settings, setSettings] = useState<BizSettings>({ gstin:"", gst_username:"", gst_trade_name:"" });
  const [showCredModal, setShowCredModal] = useState(false);
  const [credForm, setCredForm] = useState({ gst_username:"", gst_trade_name:"" });
  const [credSaving, setCredSaving] = useState(false);
  const [gstr3b, setGstr3b] = useState<GSTR3BSummary|null>(null);
  // Portal OTP flow state
  const [portalPanel, setPortalPanel] = useState(false);
  const [portalPassword, setPortalPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpStep, setOtpStep] = useState<"idle"|"sending"|"otp"|"verifying"|"fetching"|"done"|"error">("idle");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [retPeriod, setRetPeriod] = useState("");
  const [tallyImporting, setTallyImporting] = useState(false);
  const [tallyPanel, setTallyPanel] = useState(false);
  // The app-wide Tally connection (port and company are set on the Tally page)
  const tally = useTally();
  const tallyPort = tally.port, tallyConn = tally.status;
  const fileRef = useRef<HTMLInputElement>(null);
  const tallyXlsRef = useRef<HTMLInputElement>(null);
  const gstr3bRef = useRef<HTMLInputElement>(null);
  const bizIdRef = useRef<string|null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled=false;
    supabase.auth.getUser().then(async({data:{user}})=>{
      if(!user||cancelled){if(!user)router.replace("/login");return;}
      const saved=(readActiveBusiness(user.id)??"").replace(/﻿/g,"").trim();
      if(!saved){router.push("/finance/setup");return;}
      bizIdRef.current=saved; setBizId(saved);
      const{data:biz}=await supabase.from("fw_fin_businesses").select("name,gstin,gst_username,gst_trade_name").eq("id",saved).single();
      if(!cancelled&&biz){
        setBizName(biz.name);
        setSettings({ gstin:biz.gstin??"", gst_username:biz.gst_username??"", gst_trade_name:biz.gst_trade_name??"" });
        setCredForm({ gst_username:biz.gst_username??"", gst_trade_name:biz.gst_trade_name??"" });
      }
      const{data:fysData}=await supabase.from("fw_fin_financial_years").select("id,label,is_current,start_date,end_date").eq("business_id",saved).order("start_date",{ascending:false});
      if(!cancelled&&fysData?.length){setFys(fysData);setSelectedFy(fysData.find(f=>f.is_current)??fysData[0]);}
    });
    return()=>{cancelled=true;};
  },[]);

  // ── Load GST journal lines ────────────────────────────────────────────────
  const loadGSTLines = useCallback(async(fy:FY)=>{
    const bid=bizIdRef.current; if(!bid)return;
    setLoading(true); setGstLines([]); setMonthSummary([]);
    const{data:allAccounts}=await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id",bid).eq("is_group",false);
    const gstAccIds=(allAccounts??[]).filter(a=>isGSTAccount(a.name)!==null).map(a=>a.id);
    const accMap=new Map((allAccounts??[]).map(a=>[a.id,a]));
    if(!gstAccIds.length){setLoading(false);return;}
    const{data:jLines}=await supabase.from("fw_fin_journal_lines").select("journal_id,account_id,dr_amount,cr_amount").in("account_id",gstAccIds);
    if(!jLines?.length){setLoading(false);return;}
    const journalIds=[...new Set(jLines.map(l=>l.journal_id))];
    const{data:journals}=await supabase.from("fw_fin_journals").select("id,entry_no,date,narration,type,reference_no,status").in("id",journalIds).eq("business_id",bid).gte("date",fy.start_date).lte("date",fy.end_date).eq("status","posted").order("date");
    if(!journals?.length){setLoading(false);return;}
    const jMap=new Map(journals.map(j=>[j.id,j]));
    const lines:GSTLine[]=[];
    for(const l of jLines){
      const j=jMap.get(l.journal_id); if(!j)continue;
      const acc=accMap.get(l.account_id); if(!acc)continue;
      const g=isGSTAccount(acc.name); if(!g)continue;
      const amount=g.category==="output"?l.cr_amount-l.dr_amount:l.dr_amount-l.cr_amount;
      if(Math.abs(amount)<0.01)continue;
      lines.push({journal_id:l.journal_id,entry_no:j.entry_no,date:j.date,narration:j.narration,jType:j.type,reference_no:j.reference_no,account_name:acc.name,dr:l.dr_amount,cr:l.cr_amount,gstCategory:g.category,gstType:g.gstType,amount:Math.abs(amount)});
    }
    lines.sort((a,b)=>a.date.localeCompare(b.date));
    setGstLines(lines); setMonthSummary(groupByMonth(lines)); setLoading(false);
  },[]);

  useEffect(()=>{if(selectedFy&&bizId)loadGSTLines(selectedFy);},[selectedFy,bizId,loadGSTLines]);

  // ── Save GST credentials ─────────────────────────────────────────────────
  async function saveCredentials(){
    const bid=bizIdRef.current; if(!bid)return;
    setCredSaving(true);
    await supabase.from("fw_fin_businesses").update({ gst_username:credForm.gst_username, gst_trade_name:credForm.gst_trade_name }).eq("id",bid);
    setSettings(s=>({...s,gst_username:credForm.gst_username,gst_trade_name:credForm.gst_trade_name}));
    setCredSaving(false); setShowCredModal(false);
  }

  // ── GST Portal server-side OTP flow ──────────────────────────────────────
  function openPortalPanel(){
    if(!settings.gst_username){setShowCredModal(true);return;}
    setPortalPanel(true); setOtpStep("idle"); setOtpError(""); setOtpValue("");
  }

  // Derive ret_period from selected FY (e.g. "042025" for Apr 2025, or current month)
  function currentRetPeriod(): string {
    const now = new Date();
    const mm = String(now.getMonth()+1).padStart(2,"0");
    const yyyy = String(now.getFullYear());
    return mm + yyyy;
  }

  async function sendOTP(){
    setOtpStep("sending"); setOtpError("");
    const rp = currentRetPeriod(); setRetPeriod(rp);
    try {
      const res = await fetch("/api/finance/gst-portal", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"sendOTP", username: settings.gst_username }),
      });
      const data = await res.json();
      if(data.ok){ setSessionId(data.sessionid ?? ""); setOtpStep("otp"); }
      else { setOtpError(data.error ?? "Failed to send OTP"); setOtpStep("error"); }
    } catch(e){ setOtpError(e instanceof Error ? e.message : "Network error"); setOtpStep("error"); }
  }

  async function verifyOTP(){
    if(!otpValue||otpValue.length<4){ setOtpError("Enter the OTP from your mobile"); return; }
    setOtpStep("verifying"); setOtpError("");
    try {
      const res = await fetch("/api/finance/gst-portal", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"verifyOTP", username: settings.gst_username, otp: otpValue, sessionid: sessionId }),
      });
      const data = await res.json();
      if(data.ok && data.auth_token){
        setAuthToken(data.auth_token);
        await fetchPortalData(data.auth_token);
      } else {
        setOtpError(data.error ?? "OTP verification failed"); setOtpStep("otp");
      }
    } catch(e){ setOtpError(e instanceof Error ? e.message : "Network error"); setOtpStep("otp"); }
  }

  async function fetchPortalData(token: string){
    setOtpStep("fetching"); setOtpError("");
    const gstin = settings.gstin;
    const rp = retPeriod || currentRetPeriod();
    try {
      // Fetch GSTR-2B
      const r2b = await fetch("/api/finance/gst-portal", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"fetch2B", gstin, auth_token: token, ret_period: rp }),
      });
      const d2b = await r2b.json();
      if(d2b.ok && d2b.data){
        const invoices = parseGSTRJson(d2b.data);
        const matched = invoices.map(inv=>({...inv, matched: gstLines.some(l=>l.reference_no&&norm(l.reference_no)===norm(inv.invoice_no)), matchedEntry: gstLines.find(l=>l.reference_no&&norm(l.reference_no)===norm(inv.invoice_no))?.entry_no }));
        setPortalInvoices(matched);
        setUploadMsg(`✓ GSTR-2B: ${matched.length} invoices auto-fetched — ${matched.filter(i=>i.matched).length} matched`);
      }
      // Fetch GSTR-3B
      const r3b = await fetch("/api/finance/gst-portal", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"fetch3B", gstin, auth_token: token, ret_period: rp }),
      });
      const d3b = await r3b.json();
      if(d3b.ok && d3b.data){ const s = parseGSTR3B(d3b.data); if(s) setGstr3b(s); }
      setOtpStep("done"); setPortalPanel(false);
      if(portalInvoices.length>0||gstr3b) setTab("recon3b");
    } catch(e){ setOtpError(e instanceof Error ? e.message : "Fetch failed"); setOtpStep("error"); }
  }

  // ── Import GST ledgers (Duties & Taxes) directly from Tally ──────────────
  async function importGSTFromTally(){
    if(!selectedFy||tallyImporting)return;
    setTallyImporting(true); setUploadMsg("Connecting to Tally…");
    const tallyUrl=`http://localhost:${tallyPort}`;
    try{
      // 1. Ledgers under Duties & Taxes
      const gstLedgers=new Map<string,{category:"output"|"input";gstType:GSTLine["gstType"]}>();
      try{
        const res=await tallyFetch(tallyUrl,DUTIES_LEDGERS_XML,15000);
        const xml=await res.text();
        const re=/<LEDGER\s+NAME="([^"]+)"/gi; let m;
        while((m=re.exec(xml))!==null){
          const name=xmlDecode(m[1]); const g=isGSTAccount(name);
          if(g)gstLedgers.set(name.toLowerCase(),g);
        }
      }catch{ /* fall back to name matching on voucher ledgers */ }
      const byName=gstLedgers.size>0;
      setUploadMsg(byName?`Found ${gstLedgers.size} GST ledgers under Duties & Taxes — fetching vouchers…`:"Fetching vouchers…");

      // 2. Vouchers month by month for the selected FY
      const months=monthsInRange(selectedFy.start_date,selectedFy.end_date);
      const lines:GSTLine[]=[];
      for(let i=0;i<months.length;i++){
        const{from,to,label}=months[i];
        setUploadMsg(`Fetching ${label} from Tally (${i+1}/${months.length})…`);
        try{
          const res=await tallyFetch(tallyUrl,VOUCHER_FETCH_XML(from.replace(/-/g,""),to.replace(/-/g,"")),30000);
          const vouchers=parseTallyVouchers(await res.text());
          vouchers.forEach((v,vi)=>{
            for(const l of v.lines){
              const name=xmlDecode(l.ledgerName);
              const g=byName?gstLedgers.get(name.toLowerCase()):isGSTAccount(name);
              if(!g)continue;
              const dr=l.isDeemed?l.amount:0, cr=l.isDeemed?0:l.amount;
              lines.push({journal_id:`tally-${from}-${vi}`,entry_no:`${v.voucherType} ${v.voucherNumber}`.trim(),date:v.date,narration:xmlDecode(v.narration),jType:tallyVoucherTypeToFP(v.voucherType),reference_no:v.voucherNumber||null,account_name:name,dr,cr,gstCategory:g.category,gstType:g.gstType,amount:l.amount});
            }
          });
        }catch{ /* skip month */ }
      }
      if(!lines.length){setUploadMsg("No GST entries found in Tally for this FY. Check the correct company is open in Tally and that GST ledgers sit under Duties & Taxes.");return;}
      lines.sort((a,b)=>a.date.localeCompare(b.date));
      setGstLines(lines); setMonthSummary(groupByMonth(lines)); setLoading(false);
      const inp=lines.filter(l=>l.gstCategory==="input").length;
      setUploadMsg(`✓ Imported from Tally: ${inp} input GST (ITC) entries, ${lines.length-inp} output GST entries`);
      setTab("summary");
    }catch(e){
      setUploadMsg(e instanceof Error&&/port \d+/.test(e.message)?e.message:tallyProblem(tallyPort,"unreachable"));
    }finally{ setTallyImporting(false); }
  }

  function openGSTPortal(){
    window.open("https://services.gst.gov.in/services/auth/fowelcome","_blank","noopener");
  }

  // ── GSTR-2A/2B JSON upload ────────────────────────────────────────────────
  const handlePortalUpload = useCallback((e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setUploadMsg("Parsing GSTR JSON…");
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const json=JSON.parse(ev.target?.result as string);
        const invoices=parseGSTRJson(json);
        const matched=invoices.map(inv=>({...inv,matched:gstLines.some(l=>l.reference_no&&norm(l.reference_no)===norm(inv.invoice_no)),matchedEntry:gstLines.find(l=>l.reference_no&&norm(l.reference_no)===norm(inv.invoice_no))?.entry_no}));
        setPortalInvoices(matched);
        setUploadMsg(`✓ ${matched.length} invoices loaded — ${matched.filter(i=>i.matched).length} matched, ${matched.filter(i=>!i.matched).length} unmatched`);
        setTab("portal");
      }catch{setUploadMsg("Invalid file. Download GSTR-2A/2B JSON from GST Portal.");}
    };
    reader.readAsText(file); e.target.value="";
  },[gstLines]);

  // ── GSTR-3B JSON upload ───────────────────────────────────────────────────
  const handleGSTR3BUpload = useCallback((e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setUploadMsg("Parsing GSTR-3B…");
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const json=JSON.parse(ev.target?.result as string);
        const s=parseGSTR3B(json);
        if(!s){setUploadMsg("Could not parse GSTR-3B. Upload the JSON downloaded from GST portal.");return;}
        setGstr3b(s);
        setUploadMsg(`✓ GSTR-3B loaded for period ${s.ret_period}`);
        setTab("recon3b");
      }catch{setUploadMsg("Invalid GSTR-3B JSON.");}
    };
    reader.readAsText(file); e.target.value="";
  },[]);

  // ── Tally Excel upload ────────────────────────────────────────────────────
  const handleTallyXLS = useCallback((e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setUploadMsg("Parsing Tally export…");
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const text=ev.target?.result as string;
        const rows=parseTallyXLS(text);
        const matched=rows.map(r=>({...r,matched:gstLines.some(l=>l.reference_no&&norm(l.reference_no)===norm(r.voucherNo)),matchedEntry:gstLines.find(l=>l.reference_no&&norm(l.reference_no)===norm(r.voucherNo))?.entry_no}));
        setTallyRows(matched);
        setUploadMsg(`✓ ${matched.length} Tally vouchers loaded — ${matched.filter(r=>r.matched).length} matched with books`);
        setTab("tally_xls");
      }catch{setUploadMsg("Could not parse Tally export. Export Day Book as CSV/TXT from Tally.");}
    };
    reader.readAsText(file); e.target.value="";
  },[gstLines]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const filtered=filterMonth==="all"?gstLines:gstLines.filter(l=>l.date.startsWith(filterMonth));
  const outputLines=filtered.filter(l=>l.gstCategory==="output");
  const inputLines=filtered.filter(l=>l.gstCategory==="input");
  const totalOutput=outputLines.reduce((s,l)=>s+l.amount,0);
  const totalInput=inputLines.reduce((s,l)=>s+l.amount,0);
  const netPayable=totalOutput-totalInput;
  const months=[...new Set(gstLines.map(l=>l.date.slice(0,7)))].sort();
  const unmatchedPortal=portalInvoices.filter(i=>!i.matched);
  const unmatchedTally=tallyRows.filter(r=>!r.matched);

  // ── Tab style ─────────────────────────────────────────────────────────────
  const tabS=(t:typeof tab)=>({padding:"0.45rem 1rem",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:"0.78rem",background:tab===t?GOLD:"#FFFFFF",color:tab===t?"#F5F6FA":MUTED,transition:"all 0.15s"} as React.CSSProperties);

  const TH=({children,right}:{children:React.ReactNode;right?:boolean})=>(
    <th style={{padding:"0.5rem 0.75rem",textAlign:right?"right":"left",color:MUTED,fontWeight:700,fontSize:"0.62rem",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{children}</th>
  );

  return (
    <div style={{minHeight:"100vh",background:BG,color:TEXT,fontFamily:"'Manrope',system-ui,sans-serif"}}>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{borderBottom:`1px solid ${BORDER}`,padding:"0 1.5rem",display:"flex",alignItems:"center",gap:"0.6rem",height:52,background:"rgba(255,255,255,0.98)",position:"sticky",top:0,zIndex:30}}>
        <Link href="/finance" style={{color:GOLD,fontWeight:700,textDecoration:"none",fontSize:"0.88rem"}}>FreWork</Link>
        <span style={{color:MUTED}}>›</span>
        <Link href="/finance/audit" style={{color:MUTED,textDecoration:"none",fontSize:"0.82rem"}}>Audit</Link>
        <span style={{color:MUTED}}>›</span>
        <span style={{color:TEXT,fontSize:"0.82rem",fontWeight:600}}>GST Reconciliation</span>
        <div style={{flex:1}}/>
        {/* GST credentials button */}
        <button onClick={()=>setShowCredModal(true)} style={{background:settings.gst_username?"rgba(11,122,85,0.08)":"rgba(35,42,99,0.08)",border:`1px solid ${settings.gst_username?"rgba(11,122,85,0.25)":"rgba(35,42,99,0.25)"}`,color:settings.gst_username?GREEN:GOLD,padding:"5px 12px",borderRadius:8,fontWeight:600,fontSize:"0.75rem",cursor:"pointer",fontFamily:"inherit"}}>
          {settings.gst_username?`✓ ${settings.gst_username}`:"⚙ Set GST Credentials"}
        </button>
        {/* FY selector */}
        <select value={selectedFy?.id??""} onChange={e=>{const f=fys.find(x=>x.id===e.target.value);if(f)setSelectedFy(f);}} style={{background:"#FFFFFF",border:`1px solid ${BORDER}`,color:TEXT,padding:"4px 10px",borderRadius:8,fontSize:"0.78rem",fontFamily:"inherit"}}>
          {fys.map(f=><option key={f.id} value={f.id}>{f.label}{f.is_current?" (Current)":""}</option>)}
        </select>
        {/* Upload hidden inputs */}
        <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handlePortalUpload}/>
        <input ref={gstr3bRef} type="file" accept=".json" style={{display:"none"}} onChange={handleGSTR3BUpload}/>
        <input ref={tallyXlsRef} type="file" accept=".csv,.txt,.xls,.xlsx" style={{display:"none"}} onChange={handleTallyXLS}/>
      </nav>

      <div style={{maxWidth:1140,margin:"0 auto",padding:"1.5rem 1.5rem 3rem"}}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{marginBottom:"1.1rem",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"1rem",flexWrap:"wrap"}}>
          <div>
            <h1 style={{fontSize:"1.3rem",fontWeight:700,margin:0}}>{bizName} — GST Reconciliation</h1>
            <div style={{fontSize:"0.78rem",color:MUTED,marginTop:3}}>{selectedFy?.label} · {settings.gstin||"GSTIN not set"}</div>
          </div>
          {/* Data source action buttons */}
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
            <button onClick={()=>setTallyPanel(v=>!v)} style={{background:tallyConn==="connected"?"rgba(11,122,85,0.1)":"rgba(35,42,99,0.1)",border:`1px solid ${tallyConn==="connected"?"rgba(11,122,85,0.3)":"rgba(35,42,99,0.35)"}`,color:tallyConn==="connected"?GREEN:GOLD,padding:"7px 14px",borderRadius:9,fontWeight:700,fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit"}}>
              {tallyConn==="connected"?"● Tally Connected":"🔌 Tally Connector"}
            </button>
            <button onClick={openPortalPanel} style={{background:"rgba(31,94,255,0.1)",border:`1px solid rgba(31,94,255,0.3)`,color:BLUE,padding:"7px 14px",borderRadius:9,fontWeight:700,fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
              🌐 GST Portal Login
            </button>
            <button onClick={()=>fileRef.current?.click()} style={{background:"rgba(91,75,196,0.1)",border:`1px solid rgba(91,75,196,0.3)`,color:PURPLE,padding:"7px 14px",borderRadius:9,fontWeight:700,fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit"}}>
              ↑ Upload GSTR-2A/2B JSON
            </button>
            <button onClick={()=>gstr3bRef.current?.click()} style={{background:"rgba(11,122,85,0.1)",border:`1px solid rgba(11,122,85,0.3)`,color:GREEN,padding:"7px 14px",borderRadius:9,fontWeight:700,fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit"}}>
              ↑ Upload GSTR-3B JSON
            </button>
            <button onClick={()=>tallyXlsRef.current?.click()} style={{background:"rgba(184,120,0,0.1)",border:`1px solid rgba(184,120,0,0.3)`,color:AMBER,padding:"7px 14px",borderRadius:9,fontWeight:700,fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit"}}>
              📊 Upload Tally Excel/CSV
            </button>
          </div>
        </div>

        {/* ── Tally connector panel ──────────────────────────────────────── */}
        {tallyPanel&&(
          <div style={{background:"rgba(35,42,99,0.05)",border:`1px solid rgba(35,42,99,0.25)`,borderRadius:12,padding:"1.25rem 1.5rem",marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
              <div style={{fontWeight:700,fontSize:"0.92rem",color:GOLD}}>🔌 Tally Connector — import GST from Duties &amp; Taxes</div>
              <button onClick={()=>setTallyPanel(false)} style={{background:"none",border:"none",color:MUTED,fontSize:"1.1rem",cursor:"pointer",padding:2}}>✕</button>
            </div>

            <TallyBar returnTo="/finance/audit/gst-recon">
              <button onClick={importGSTFromTally} disabled={tallyImporting||tallyConn!=="connected"} title={tallyConn!=="connected"?"Connect to Tally first":""} style={{background:tallyConn==="connected"?"#0F2B25":"rgba(15,43,37,0.25)",border:"none",color:"#FFFFFF",height:34,padding:"0 16px",borderRadius:9,fontWeight:700,fontSize:"0.8rem",cursor:tallyConn==="connected"?"pointer":"not-allowed",fontFamily:"inherit"}}>
                {tallyImporting?"Importing…":"Import GST for "+(selectedFy?.label??"FY")}
              </button>
            </TallyBar>
          </div>
        )}

        {/* ── GST Portal OTP login panel ──────────────────────────────────── */}
        {portalPanel&&(
          <div style={{background:"rgba(31,94,255,0.05)",border:`1px solid rgba(31,94,255,0.25)`,borderRadius:12,padding:"1.25rem 1.5rem",marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
              <div style={{fontWeight:700,fontSize:"0.92rem",color:BLUE}}>🌐 GST Portal Auto-Fetch — GSTR-2B &amp; GSTR-3B</div>
              <button onClick={()=>{setPortalPanel(false);setOtpStep("idle");setOtpValue("");setOtpError("");}} style={{background:"none",border:"none",color:MUTED,fontSize:"1.1rem",cursor:"pointer",padding:2}}>✕</button>
            </div>

            {/* Step 1: credentials */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem",marginBottom:"1rem"}}>
              <div>
                <div style={{fontSize:"0.65rem",color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Username</div>
                <div style={{background:"#FFFFFF",border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 12px",fontSize:"0.88rem",color:TEXT,fontWeight:600}}>{settings.gst_username}</div>
              </div>
              <div>
                <div style={{fontSize:"0.65rem",color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Password (never stored/sent to us)</div>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <input type={showPassword?"text":"password"} value={portalPassword} onChange={e=>setPortalPassword(e.target.value)} placeholder="Your GST portal password"
                    style={{flex:1,background:"#FFFFFF",border:`1px solid ${BORDER}`,color:TEXT,padding:"9px 12px",borderRadius:8,fontSize:"0.88rem",fontFamily:"inherit",outline:"none"}}/>
                  <button onClick={()=>setShowPassword(v=>!v)} style={{background:"#FFFFFF",border:`1px solid ${BORDER}`,color:MUTED,borderRadius:8,padding:"0 10px",cursor:"pointer",fontSize:"0.78rem",fontFamily:"inherit"}}>{showPassword?"Hide":"Show"}</button>
                </div>
              </div>
            </div>

            {/* Step 2: Send OTP / OTP entry */}
            {(otpStep==="idle"||otpStep==="error")&&(
              <div style={{display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={sendOTP} style={{background:BLUE,color:"#F5F6FA",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",fontFamily:"inherit"}}>
                  📲 Send OTP
                </button>
                <span style={{fontSize:"0.75rem",color:MUTED}}>OTP goes to the registered mobile &amp; email. Enable API access first: gst.gov.in → My Profile → Manage API Access</span>
                <button onClick={openGSTPortal} style={{background:"none",border:`1px solid ${BORDER}`,color:MUTED,borderRadius:8,padding:"8px 14px",fontSize:"0.75rem",cursor:"pointer",fontFamily:"inherit"}}>Open Portal Manually ↗</button>
              </div>
            )}

            {otpStep==="sending"&&(
              <div style={{display:"flex",alignItems:"center",gap:10,color:BLUE,fontSize:"0.84rem"}}>
                <span style={{display:"inline-block",width:14,height:14,border:`2px solid ${BLUE}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                Sending OTP via GST portal for <strong>{settings.gst_username}</strong>…
              </div>
            )}

            {otpStep==="otp"&&(
              <div>
                <div style={{fontSize:"0.8rem",color:GREEN,marginBottom:"0.6rem",fontWeight:600}}>✓ OTP sent to your registered mobile number and email</div>
                <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
                  <input value={otpValue} onChange={e=>setOtpValue(e.target.value.replace(/\D/g,"").slice(0,8))} placeholder="Enter OTP" autoFocus
                    onKeyDown={e=>{if(e.key==="Enter")verifyOTP();}}
                    style={{width:160,background:"#FFFFFF",border:`1px solid ${BORDER}`,color:TEXT,padding:"9px 14px",borderRadius:8,fontSize:"1rem",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.2em",outline:"none",textAlign:"center"}}/>
                  <button onClick={verifyOTP} style={{background:GREEN,color:"#F5F6FA",border:"none",padding:"9px 22px",borderRadius:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:"0.85rem"}}>Verify &amp; Fetch Data</button>
                  <button onClick={sendOTP} style={{background:"none",border:`1px solid ${BORDER}`,color:MUTED,padding:"9px 14px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:"0.78rem"}}>Resend OTP</button>
                </div>
                <div style={{fontSize:"0.72rem",color:MUTED,marginTop:6}}>After verification, GSTR-2B and GSTR-3B will be fetched automatically in the background.</div>
              </div>
            )}

            {otpStep==="verifying"&&(
              <div style={{display:"flex",alignItems:"center",gap:10,color:GREEN,fontSize:"0.84rem"}}>
                <span style={{display:"inline-block",width:14,height:14,border:`2px solid ${GREEN}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                Verifying OTP…
              </div>
            )}

            {otpStep==="fetching"&&(
              <div style={{display:"flex",alignItems:"center",gap:10,color:GREEN,fontSize:"0.84rem"}}>
                <span style={{display:"inline-block",width:14,height:14,border:`2px solid ${GREEN}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                Fetching GSTR-2B and GSTR-3B from portal in background…
              </div>
            )}

            {otpStep==="done"&&(
              <div style={{color:GREEN,fontWeight:700,fontSize:"0.88rem"}}>✓ Data fetched successfully! View in the Reconciliation tab.</div>
            )}

            {otpError&&(
              <div style={{marginTop:"0.6rem",background:"rgba(194,50,31,0.07)",border:`1px solid rgba(194,50,31,0.25)`,borderRadius:8,padding:"0.65rem 1rem",fontSize:"0.8rem"}}>
                <div style={{color:RED,fontWeight:700,marginBottom:4}}>⚠ {otpError}</div>
                <div style={{color:MUTED,lineHeight:1.6}}>
                  If auto-fetch is blocked, download manually from <button onClick={openGSTPortal} style={{background:"none",border:"none",color:BLUE,cursor:"pointer",textDecoration:"underline",padding:0,fontFamily:"inherit",fontSize:"inherit"}}>gst.gov.in</button> and upload the JSON files above.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload status */}
        {uploadMsg&&(
          <div style={{background:"rgba(31,94,255,0.06)",border:`1px solid rgba(31,94,255,0.2)`,borderRadius:8,padding:"0.6rem 1rem",fontSize:"0.8rem",color:BLUE,marginBottom:"0.75rem"}}>{uploadMsg}</div>
        )}

        {loading?(
          <div style={{display:"flex",alignItems:"center",gap:10,color:MUTED,padding:"3rem 0"}}>
            <span style={{display:"inline-block",width:16,height:16,border:`2px solid ${BLUE}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
            Loading GST data from books…
          </div>
        ):gstLines.length===0?(
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"2.5rem",textAlign:"center"}}>
            <div style={{fontSize:"2rem",marginBottom:"0.75rem"}}>🏷️</div>
            <div style={{fontWeight:700,marginBottom:8}}>No GST accounts found in books</div>
            <div style={{color:MUTED,fontSize:"0.84rem",maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
              Pull GST ledgers under <strong>Duties &amp; Taxes</strong> straight from Tally — input GST is treated as ITC, output GST as tax payable.
            </div>
            <button onClick={()=>{setTallyPanel(true);window.scrollTo({top:0,behavior:"smooth"});}} style={{marginTop:"1rem",background:GOLD,border:"none",color:"#F5F6FA",padding:"9px 20px",borderRadius:9,fontWeight:700,fontSize:"0.84rem",cursor:"pointer",fontFamily:"inherit"}}>
              🔌 Connect Tally &amp; Import GST
            </button>
          </div>
        ):(
          <>
            {/* ── Stat cards ─────────────────────────────────────────────── */}
            <div style={{display:"flex",gap:"0.65rem",flexWrap:"wrap",marginBottom:"1rem"}}>
              {[
                {label:"Output GST",val:fmtS(totalOutput),sub:"Tax collected on sales",color:RED},
                {label:"Input ITC",val:fmtS(totalInput),sub:"Tax paid on purchases",color:GREEN},
                {label:"Net Payable",val:fmtS(Math.abs(netPayable)),sub:netPayable>=0?"Payable to Govt":"Excess ITC",color:netPayable>=0?RED:GREEN},
                ...(portalInvoices.length?[{label:"Portal Unmatched",val:`${unmatchedPortal.length}`,sub:"ITC at risk",color:unmatchedPortal.length>0?AMBER:GREEN}]:[]),
                ...(tallyRows.length?[{label:"Tally Unmatched",val:`${unmatchedTally.length}`,sub:"Missing in books",color:unmatchedTally.length>0?AMBER:GREEN}]:[]),
              ].map(c=>(
                <div key={c.label} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"0.9rem 1.15rem",minWidth:145}}>
                  <div style={{fontSize:"0.58rem",color:MUTED,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{c.label}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:"1.2rem",fontWeight:700,color:c.color}}>{c.val}</div>
                  <div style={{fontSize:"0.66rem",color:MUTED,marginTop:3}}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Tabs + month filter ─────────────────────────────────────── */}
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.85rem",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:"0.3rem",background:"#FFFFFF",border:`1px solid ${BORDER}`,borderRadius:10,padding:"3px"}}>
                <button style={tabS("summary")} onClick={()=>setTab("summary")}>Monthly Summary</button>
                <button style={tabS("output")} onClick={()=>setTab("output")}>Output ({outputLines.length})</button>
                <button style={tabS("itc")} onClick={()=>setTab("itc")}>ITC ({inputLines.length})</button>
                {(portalInvoices.length>0||gstr3b)&&<button style={tabS("recon3b")} onClick={()=>setTab("recon3b")}>⚖ Reconciliation</button>}
                {portalInvoices.length>0&&<button style={tabS("portal")} onClick={()=>setTab("portal")}>GSTR-2B ({portalInvoices.length})</button>}
                {tallyRows.length>0&&<button style={tabS("tally_xls")} onClick={()=>setTab("tally_xls")}>Tally ({tallyRows.length})</button>}
              </div>
              <div style={{flex:1}}/>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{background:"#FFFFFF",border:`1px solid ${BORDER}`,color:TEXT,padding:"5px 10px",borderRadius:8,fontSize:"0.78rem",fontFamily:"inherit"}}>
                <option value="all">All Months</option>
                {months.map(m=>{const d=new Date(m+"-01");return(<option key={m} value={m}>{d.toLocaleString("en-IN",{month:"long",year:"numeric"})}</option>);})}
              </select>
            </div>

            {/* ── Monthly Summary tab ─────────────────────────────────────── */}
            {tab==="summary"&&(
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead><tr style={{background:"#FFFFFF",borderBottom:`1px solid ${BORDER}`}}>
                    <TH>Month</TH><TH right>Out.CGST</TH><TH right>Out.SGST</TH><TH right>Out.IGST</TH>
                    <TH right>Total Output</TH><TH right>In.CGST</TH><TH right>In.SGST</TH><TH right>In.IGST</TH>
                    <TH right>Total ITC</TH><TH right>Net Payable</TH>
                  </tr></thead>
                  <tbody>
                    {monthSummary.map((r,i)=>(
                      <tr key={r.month} style={{borderBottom:`1px solid rgba(20,26,58,0.10)`,background:i%2===0?"transparent":"#FFFFFF"}}>
                        <td style={{padding:"0.5rem 0.75rem",fontWeight:600,whiteSpace:"nowrap"}}>{r.label}</td>
                        {[r.outputCGST,r.outputSGST,r.outputIGST].map((v,j)=><td key={j} style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",color:v>0?RED:MUTED}}>{v>0?fmt(v):"—"}</td>)}
                        <td style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:r.outputTotal>0?RED:MUTED}}>{r.outputTotal>0?fmt(r.outputTotal):"—"}</td>
                        {[r.inputCGST,r.inputSGST,r.inputIGST].map((v,j)=><td key={j} style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",color:v>0?GREEN:MUTED}}>{v>0?fmt(v):"—"}</td>)}
                        <td style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:r.inputTotal>0?GREEN:MUTED}}>{r.inputTotal>0?fmt(r.inputTotal):"—"}</td>
                        <td style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:r.netPayable>0?RED:r.netPayable<0?GREEN:MUTED}}>
                          {r.netPayable!==0?(r.netPayable<0?"(":"")+fmt(Math.abs(r.netPayable))+(r.netPayable<0?" ITC)":""):"—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{borderTop:`2px solid rgba(20,26,58,0.15)`,background:"#FFFFFF"}}>
                    <td style={{padding:"0.6rem 0.75rem",fontWeight:700,color:MUTED,fontSize:"0.72rem"}}>TOTAL</td>
                    {[
                      {v:monthSummary.reduce((s,r)=>s+r.outputCGST,0),c:RED},{v:monthSummary.reduce((s,r)=>s+r.outputSGST,0),c:RED},{v:monthSummary.reduce((s,r)=>s+r.outputIGST,0),c:RED},
                      {v:totalOutput,c:RED},
                      {v:monthSummary.reduce((s,r)=>s+r.inputCGST,0),c:GREEN},{v:monthSummary.reduce((s,r)=>s+r.inputSGST,0),c:GREEN},{v:monthSummary.reduce((s,r)=>s+r.inputIGST,0),c:GREEN},
                      {v:totalInput,c:GREEN},{v:netPayable,c:netPayable>=0?RED:GREEN},
                    ].map((c,i)=><td key={i} style={{padding:"0.6rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:c.c,fontSize:"0.84rem"}}>{fmt(Math.abs(c.v))}</td>)}
                  </tr></tfoot>
                </table>
              </div>
            )}

            {/* ── Output / ITC common table ────────────────────────────────── */}
            {(tab==="output"||tab==="itc")&&(()=>{
              const lines=tab==="output"?outputLines:inputLines;
              const total=tab==="output"?totalOutput:totalInput;
              const color=tab==="output"?RED:GREEN;
              const label=tab==="output"?"Output Tax (GST Collected on Sales)":"Input Tax Credit (ITC Claimed)";
              return(
                <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"0.7rem 1rem",borderBottom:`1px solid ${BORDER}`,display:"flex",gap:"1rem",alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:"0.84rem"}}>{label}</span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",color,fontWeight:700}}>{fmt(total)}</span>
                    <span style={{fontSize:"0.7rem",color:MUTED}}>{lines.length} entries</span>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.79rem"}}>
                    <thead><tr style={{background:"#FFFFFF",borderBottom:`1px solid ${BORDER}`}}>
                      <TH>Date</TH><TH>Entry No</TH><TH>Account</TH><TH>Narration</TH><TH>Reference</TH>
                      <TH right>CGST</TH><TH right>SGST</TH><TH right>IGST</TH><TH right>Amount</TH>
                      {tab==="itc"&&portalInvoices.length>0&&<TH right>2B Status</TH>}
                    </tr></thead>
                    <tbody>
                      {lines.map((l,i)=>{
                        const in2b=tab==="itc"&&portalInvoices.length>0?portalInvoices.some(g=>l.reference_no&&norm(l.reference_no)===norm(g.invoice_no)):null;
                        return(
                          <tr key={i} style={{borderBottom:`1px solid rgba(20,26,58,0.10)`,background:i%2===0?"transparent":"#FFFFFF"}}>
                            <td style={{padding:"0.45rem 0.75rem",color:MUTED,whiteSpace:"nowrap"}}>{new Date(l.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</td>
                            <td style={{padding:"0.45rem 0.75rem",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.7rem",color:GOLD,whiteSpace:"nowrap"}}>{l.entry_no}</td>
                            <td style={{padding:"0.45rem 0.75rem",fontSize:"0.77rem"}}>{l.account_name}</td>
                            <td style={{padding:"0.45rem 0.75rem",color:MUTED,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.narration}</td>
                            <td style={{padding:"0.45rem 0.75rem",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.68rem",color:l.reference_no?TEXT:MUTED}}>{l.reference_no??"—"}</td>
                            <td style={{padding:"0.45rem 0.75rem",textAlign:"right",color:l.gstType==="cgst"?color:MUTED}}>{l.gstType==="cgst"?fmt(l.amount):"—"}</td>
                            <td style={{padding:"0.45rem 0.75rem",textAlign:"right",color:l.gstType==="sgst"?color:MUTED}}>{l.gstType==="sgst"?fmt(l.amount):"—"}</td>
                            <td style={{padding:"0.45rem 0.75rem",textAlign:"right",color:l.gstType==="igst"?color:MUTED}}>{l.gstType==="igst"?fmt(l.amount):"—"}</td>
                            <td style={{padding:"0.45rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,color}}>{fmt(l.amount)}</td>
                            {tab==="itc"&&portalInvoices.length>0&&<td style={{padding:"0.45rem 0.75rem",textAlign:"right"}}>{in2b===null?<span style={{color:MUTED}}>—</span>:in2b?<span style={{color:GREEN,fontSize:"0.7rem",fontWeight:700}}>✓ In 2B</span>:<span style={{color:AMBER,fontSize:"0.7rem",fontWeight:700}}>⚠ Missing</span>}</td>}
                          </tr>
                        );
                      })}
                      {lines.length===0&&<tr><td colSpan={10} style={{padding:"2rem",textAlign:"center",color:MUTED}}>No entries for this period.</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ── Reconciliation tab (GSTR-3B vs GSTR-2B vs Books) ──────────── */}
            {tab==="recon3b"&&(()=>{
              // Books ITC totals
              const bkCGST = inputLines.filter(l=>l.gstType==="cgst").reduce((s,l)=>s+l.amount,0);
              const bkSGST = inputLines.filter(l=>l.gstType==="sgst").reduce((s,l)=>s+l.amount,0);
              const bkIGST = inputLines.filter(l=>l.gstType==="igst").reduce((s,l)=>s+l.amount,0);
              const bkTotal = inputLines.reduce((s,l)=>s+l.amount,0);

              // GSTR-2B totals (supplier filed ITC)
              const g2bCGST = portalInvoices.reduce((s,i)=>s+i.cgst,0);
              const g2bSGST = portalInvoices.reduce((s,i)=>s+i.sgst,0);
              const g2bIGST = portalInvoices.reduce((s,i)=>s+i.igst,0);
              const g2bTotal = g2bCGST+g2bSGST+g2bIGST;

              // GSTR-3B net ITC declared
              const g3bCGST = gstr3b?.net_itc.cgst ?? 0;
              const g3bSGST = gstr3b?.net_itc.sgst ?? 0;
              const g3bIGST = gstr3b?.net_itc.igst ?? 0;
              const g3bTotal = g3bCGST+g3bSGST+g3bIGST;

              // Variances
              const var2bVs3bC = g2bCGST-g3bCGST; const var2bVs3bS = g2bSGST-g3bSGST; const var2bVs3bI = g2bIGST-g3bIGST; const var2bVs3b = g2bTotal-g3bTotal;
              const var2bVsBkC = g2bCGST-bkCGST; const var2bVsBkS = g2bSGST-bkSGST; const var2bVsBkI = g2bIGST-bkIGST; const var2bVsBk = g2bTotal-bkTotal;
              const var3bVsBkC = g3bCGST-bkCGST; const var3bVsBkS = g3bSGST-bkSGST; const var3bVsBkI = g3bIGST-bkIGST; const var3bVsBk = g3bTotal-bkTotal;

              const varColor = (v: number) => Math.abs(v)<1 ? GREEN : Math.abs(v)<1000 ? AMBER : RED;
              const varFmt = (v: number) => Math.abs(v)<0.5 ? <span style={{color:GREEN}}>✓ Nil</span> : <span style={{color:varColor(v)}}>{v>0?"+":""}{fmt(v)}</span>;
              const moneyCell = (v: number, color: string) => <td style={{padding:"0.5rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",color:v>0?color:MUTED}}>{v>0?fmt(v):"—"}</td>;

              type ReconRow = { label: string; sub: string; cgst: number; sgst: number; igst: number; total: number; color: string; isVar?: boolean; bold?: boolean };
              const rows: ReconRow[] = [
                ...(g2bTotal>0?[{label:"GSTR-2B",sub:"ITC available per supplier filings",cgst:g2bCGST,sgst:g2bSGST,igst:g2bIGST,total:g2bTotal,color:BLUE}]:[]),
                ...(g3bTotal>0?[{label:"GSTR-3B",sub:"Net ITC declared in return filed",cgst:g3bCGST,sgst:g3bSGST,igst:g3bIGST,total:g3bTotal,color:PURPLE}]:[]),
                {label:"Books (FreWork)",sub:"ITC posted in journal entries",cgst:bkCGST,sgst:bkSGST,igst:bkIGST,total:bkTotal,color:GREEN},
                ...(g2bTotal>0&&g3bTotal>0?[{label:"2B vs 3B Variance",sub:"Excess in GSTR-2B over declared",cgst:var2bVs3bC,sgst:var2bVs3bS,igst:var2bVs3bI,total:var2bVs3b,color:varColor(var2bVs3b),isVar:true}]:[]),
                ...(g2bTotal>0?[{label:"2B vs Books Variance",sub:"ITC available but not yet in books",cgst:var2bVsBkC,sgst:var2bVsBkS,igst:var2bVsBkI,total:var2bVsBk,color:varColor(var2bVsBk),isVar:true}]:[]),
                ...(g3bTotal>0?[{label:"3B vs Books Variance",sub:"Declared in 3B vs. books difference",cgst:var3bVsBkC,sgst:var3bVsBkS,igst:var3bVsBkI,total:var3bVsBk,color:varColor(var3bVsBk),isVar:true}]:[]),
              ];

              const hasIssue = Math.abs(var2bVsBk)>1||Math.abs(var3bVsBk)>1||Math.abs(var2bVs3b)>1;

              return (
                <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                  {/* Summary alert */}
                  <div style={{background:hasIssue?"rgba(184,120,0,0.07)":"rgba(11,122,85,0.07)",border:`1px solid ${hasIssue?"rgba(184,120,0,0.25)":"rgba(11,122,85,0.25)"}`,borderRadius:10,padding:"0.85rem 1.1rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
                    <span style={{fontSize:"1.3rem"}}>{hasIssue?"⚠":"✓"}</span>
                    <div>
                      <div style={{fontWeight:700,color:hasIssue?AMBER:GREEN,fontSize:"0.88rem"}}>
                        {hasIssue?"Reconciliation gaps found — review variances below":"Books, GSTR-3B and GSTR-2B are reconciled"}
                      </div>
                      <div style={{fontSize:"0.75rem",color:MUTED,marginTop:2}}>
                        {gstr3b?.ret_period ? `Period: ${gstr3b.ret_period.slice(0,2)}/${gstr3b.ret_period.slice(2)} · ` : ""}
                        {g2bTotal>0?`${portalInvoices.length} invoices in GSTR-2B · `:""}
                        {inputLines.length} ITC entries in books
                      </div>
                    </div>
                    {(!g2bTotal||!g3bTotal)&&(
                      <div style={{marginLeft:"auto",fontSize:"0.72rem",color:MUTED,textAlign:"right",lineHeight:1.6}}>
                        {!g2bTotal&&<div>⚠ GSTR-2B not loaded — use Portal Login or upload JSON</div>}
                        {!g3bTotal&&<div>⚠ GSTR-3B not loaded — use Portal Login or upload JSON</div>}
                      </div>
                    )}
                  </div>

                  {/* Main reconciliation table */}
                  <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,overflowX:"auto"}}>
                    <div style={{padding:"0.7rem 1rem",borderBottom:`1px solid ${BORDER}`,fontWeight:700,fontSize:"0.84rem",display:"flex",gap:"1rem",alignItems:"center"}}>
                      <span>ITC Reconciliation — GSTR-3B vs GSTR-2B vs Books</span>
                      {gstr3b?.ret_period&&<span style={{fontSize:"0.72rem",color:MUTED,fontWeight:400}}>Period {gstr3b.ret_period.slice(0,2)}/{gstr3b.ret_period.slice(2)}</span>}
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                      <thead><tr style={{background:"#FFFFFF",borderBottom:`1px solid ${BORDER}`}}>
                        <TH>Source</TH>
                        <TH right>CGST</TH>
                        <TH right>SGST</TH>
                        <TH right>IGST</TH>
                        <TH right>Total</TH>
                        <TH>Status</TH>
                      </tr></thead>
                      <tbody>
                        {rows.map((r,i)=>{
                          const isVarRow = r.isVar;
                          const statusLabel = isVarRow
                            ? (Math.abs(r.total)<1 ? {text:"✓ Matched",c:GREEN} : Math.abs(r.total)<1000 ? {text:"⚠ Minor diff",c:AMBER} : {text:"⛔ Mismatch",c:RED})
                            : null;
                          return (
                            <tr key={i} style={{borderBottom:`1px solid ${isVarRow?"rgba(20,26,58,0.10)":"#FFFFFF"}`,background:isVarRow?"#FFFFFF":i%2===0?"transparent":"#FFFFFF"}}>
                              <td style={{padding:"0.55rem 0.75rem"}}>
                                <div style={{fontWeight:700,color:r.color,fontSize:"0.82rem"}}>{isVarRow?"└ ":""}{r.label}</div>
                                <div style={{fontSize:"0.68rem",color:MUTED}}>{r.sub}</div>
                              </td>
                              {isVarRow ? (
                                <>
                                  <td style={{padding:"0.55rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.78rem"}}>{varFmt(r.cgst)}</td>
                                  <td style={{padding:"0.55rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.78rem"}}>{varFmt(r.sgst)}</td>
                                  <td style={{padding:"0.55rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.78rem"}}>{varFmt(r.igst)}</td>
                                  <td style={{padding:"0.55rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,fontSize:"0.82rem"}}>{varFmt(r.total)}</td>
                                </>
                              ) : (
                                <>
                                  {moneyCell(r.cgst, r.color)}
                                  {moneyCell(r.sgst, r.color)}
                                  {moneyCell(r.igst, r.color)}
                                  <td style={{padding:"0.55rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:r.color}}>{fmt(r.total)}</td>
                                </>
                              )}
                              <td style={{padding:"0.55rem 0.75rem"}}>
                                {statusLabel&&<span style={{background:statusLabel.c===GREEN?"rgba(11,122,85,0.12)":statusLabel.c===RED?"rgba(194,50,31,0.12)":"rgba(184,120,0,0.12)",color:statusLabel.c,fontSize:"0.7rem",fontWeight:700,padding:"3px 8px",borderRadius:5}}>{statusLabel.text}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* GSTR-3B detail card if loaded */}
                  {gstr3b&&(
                    <div style={{background:CARD,border:`1px solid rgba(91,75,196,0.2)`,borderRadius:12,overflow:"hidden"}}>
                      <div style={{padding:"0.65rem 1rem",borderBottom:`1px solid rgba(91,75,196,0.2)`,fontWeight:700,fontSize:"0.82rem",color:PURPLE}}>
                        GSTR-3B Detail — Period {gstr3b.ret_period.slice(0,2)}/{gstr3b.ret_period.slice(2)}
                      </div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.78rem"}}>
                        <thead><tr style={{background:"rgba(91,75,196,0.04)",borderBottom:`1px solid rgba(91,75,196,0.15)`}}>
                          <TH>Component</TH><TH right>CGST</TH><TH right>SGST</TH><TH right>IGST</TH><TH right>Total</TH>
                        </tr></thead>
                        <tbody>
                          {[
                            {label:"Output Taxable",vals:[gstr3b.output.cgst,gstr3b.output.sgst,gstr3b.output.igst],total:gstr3b.output.cgst+gstr3b.output.sgst+gstr3b.output.igst,c:RED},
                            {label:"ITC Available (Gross)",vals:[gstr3b.itc_avail.cgst,gstr3b.itc_avail.sgst,gstr3b.itc_avail.igst],total:gstr3b.itc_avail.cgst+gstr3b.itc_avail.sgst+gstr3b.itc_avail.igst,c:BLUE},
                            {label:"ITC Reversed",vals:[gstr3b.itc_reversed.cgst,gstr3b.itc_reversed.sgst,gstr3b.itc_reversed.igst],total:gstr3b.itc_reversed.cgst+gstr3b.itc_reversed.sgst+gstr3b.itc_reversed.igst,c:AMBER},
                            {label:"Net ITC Claimed",vals:[gstr3b.net_itc.cgst,gstr3b.net_itc.sgst,gstr3b.net_itc.igst],total:g3bTotal,c:GREEN},
                            {label:"Tax Payable (after ITC)",vals:[gstr3b.tax_payable.cgst,gstr3b.tax_payable.sgst,gstr3b.tax_payable.igst],total:gstr3b.tax_payable.cgst+gstr3b.tax_payable.sgst+gstr3b.tax_payable.igst,c:RED},
                          ].map((r,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid rgba(20,26,58,0.10)`,background:i%2===0?"transparent":"#FFFFFF"}}>
                              <td style={{padding:"0.45rem 0.75rem",fontWeight:600}}>{r.label}</td>
                              {r.vals.map((v,j)=><td key={j} style={{padding:"0.45rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",color:v>0?r.c:MUTED}}>{v>0?fmt(v):"—"}</td>)}
                              <td style={{padding:"0.45rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:r.c}}>{fmt(r.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Prompt to load data if both sources missing */}
                  {!g2bTotal&&!g3bTotal&&(
                    <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"2rem",textAlign:"center",color:MUTED}}>
                      <div style={{fontSize:"1.5rem",marginBottom:"0.5rem"}}>📊</div>
                      <div style={{fontWeight:700,marginBottom:"0.5rem",color:TEXT}}>Load GSTR-2B and GSTR-3B data to reconcile</div>
                      <div style={{fontSize:"0.8rem",lineHeight:1.7}}>
                        Click <strong style={{color:BLUE}}>GST Portal Login</strong> to auto-fetch both returns,<br/>
                        or upload the JSON files downloaded from gst.gov.in.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── GSTR-2B Portal tab ───────────────────────────────────────── */}
            {tab==="portal"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"0.85rem"}}>
                {unmatchedPortal.length>0&&(
                  <div style={{background:"rgba(184,120,0,0.07)",border:`1px solid rgba(184,120,0,0.22)`,borderRadius:10,padding:"0.8rem 1rem"}}>
                    <span style={{color:AMBER,fontWeight:700}}>⚠ {unmatchedPortal.length} portal invoices not found in your books</span>
                    <span style={{color:MUTED,fontSize:"0.78rem"}}> — Supplier filed in portal but you haven&apos;t recorded the purchase. ITC claimed on these entries may be reversed.</span>
                  </div>
                )}
                {[{title:`⚠ ${unmatchedPortal.length} Unmatched — In GSTR-2B but NOT in books`,rows:unmatchedPortal,headerColor:AMBER},{title:`✓ ${portalInvoices.filter(i=>i.matched).length} Matched`,rows:portalInvoices.filter(i=>i.matched),headerColor:GREEN}].map(sec=>(
                  sec.rows.length>0&&(
                    <div key={sec.title} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden"}}>
                      <div style={{padding:"0.65rem 1rem",borderBottom:`1px solid ${BORDER}`,fontWeight:700,fontSize:"0.82rem",color:sec.headerColor}}>{sec.title}</div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.78rem"}}>
                        <thead><tr style={{background:"#FFFFFF",borderBottom:`1px solid ${BORDER}`}}>
                          <TH>Supplier GSTIN</TH><TH>Trade Name</TH><TH>Invoice No</TH><TH>Date</TH>
                          <TH right>Taxable</TH><TH right>CGST</TH><TH right>SGST</TH><TH right>IGST</TH>
                          {sec.rows[0]?.matchedEntry&&<TH>Books Entry</TH>}
                        </tr></thead>
                        <tbody>
                          {sec.rows.map((inv,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid rgba(20,26,58,0.10)`}}>
                              <td style={{padding:"0.42rem 0.75rem",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.68rem"}}>{inv.gstin}</td>
                              <td style={{padding:"0.42rem 0.75rem"}}>{inv.trade_name||"—"}</td>
                              <td style={{padding:"0.42rem 0.75rem",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.7rem",color:GOLD}}>{inv.invoice_no}</td>
                              <td style={{padding:"0.42rem 0.75rem",color:MUTED}}>{inv.invoice_date}</td>
                              <td style={{padding:"0.42rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(inv.taxable_value)}</td>
                              <td style={{padding:"0.42rem 0.75rem",textAlign:"right",color:inv.cgst>0?GREEN:MUTED}}>{inv.cgst>0?fmt(inv.cgst):"—"}</td>
                              <td style={{padding:"0.42rem 0.75rem",textAlign:"right",color:inv.sgst>0?GREEN:MUTED}}>{inv.sgst>0?fmt(inv.sgst):"—"}</td>
                              <td style={{padding:"0.42rem 0.75rem",textAlign:"right",color:inv.igst>0?GREEN:MUTED}}>{inv.igst>0?fmt(inv.igst):"—"}</td>
                              {inv.matchedEntry&&<td style={{padding:"0.42rem 0.75rem",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.68rem",color:GREEN}}>{inv.matchedEntry}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* ── Tally Excel tab ──────────────────────────────────────────── */}
            {tab==="tally_xls"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"0.85rem"}}>
                {unmatchedTally.length>0&&(
                  <div style={{background:"rgba(184,120,0,0.07)",border:`1px solid rgba(184,120,0,0.22)`,borderRadius:10,padding:"0.8rem 1rem"}}>
                    <span style={{color:AMBER,fontWeight:700}}>⚠ {unmatchedTally.length} Tally vouchers not found in FreWork books</span>
                    <span style={{color:MUTED,fontSize:"0.78rem"}}> — These exist in Tally but haven&apos;t been imported or recorded here.</span>
                  </div>
                )}
                <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"0.65rem 1rem",borderBottom:`1px solid ${BORDER}`,display:"flex",gap:"1rem",alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:"0.82rem",color:AMBER}}>Tally Export — {tallyRows.length} Vouchers</span>
                    <span style={{fontSize:"0.7rem",color:GREEN}}>✓ {tallyRows.filter(r=>r.matched).length} matched</span>
                    {unmatchedTally.length>0&&<span style={{fontSize:"0.7rem",color:AMBER}}>⚠ {unmatchedTally.length} unmatched</span>}
                    <span style={{fontSize:"0.7rem",color:MUTED,marginLeft:"auto"}}>Total GST: {fmt(tallyRows.reduce((s,r)=>s+r.cgst+r.sgst+r.igst,0))}</span>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.78rem"}}>
                    <thead><tr style={{background:"#FFFFFF",borderBottom:`1px solid ${BORDER}`}}>
                      <TH>Date</TH><TH>Type</TH><TH>Voucher No</TH><TH>Party</TH><TH>Narration</TH>
                      <TH right>Amount</TH><TH right>CGST</TH><TH right>SGST</TH><TH right>IGST</TH><TH>Books</TH>
                    </tr></thead>
                    <tbody>
                      {tallyRows.map((r,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid rgba(20,26,58,0.10)`,background:i%2===0?"transparent":"#FFFFFF"}}>
                          <td style={{padding:"0.42rem 0.75rem",color:MUTED,whiteSpace:"nowrap"}}>{new Date(r.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</td>
                          <td style={{padding:"0.42rem 0.75rem",fontSize:"0.72rem",color:PURPLE}}>{r.voucherType}</td>
                          <td style={{padding:"0.42rem 0.75rem",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.7rem",color:GOLD}}>{r.voucherNo||"—"}</td>
                          <td style={{padding:"0.42rem 0.75rem",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.party||"—"}</td>
                          <td style={{padding:"0.42rem 0.75rem",color:MUTED,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.narration}</td>
                          <td style={{padding:"0.42rem 0.75rem",textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>{r.amount>0?fmt(r.amount):"—"}</td>
                          <td style={{padding:"0.42rem 0.75rem",textAlign:"right",color:r.cgst>0?GREEN:MUTED}}>{r.cgst>0?fmt(r.cgst):"—"}</td>
                          <td style={{padding:"0.42rem 0.75rem",textAlign:"right",color:r.sgst>0?GREEN:MUTED}}>{r.sgst>0?fmt(r.sgst):"—"}</td>
                          <td style={{padding:"0.42rem 0.75rem",textAlign:"right",color:r.igst>0?GREEN:MUTED}}>{r.igst>0?fmt(r.igst):"—"}</td>
                          <td style={{padding:"0.42rem 0.75rem"}}>{r.matched?<span style={{color:GREEN,fontSize:"0.7rem",fontWeight:700}}>✓ {r.matchedEntry}</span>:<span style={{color:AMBER,fontSize:"0.7rem",fontWeight:700}}>⚠ Missing</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── GST Credentials Modal ─────────────────────────────────────────── */}
      {showCredModal&&(
        <div onClick={()=>setShowCredModal(false)} style={{position:"fixed",inset:0,background:"rgba(20,26,58,0.30)",backdropFilter:"blur(4px)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#FFFFFF",border:`1px solid ${BORDER}`,borderRadius:16,width:"100%",maxWidth:440,padding:"1.5rem",boxShadow:"0 24px 80px rgba(20,26,58,0.30)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <h3 style={{margin:0,fontSize:"1rem",fontWeight:700}}>GST Portal Settings</h3>
              <button onClick={()=>setShowCredModal(false)} style={{background:"#FFFFFF",border:"none",color:MUTED,width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:"1.1rem"}}>×</button>
            </div>
            <div style={{background:"rgba(184,120,0,0.07)",border:`1px solid rgba(184,120,0,0.2)`,borderRadius:8,padding:"0.65rem 0.9rem",marginBottom:"1rem",fontSize:"0.75rem",color:AMBER,lineHeight:1.7}}>
              🔒 Your GSTIN and username are stored securely. <strong>We never store your GST password.</strong> Use the OTP flow to fetch data, or download JSON manually from gst.gov.in and upload.
            </div>
            {[
              {label:"GSTIN",key:"",val:settings.gstin,readOnly:true,note:"Set during business setup"},
              {label:"GST Portal Username",key:"gst_username",val:credForm.gst_username,readOnly:false,note:"Your GST portal login ID (e.g. your GSTIN or mobile)"},
              {label:"Trade Name (as in GST portal)",key:"gst_trade_name",val:credForm.gst_trade_name,readOnly:false,note:"Auto-fills for verification"},
            ].map(f=>(
              <div key={f.label} style={{marginBottom:"0.9rem"}}>
                <label style={{fontSize:"0.72rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5}}>{f.label}</label>
                <input value={f.val} readOnly={f.readOnly} onChange={f.readOnly?undefined:e=>{if(f.key==="gst_username")setCredForm(c=>({...c,gst_username:e.target.value}));else setCredForm(c=>({...c,gst_trade_name:e.target.value}));}}
                  style={{width:"100%",boxSizing:"border-box",background:f.readOnly?"#FFFFFF":"#FFFFFF",border:`1px solid ${BORDER}`,color:f.readOnly?MUTED:TEXT,padding:"9px 12px",borderRadius:9,fontSize:"0.86rem",fontFamily:"inherit",outline:"none"}}/>
                <div style={{fontSize:"0.68rem",color:MUTED,marginTop:3}}>{f.note}</div>
              </div>
            ))}
            <div style={{display:"flex",gap:"0.5rem",marginTop:"0.25rem"}}>
              <button onClick={saveCredentials} disabled={credSaving} style={{flex:1,background:GOLD,color:"#F5F6FA",border:"none",padding:"10px",borderRadius:9,fontWeight:700,fontSize:"0.86rem",cursor:"pointer",fontFamily:"inherit"}}>
                {credSaving?"Saving…":"Save Settings"}
              </button>
              <button onClick={()=>setShowCredModal(false)} style={{padding:"10px 18px",borderRadius:9,background:"#FFFFFF",border:`1px solid ${BORDER}`,color:MUTED,fontWeight:600,fontSize:"0.86rem",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}
