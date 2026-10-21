import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, List } from "@/components/legal/LegalDoc";
import { LEGAL, SUBPROCESSORS, fill } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "FreWork privacy notice under India's Digital Personal Data Protection Act, 2023: what we collect, why, who we share it with, and your rights.",
};

const a = "text-[#C9A84C] hover:underline";

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Notice" path="/privacy" intro={<p>
      This notice is given under section 5 of the Digital Personal Data Protection Act, 2023 (the &ldquo;DPDP Act&rdquo;) and the rules made under it.
      {" "}{LEGAL.entity} (&ldquo;FreWork&rdquo;) is the <b className="text-white">Data Fiduciary</b> for the personal data of people who use frework.online.
      For accounting data our customers upload about <i>their</i> customers, suppliers and employees, the customer is the Data Fiduciary and FreWork is its
      Data Processor under the <Link href="/dpa" className={a}>Data Processing Agreement</Link>.</p>}>

      <Section n="1" title="What we collect">
        <List items={[
          "Account: name, email, phone number, and your Google profile name and photo if you sign in with Google.",
          "Business: business name, GSTIN, PAN, address, and the documents you upload.",
          "Accounting data: entries, ledgers, invoices, bank statements, bills, Form 168 / 130 PDFs and the like.",
          "Payments: order amounts and transaction IDs. Card and UPI details are handled by the payment gateway; we never see them.",
          "Messages: WhatsApp messages and emails you send us or send through FreWork, alerts you switch on (such as overdue-payment reminders sent to your own linked number), and one-time sign-in links we send to that number at your request.",
          "Usage: pages visited, device and browser, error logs, and counts we need to run your plan (such as how many bank-statement pages the AI has read this month).",
        ]} />
        <p>We do <b className="text-white">not</b> store passwords for the GST portal or your bank. For the Income-tax portal, the PAN, password and OTP you type are passed to FreWork&apos;s own portal service to log in and fetch your documents. The password is saved <b className="text-white">only if you tick &ldquo;Remember password&rdquo;</b>: it is then encrypted (AES-256) with a key kept only on our servers, used only to log in when you ask for a fetch, and deleted when you press &ldquo;Forget saved password&rdquo; or close your account. OTPs are never stored.</p>
      </Section>

      <Section n="2" title="Why we use it, and on what basis">
        <List items={[
          "To provide the service you signed up for: keeping your books, preparing drafts and reports, reminders. Basis: your consent given at sign-up.",
          "To take payment and issue GST invoices. Basis: consent and legal obligation.",
          "To answer your questions and give support. Basis: consent.",
          "To keep the service secure and fix errors. Basis: legitimate use under section 7 of the DPDP Act.",
          "To meet legal duties, such as tax record-keeping or a lawful order. Basis: section 7.",
          "To send product news. Only if you opt in, and you can opt out from any email.",
        ]} />
        <p>We do not sell personal data, use it for advertising profiles, or use your data to train AI models.</p>
      </Section>

      <Section n="3" title="AI processing">
        <p>When you use FreBook chat, WhatsApp bookkeeping, or upload a bill, invoice or bank statement, the text or document and the ledger names needed for the draft are sent to an AI provider listed below to produce a draft. Long PDF statements are split in your browser and sent in small batches of pages; Excel and CSV statements are read by FreWork itself, without an AI provider. Nothing is posted to your books until you confirm it. Providers are used under API terms that do not permit training on this data. See the <Link href="/ai-disclaimer" className={a}>AI Disclaimer</Link>.</p>
      </Section>

      <Section n="4" title="Who we share it with">
        <p>Only with the processors that run the service, a professional you place an order with (only what that order needs), or an authority where the law requires it. Our processors:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left text-white/80"><th className="py-2 pr-4 font-semibold">Processor</th><th className="py-2 pr-4 font-semibold">Purpose</th><th className="py-2 font-semibold">Location</th></tr></thead>
            <tbody>{SUBPROCESSORS.map(s => (
              <tr key={s.name} className="border-t border-white/10 align-top"><td className="py-2 pr-4 text-white/70">{s.name}</td><td className="py-2 pr-4">{s.purpose}</td><td className="py-2">{s.location}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p>Some processors store data outside India. We transfer data only to countries not restricted by the Government of India under section 16 of the DPDP Act.</p>
      </Section>

      <Section n="5" title="How long we keep it">
        <List items={[
          "Account and accounting data: while your account is active, then 30 days to let you export it, then deleted.",
          "Invoices we issue to you and payment records: 8 years, as required by the CGST Act and the Income-tax Act.",
          "Security and error logs: up to 1 year.",
        ]} />
      </Section>

      <Section n="6" title="Security">
        <p>Data is encrypted in transit (HTTPS) and at rest by our database provider. Each business&apos;s data is separated by row-level security, staff access is limited, and posted entries keep an audit trail. If a personal data breach happens, we will inform the Data Protection Board of India and affected people as the DPDP rules require.</p>
      </Section>

      <Section n="7" title="Your rights">
        <List items={[
          "Access a summary of your personal data and how it is processed, and who it was shared with.",
          "Correct, complete or update it.",
          "Erase it, unless we must keep it by law.",
          "Withdraw consent at any time, as easily as you gave it. Processing done before withdrawal stays lawful; some features may stop working.",
          "Nominate another person to exercise these rights if you die or become unable to.",
          "Raise a grievance with us, and then with the Data Protection Board of India.",
        ]} />
        <p>To use a right, email <a href={`mailto:${LEGAL.grievanceEmail}`} className={a}>{LEGAL.grievanceEmail}</a> from your registered email. You can also download your reports and ledgers from the app at any time.</p>
      </Section>

      <Section n="8" title="Children">
        <p>FreWork is for people aged 18 and over. We do not knowingly process children&apos;s data. If we learn we have, we delete it.</p>
      </Section>

      <Section n="9" title="Cookies">
        <p>We use essential cookies to keep you signed in and remember your active business, and basic analytics to understand usage. No advertising cookies.</p>
      </Section>

      <Section n="10" title="Grievance Officer and contact">
        <p>{fill(LEGAL.grievanceName)}, Grievance Officer, {LEGAL.entity}, {fill(LEGAL.address)}. Email <a href={`mailto:${LEGAL.grievanceEmail}`} className={a}>{LEGAL.grievanceEmail}</a>. We acknowledge within 48 hours and respond within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.</p>
        <p>We will post changes here and email you about material ones before they apply.</p>
      </Section>
    </LegalDoc>
  );
}
