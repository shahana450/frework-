"use client";
// Instant feedback on navigation: the moment any in-app link is clicked, a thin gold line runs across the top and
// the clicked link is marked "pending", until the new page is showing. Hovering a link starts loading its page.
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // The new page is showing: stop the line and clear the pending mark
  useEffect(() => {
    setBusy(false);
    document.querySelectorAll("a.fw-pending").forEach(a => a.classList.remove("fw-pending"));
  }, [pathname, search]);

  useEffect(() => {
    const linkOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("a[href]") as HTMLAnchorElement | null : null);
    const inApp = (a: HTMLAnchorElement) => {
      if (a.target && a.target !== "_self") return null;
      try { const u = new URL(a.href, location.href); return u.origin === location.origin && u.pathname.startsWith("/finance") ? u : null; } catch { return null; }
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = linkOf(e.target); if (!a) return;
      const u = inApp(a); if (!u) return;
      if (u.pathname + u.search === location.pathname + location.search) return;   // already here
      a.classList.add("fw-pending");
      setBusy(true);
    };
    // Start fetching a page as soon as the pointer rests on its link
    const seen = new Set<string>();
    const onOver = (e: MouseEvent) => {
      const a = linkOf(e.target); if (!a) return;
      const u = inApp(a); if (!u) return;
      const href = u.pathname + u.search;
      if (seen.has(href)) return;
      seen.add(href);
      try { router.prefetch(href, { kind: "full" as never }); } catch { /* prefetch is only a speed-up */ }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onOver, { passive: true });
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("mouseover", onOver); };
  }, [router]);

  // Safety: never leave the line running if a navigation was cancelled
  useEffect(() => { if (!busy) return; const t = setTimeout(() => setBusy(false), 15000); return () => clearTimeout(t); }, [busy]);

  return (
    <>
      <style>{`
        .fw-navbar { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 9999; pointer-events: none; overflow: hidden; }
        .fw-navbar::before { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, #D9B56F, #C9A24A, transparent); animation: fw-nav 1.1s ease-in-out infinite; }
        @keyframes fw-nav { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
        a.fw-pending { opacity: 0.75; cursor: progress; }
        .fw-topicons a.fw-pending .ic { box-shadow: 0 0 0 2px #C9A24A inset; }
        @media (prefers-reduced-motion: reduce) { .fw-navbar::before { animation: none; width: 100%; opacity: 0.6; } }
      `}</style>
      {busy && <div className="fw-navbar" role="progressbar" aria-label="Opening page" />}
    </>
  );
}
