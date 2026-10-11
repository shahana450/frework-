import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, List } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "AI Disclaimer",
  description: "How FreWork uses AI to draft accounting entries and read documents, what it can get wrong, and what stays your responsibility.",
};

const a = "text-[#C9A84C] hover:underline";

export default function AiDisclaimerPage() {
  return (
    <LegalDoc title="AI Disclaimer" path="/ai-disclaimer" intro={<p>
      FreWork uses artificial intelligence to save you typing. It is an assistant, not an accountant. Read this before relying on anything it produces.</p>}>

      <Section n="1" title="Where AI is used">
        <List items={[
          "Turning a chat message into a draft accounting entry.",
          "Reading bills, invoices, bank statements, Excel templates and Form 168 / 130 PDFs.",
          "Suggesting ledgers, groups, GST rates, matches between bank lines and invoices, and explanations of reports.",
        ]} />
      </Section>

      <Section n="2" title="What it can get wrong">
        <p>AI output can be incomplete or wrong, even when it sounds confident. It can misread an amount or date, pick the wrong ledger or GST rate, miss a reverse-charge or TDS point, or misunderstand a rule that has changed. It does not know facts about your business that are not in your books.</p>
      </Section>

      <Section n="3" title="You stay in control">
        <List items={[
          "Every AI draft is shown to you first. Nothing is posted to your books until you confirm it.",
          "Entries that look unusual (for example a sale with no GST for a registered business) are held for review instead of being posted.",
          "Posted entries are never changed silently; corrections are made by reversal so you can see what happened.",
        ]} />
        <p>You are responsible for checking drafts, for your books of account, and for every return or filing made from them.</p>
      </Section>

      <Section n="4" title="Not professional advice">
        <p>AI output is general information, not legal, tax, accounting or audit advice, and does not create a professional relationship. For advice, order a service from a qualified professional on FreWork, or consult your own Chartered Accountant.</p>
      </Section>

      <Section n="5" title="Your data and the AI providers">
        <p>To produce a draft, the text or document you give and the ledger names it needs are sent to an AI provider (currently Google Gemini, with Anthropic Claude as a backup). They process it under API terms that do not allow training on your data. We do not use your data to train models. See the <Link href="/privacy" className={a}>Privacy Notice</Link> and <Link href="/dpa" className={a}>DPA</Link>.</p>
      </Section>

      <Section n="6" title="Liability">
        <p>FreWork is not liable for tax, interest, penalties or losses arising from AI output that you confirmed or filed, subject to the limits in the <Link href="/terms" className={a}>Terms of Service</Link>. If you find a pattern of wrong drafts, tell us at <a href={`mailto:${LEGAL.supportEmail}`} className={a}>{LEGAL.supportEmail}</a> so we can fix it.</p>
      </Section>
    </LegalDoc>
  );
}
