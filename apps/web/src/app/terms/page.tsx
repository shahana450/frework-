import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, List } from "@/components/legal/LegalDoc";
import { LEGAL, fill } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "FreWork SaaS Terms of Service: the agreement for using FreBook, the FreWork app and services ordered on frework.online.",
};

const a = "text-[#C9A84C] hover:underline";

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" path="/terms" intro={<p>
      This agreement is between you (the &ldquo;Customer&rdquo;) and {LEGAL.entity}{LEGAL.entityType ? `, ${LEGAL.entityType}` : ""} (&ldquo;FreWork&rdquo;, &ldquo;we&rdquo;),
      registered office {fill(LEGAL.address)}, GSTIN {fill(LEGAL.gstin)}. By creating an account, starting a free trial or paying for a plan you accept these Terms,
      the <Link href="/privacy" className={a}>Privacy Notice</Link>, the <Link href="/dpa" className={a}>Data Processing Agreement</Link>,
      the <Link href="/ai-disclaimer" className={a}>AI Disclaimer</Link> and, if you install it, the <Link href="/tally-bridge-eula" className={a}>Tally Bridge EULA</Link>.
      If you accept for a business, you confirm you are authorised to bind it.</p>}>

      <Section n="1" title="The service">
        <p>FreWork provides, as software-as-a-service:</p>
        <List items={[
          "FreBook: bookkeeping by chat, invoices, journals, ledgers, bank and document import, reports, GST and TDS working papers, and export to Tally;",
          "compliance tracking and reminders;",
          "a marketplace to order professional services (such as GST registration, ITR filing or audits) from independent professionals.",
        ]} />
        <p>We may improve or change features. We will not remove a core feature you pay for during a paid period without notice and a pro-rata refund.</p>
      </Section>

      <Section n="2" title="Accounts and access">
        <List items={[
          "You must be 18 or older and give accurate details.",
          "Keep your login private. You are responsible for what happens under your account, including users you invite.",
          "Tell us at once at " + LEGAL.supportEmail + " if you suspect unauthorised access.",
          "We never ask for, and you must not enter into FreWork, passwords for the GST portal, Income-tax portal or your bank.",
        ]} />
      </Section>

      <Section n="3" title="Plans, trial and payment">
        <List items={[
          "FreBook is billed per login, per month, plus GST: Basic ₹699 (up to 2 businesses), Pro ₹999 (up to 5 businesses) and Unlimited ₹1,499 (any number of businesses), unless the pricing page shows otherwise at the time you subscribe. A new account gets one free 7-day trial.",
          "The first month is free when claimed on the pricing page. No charge is made for the trial; the plan continues only if you pay for it.",
          "Fees are billed in advance through our payment partners and are exclusive of GST unless stated.",
          "Professional services are priced separately on each service and paid when ordered.",
          "We may change prices with at least 30 days' notice by email. The change applies from your next billing period.",
          <>Refunds follow the <Link key="r" href="/refund-policy" className={a}>Refund Policy</Link>: a full refund within 7 days of payment if no work has started and no filing has been made.</>,
        ]} />
      </Section>

      <Section n="4" title="Your data">
        <p>You own all data you enter or upload (&ldquo;Customer Data&rdquo;). You give us a limited licence to host, process and display it only to provide the service, as set out in the <Link href="/dpa" className={a}>DPA</Link>. We do not sell Customer Data or use it to train AI models.</p>
        <p>You can download your reports and ledgers at any time, and ask us at {LEGAL.supportEmail} for a full export of your data. After you close your account we keep data for 30 days so you can export it, then delete it, except records the law requires us to keep.</p>
      </Section>

      <Section n="5" title="AI features and professional advice">
        <p>FreBook uses AI to draft entries and read documents. Drafts can be wrong. Nothing is posted to your books until you confirm it, and you remain responsible for your books, returns and filings. See the <Link href="/ai-disclaimer" className={a}>AI Disclaimer</Link>.</p>
        <p>The software does not give legal, tax or audit advice. Advice is given only under a service order, by the professional named on it, who is responsible for their work.</p>
      </Section>

      <Section n="6" title="Acceptable use">
        <List items={[
          "No unlawful use, including recording fictitious transactions or evading tax.",
          "No attempts to access another customer's data, probe or overload the service, or copy or reverse-engineer it.",
          "No reselling the service without our written consent.",
        ]} />
        <p>We may suspend an account that breaches this section, with notice where the law and the risk allow.</p>
      </Section>

      <Section n="7" title="Availability and support">
        <p>We aim for the service to be available at all times but do not guarantee uninterrupted access. Planned maintenance is announced in the app where possible. Support is by email and WhatsApp on Indian working days.</p>
      </Section>

      <Section n="8" title="Third-party services">
        <p>Some features rely on third parties, such as Tally, payment gateways, GST data providers and WhatsApp. Their availability and terms are outside our control. Tally is a trademark of Tally Solutions Pvt Ltd; FreWork is not affiliated with it.</p>
      </Section>

      <Section n="9" title="Intellectual property">
        <p>The FreWork software, brand and content belong to us or our licensors. Apart from your right to use the service under these Terms, no rights are granted.</p>
      </Section>

      <Section n="10" title="Warranties and liability">
        <p>The service is provided &ldquo;as is&rdquo;, except for any rights you have under the Consumer Protection Act, 2019 that cannot be excluded.</p>
        <p>To the extent the law allows, neither party is liable for indirect or consequential loss, lost profit, or penalties or interest arising from a filing the Customer made. Our total liability for any claim is limited to the fees you paid us in the 12 months before the claim. These limits do not apply to fraud or to liability that cannot be limited by law.</p>
      </Section>

      <Section n="11" title="Term and termination">
        <p>You can cancel at any time in the app or by email; access continues to the end of the paid period. We may end these Terms on 30 days&apos; notice, or at once for a serious breach. Sections 4, 9, 10 and 13 survive termination.</p>
      </Section>

      <Section n="12" title="Changes to these Terms">
        <p>We will give at least 15 days&apos; notice by email or in the app before a material change takes effect. Continuing to use the service after that means you accept the change.</p>
      </Section>

      <Section n="13" title="Law, disputes and grievances">
        <p>These Terms are governed by the laws of India. The parties will first try to settle a dispute by good-faith discussion for 30 days. After that, the courts at {LEGAL.courts} have exclusive jurisdiction.</p>
        <p>Grievance Officer: {fill(LEGAL.grievanceName)}, <a href={`mailto:${LEGAL.grievanceEmail}`} className={a}>{LEGAL.grievanceEmail}</a>. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>
      </Section>
    </LegalDoc>
  );
}
