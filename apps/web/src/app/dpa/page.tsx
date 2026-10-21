import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, List } from "@/components/legal/LegalDoc";
import { LEGAL, SUBPROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data Processing Agreement",
  description: "FreWork Data Processing Agreement: how FreWork processes personal data in your books on your behalf under the DPDP Act, 2023.",
};

const a = "text-[#C9A84C] hover:underline";

export default function DpaPage() {
  return (
    <LegalDoc title="Data Processing Agreement" path="/dpa" intro={<p>
      This DPA forms part of the <Link href="/terms" className={a}>Terms of Service</Link> between the Customer and {LEGAL.entity} (&ldquo;FreWork&rdquo;).
      It applies to personal data inside Customer Data, for example the names, PAN, phone numbers and bank details of the Customer&apos;s customers,
      suppliers and employees. For that data the Customer is the <b className="text-white">Data Fiduciary</b> and FreWork is the <b className="text-white">Data Processor</b>
      under the Digital Personal Data Protection Act, 2023. It is accepted with the Terms; a signed copy is available on request.</p>}>

      <Section n="1" title="Scope of processing">
        <List items={[
          "Subject matter: providing FreBook and the FreWork service.",
          "Duration: the term of the agreement plus the deletion period in section 8.",
          "Nature: storing, organising, displaying, analysing and exporting accounting records; AI drafting; sending data to Tally or the GST provider when the Customer asks.",
          "Data principals: the Customer's customers, suppliers, employees, partners and its own staff users.",
          "Data: names, addresses, phone, email, PAN, GSTIN, bank account details, invoice and payment details, salary details where payroll is used.",
        ]} />
      </Section>

      <Section n="2" title="Customer instructions">
        <p>FreWork processes this data only on the Customer&apos;s documented instructions, which are these Terms and the Customer&apos;s use of the app. FreWork will tell the Customer if an instruction appears to break the law. The Customer is responsible for having a lawful basis and giving any notice required to its own data principals.</p>
      </Section>

      <Section n="3" title="Confidentiality">
        <p>Only staff and contractors who need access to support the service can reach Customer Data, and they are bound by confidentiality.</p>
      </Section>

      <Section n="4" title="Security measures">
        <List items={[
          "Encryption in transit (TLS) and at rest.",
          "Separation of each business's data by row-level security in the database.",
          "Role-based access for team members invited by the Customer.",
          "Posted entries cannot be edited; corrections are made by reversal, so there is a full audit trail.",
          "Service keys kept only on the server; no GST-portal or bank passwords stored. An Income-tax portal password is stored only when the Customer ticks \"Remember password\", encrypted with AES-256-GCM, and deleted on request.",
          "Backups by the database provider.",
        ]} />
      </Section>

      <Section n="5" title="Sub-processors">
        <p>The Customer authorises the sub-processors below. FreWork binds each to data protection terms no less protective than this DPA and stays responsible for them. We will give at least 15 days&apos; notice of a new sub-processor by email or on this page; the Customer may object, and if we cannot resolve it, may terminate and receive a pro-rata refund.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left text-white/80"><th className="py-2 pr-4 font-semibold">Sub-processor</th><th className="py-2 pr-4 font-semibold">Purpose</th><th className="py-2 pr-4 font-semibold">Data</th><th className="py-2 font-semibold">Location</th></tr></thead>
            <tbody>{SUBPROCESSORS.map(s => (
              <tr key={s.name} className="border-t border-white/10 align-top"><td className="py-2 pr-4 text-white/70">{s.name}</td><td className="py-2 pr-4">{s.purpose}</td><td className="py-2 pr-4">{s.data}</td><td className="py-2">{s.location}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Section>

      <Section n="6" title="Help with data principal requests">
        <p>If a data principal contacts FreWork directly about Customer Data, we will pass the request to the Customer and not answer it ourselves unless the Customer asks. The app lets the Customer find, correct, export and delete records; we will help further on reasonable request.</p>
      </Section>

      <Section n="7" title="Personal data breaches">
        <p>FreWork will tell the Customer without undue delay, and in any case within 48 hours of becoming aware of a breach affecting Customer Data, with what is known, the likely effects and the steps taken. We will help the Customer meet its duty to inform the Data Protection Board and affected data principals.</p>
      </Section>

      <Section n="8" title="Return and deletion">
        <p>The Customer can export its data at any time. When the account closes, FreWork keeps Customer Data for 30 days for export, then deletes it from live systems; backups roll off within a further 30 days. Data FreWork must keep by law is kept only for that purpose.</p>
      </Section>

      <Section n="9" title="Audits">
        <p>On written request, once a year, FreWork will answer a reasonable security questionnaire and share summaries of its sub-processors&apos; security certifications. On-site audits need 30 days&apos; notice, are at the Customer&apos;s cost and must not expose other customers&apos; data.</p>
      </Section>

      <Section n="10" title="Liability and order of precedence">
        <p>Liability under this DPA is subject to the limits in the Terms. If this DPA and the Terms conflict on personal data, this DPA prevails.</p>
      </Section>
    </LegalDoc>
  );
}
