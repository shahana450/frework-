import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

const DOCS: [string, string][] = [
  ["/terms", "Terms of Service"],
  ["/privacy", "Privacy Notice"],
  ["/dpa", "Data Processing Agreement"],
  ["/ai-disclaimer", "AI Disclaimer"],
  ["/tally-bridge-eula", "Tally Bridge EULA"],
  ["/refund-policy", "Refund Policy"],
];

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section id={`s${n}`} className="scroll-mt-20">
      <h2 className="text-lg font-semibold text-white mb-3">{n}. {title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-white/55">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

export default function LegalDoc({ title, path, intro, children }: { title: string; path: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060C18] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors mb-8 inline-block">← Back to FreWork</Link>
        <h1 className="text-4xl font-bold mb-2 [text-wrap:balance]" style={{ fontFamily: "var(--font-cormorant), serif" }}>{title}</h1>
        <p className="text-white/30 text-sm mb-6">Version {LEGAL.version} · Effective {LEGAL.effective}</p>
        <nav aria-label="Legal documents" className="flex flex-wrap gap-2 mb-10">
          {DOCS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={href === path ? "page" : undefined}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${href === path ? "border-[#C9A84C]/60 text-[#C9A84C]" : "border-white/10 text-white/40 hover:text-white/70"}`}>{label}</Link>
          ))}
        </nav>
        <div className="text-white/70 leading-relaxed text-[15px] mb-10">{intro}</div>
        <div className="space-y-10 text-white/60 leading-relaxed text-[15px]">{children}</div>
      </div>
    </div>
  );
}
