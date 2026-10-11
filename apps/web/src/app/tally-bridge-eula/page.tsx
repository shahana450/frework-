import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, List } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Tally Bridge EULA",
  description: "End-user licence agreement for the FreWork Tally Bridge, the small program that connects FreBook to TallyPrime on your computer.",
};

const a = "text-[#C9A84C] hover:underline";

export default function TallyBridgeEulaPage() {
  return (
    <LegalDoc title="Tally Bridge EULA" path="/tally-bridge-eula" intro={<p>
      This End-User Licence Agreement covers the FreWork Tally Bridge (the &ldquo;Bridge&rdquo;), a small program you run on your own computer so FreBook can send
      entries to, and read data from, TallyPrime. By downloading, installing or running the Bridge you accept this EULA and the <Link href="/terms" className={a}>Terms of Service</Link>.</p>}>

      <Section n="1" title="Licence">
        <p>{LEGAL.entity} grants you a free, non-exclusive, non-transferable, revocable licence to install and use the Bridge on computers you control, only to connect your own or your clients&apos; Tally companies with your FreWork account.</p>
      </Section>

      <Section n="2" title="What the Bridge does">
        <List items={[
          "Runs locally and listens only on your computer (localhost) on the port you choose.",
          "Passes requests between FreBook in your browser and TallyPrime's XML interface on the same computer.",
          "Sends vouchers and ledgers to Tally when you press Push, and reads company and voucher lists to check what is already there.",
          "Does not collect your Tally data for FreWork, store passwords, or open any port to the internet.",
        ]} />
      </Section>

      <Section n="3" title="Restrictions">
        <p>You may not sell, rent or redistribute the Bridge, modify it to reach data you are not authorised to access, or remove notices from it. You may not use it to get around Tally licensing (for example educational-mode date limits).</p>
      </Section>

      <Section n="4" title="Tally">
        <p>You need your own valid TallyPrime licence. Tally and TallyPrime are trademarks of Tally Solutions Pvt Ltd. FreWork is not affiliated with or endorsed by Tally Solutions, and is not responsible for Tally&apos;s software, licensing or changes to its interfaces.</p>
      </Section>

      <Section n="5" title="Your responsibilities">
        <List items={[
          "Back up your Tally data before a large push. Tally has its own backup under Data → Backup.",
          "Check that the company open in Tally is the right one. FreBook checks this before a push but cannot see your intentions.",
          "Keep your computer and antivirus up to date.",
        ]} />
      </Section>

      <Section n="6" title="Updates">
        <p>We may release updates that fix problems or follow changes in Tally. Older versions may stop working with FreBook; the app will tell you when an update is needed.</p>
      </Section>

      <Section n="7" title="No warranty">
        <p>The Bridge is provided free and &ldquo;as is&rdquo;, without warranty of any kind, to the extent the law allows. We do not warrant that it will be error-free or work with every Tally version or setup.</p>
      </Section>

      <Section n="8" title="Limitation of liability">
        <p>To the extent the law allows, FreWork is not liable for loss or corruption of Tally data, duplicate or missing vouchers, or any indirect loss arising from the Bridge. Total liability for the Bridge is limited as set out in the Terms of Service.</p>
      </Section>

      <Section n="9" title="Ending the licence">
        <p>You can stop at any time by uninstalling the Bridge. The licence ends automatically if you breach this EULA or close your FreWork account. Governing law and courts are as in the Terms ({LEGAL.courts}).</p>
      </Section>
    </LegalDoc>
  );
}
