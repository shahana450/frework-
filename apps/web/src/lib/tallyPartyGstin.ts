"use client";
// Party GSTIN + state from Tally's ledger masters onto FreBook contacts, so GSTR-1 files their sales as B2B.
// Called after every Tally voucher import (Tally page) and once a day by the background auto-sync.
import { supabase } from "@/lib/supabase";
import { tallyFetch } from "@/lib/tallyUtils";

/** Ledgers with their GSTIN / state. TallyPrime 3+ keeps them in LEDGSTREGDETAILS.LIST; older releases in PARTYGSTIN / LEDSTATENAME. */
export function parsePartyGstins(xml: string): { name: string; parent: string; gstin: string; state?: string }[] {
  const out: { name: string; parent: string; gstin: string; state?: string }[] = [];
  const re = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[2];
    const gstin = (block.match(/<(?:PARTYGSTIN|GSTIN)[^>]*>\s*([0-9]{2}[A-Z0-9]{13})\s*</i)?.[1] ?? "").toUpperCase();
    if (!gstin) continue;
    const parent = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i)?.[1]?.trim() ?? "";
    const state = (block.match(/<(?:LEDSTATENAME|STATE|STATENAME|PRIORSTATENAME)[^>]*>([^<]+)</i)?.[1] ?? "").trim() || undefined;
    out.push({ name: m[1].replace(/&amp;/g, "&").trim(), parent, gstin, state });
  }
  return out;
}

/** Party GSTIN + state from Tally's ledger masters onto FreBook contacts, so GSTR-1 can file their sales as B2B.
 *  Runs on every voucher import — no separate step. Returns how many parties were updated. */
export async function pullPartyGstins(tallyUrl: string, bizId: string, company: string | null): Promise<number> {
  const cv = company ? `<SVCURRENTCOMPANY>${company.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</SVCURRENTCOMPANY>` : "";
  const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_PartyGst</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${cv}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_PartyGst" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent,PartyGSTIN,LedStateName,LedGSTRegDetails,LedMailingDetails</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  const text = await (await tallyFetch(tallyUrl, xml, 60000)).text();
  const withGstin = parsePartyGstins(text);
  if (!withGstin.length) return 0;
  const [{ data: accs }, { data: contacts }] = await Promise.all([
    supabase.from("fw_fin_chart_of_accounts").select("id,name,sub_type").eq("business_id", bizId).eq("is_group", false),
    supabase.from("fw_fin_contacts").select("id,name,ledger_account_id,gstin").eq("business_id", bizId),
  ]);
  const key = (x: string) => x.trim().toLowerCase();
  let n = 0;
  for (const l of withGstin) {
    const acc = (accs ?? []).find(a => key(a.name) === key(l.name));
    const c = (contacts ?? []).find(x => (acc && x.ledger_account_id === acc.id) || key(x.name) === key(l.name));
    if (c && c.gstin === l.gstin) continue;   // already right
    const patch = { gstin: l.gstin, state_code: l.gstin!.slice(0, 2), ...(l.state ? { state: l.state } : {}) };
    const isCust = /debtor|receivable|customer/i.test(l.parent) || acc?.sub_type === "trade_receivables";
    const { error } = c
      ? await supabase.from("fw_fin_contacts").update(patch).eq("id", c.id)
      : await supabase.from("fw_fin_contacts").insert({ business_id: bizId, name: l.name, type: isCust ? "customer" : "vendor", is_active: true, ...(acc ? { ledger_account_id: acc.id } : {}), ...patch });
    if (!error) n++;
  }
  return n;
}

