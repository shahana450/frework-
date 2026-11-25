"use client";
import { useEffect } from "react";

// Every <input list="…"> in the app gets FreBook's own dropdown instead of the browser's plain one (which can't be styled):
// matches first, the typed letters in bold, ↑ ↓ Enter Esc, and it stays under the box while the page scrolls.
const CSS = `
.fw-dl{position:fixed;z-index:2147483000;min-width:220px;max-height:320px;overflow-y:auto;padding:6px;border-radius:16px;background:#FFFDF8;border:1px solid #EFE2C4;box-shadow:0 24px 48px -20px rgba(11,44,37,.45),0 2px 6px rgba(11,44,37,.06);font-family:inherit;animation:fwdl .12s ease-out}
@keyframes fwdl{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fw-dl{animation:none}}
.fw-dl-i{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-size:13.5px;color:#0B2C25;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fw-dl-i::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#E6DFD0}
.fw-dl-t{min-width:0;overflow:hidden;text-overflow:ellipsis}
.fw-dl-i b{font-weight:800;color:#9A6B22}
.fw-dl-i.on{background:#0B2C25;color:#FFFFFF}.fw-dl-i.on b{color:#E9C27A}.fw-dl-i.on::before{background:#E9C27A}
.fw-dl-i.cur::after{content:"✓";margin-left:auto;font-weight:800;color:#0B7A55}.fw-dl-i.on.cur::after{color:#7FE0B4}
.fw-dl-h{padding:6px 12px 4px;font-size:10.5px;font-weight:800;letter-spacing:.14em;color:#9A6B22}
.fw-dl-f{padding:8px 12px 4px;font-size:11.5px;color:#5E6B66;border-top:1px solid #F1E8D6;margin-top:4px}
.fw-dl::-webkit-scrollbar{width:8px}.fw-dl::-webkit-scrollbar-thumb{background:#E6DFD0;border-radius:8px}
`;
const MAX = 60;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export default function DatalistEnhancer() {
  useEffect(() => {
    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    const box = document.createElement("div"); box.className = "fw-dl"; box.setAttribute("role", "listbox"); box.style.display = "none";
    document.body.appendChild(box);
    let input: HTMLInputElement | null = null, items: string[] = [], active = -1;
    const setValue = (el: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const options = (el: HTMLInputElement) => {
      const dl = document.getElementById(el.dataset.fwlist ?? "");
      if (!dl) return [];
      const seen = new Set<string>(), out: string[] = [];
      dl.querySelectorAll("option").forEach(o => { const v = (o.value || o.textContent || "").trim(); if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); } });
      return out;
    };
    const place = () => {
      if (!input) return;
      const r = input.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      box.style.left = `${Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8)}px`;
      box.style.width = `${Math.max(r.width, 220)}px`;
      if (below < 200 && r.top > below) { box.style.top = ""; box.style.bottom = `${window.innerHeight - r.top + 6}px`; box.style.maxHeight = `${Math.min(320, r.top - 16)}px`; }
      else { box.style.bottom = ""; box.style.top = `${r.bottom + 6}px`; box.style.maxHeight = `${Math.min(320, below - 16)}px`; }
    };
    const hide = () => { box.style.display = "none"; active = -1; input?.setAttribute("aria-expanded", "false"); };
    const render = () => {
      if (!input) return;
      const all = options(input);
      const q = input.value.trim().toLowerCase();
      const exact = all.some(v => v.toLowerCase() === q);
      const pool = q && !exact ? all.filter(v => v.toLowerCase().includes(q)) : all;
      // Starts-with first, then contains
      pool.sort((a, b) => q && !exact ? Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)) : 0);
      items = pool.slice(0, MAX);
      if (!items.length) { hide(); return; }
      if (active >= items.length) active = items.length - 1;
      const mark = (v: string) => { if (!q || exact) return esc(v); const i = v.toLowerCase().indexOf(q); return i < 0 ? esc(v) : esc(v.slice(0, i)) + "<b>" + esc(v.slice(i, i + q.length)) + "</b>" + esc(v.slice(i + q.length)); };
      box.innerHTML = (q && !exact ? `<div class="fw-dl-h">${pool.length} MATCH${pool.length === 1 ? "" : "ES"}</div>` : "")
        + items.map((v, i) => `<div class="fw-dl-i${i === active ? " on" : ""}${v.toLowerCase() === q ? " cur" : ""}" role="option" aria-selected="${i === active}" data-i="${i}" title="${esc(v)}"><span class="fw-dl-t">${mark(v)}</span></div>`).join("")
        + (pool.length > MAX ? `<div class="fw-dl-f">${pool.length - MAX} more — keep typing to narrow</div>` : "");
      box.style.display = "block"; input.setAttribute("aria-expanded", "true");
      place();
      box.querySelector(".fw-dl-i.on")?.scrollIntoView({ block: "nearest" });
    };
    const adopt = (el: EventTarget | null) => {
      if (!(el instanceof HTMLInputElement)) return null;
      const id = el.getAttribute("list");
      if (id) { el.dataset.fwlist = id; el.removeAttribute("list"); el.setAttribute("autocomplete", "off"); el.setAttribute("role", "combobox"); el.setAttribute("aria-autocomplete", "list"); }
      return el.dataset.fwlist ? el : null;
    };
    // Take over list inputs as soon as they appear, so the browser's own popup never shows
    const sweep = () => document.querySelectorAll<HTMLInputElement>("input[list]").forEach(el => adopt(el));
    sweep();
    const mo = new MutationObserver(sweep);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["list"] });

    const onFocus = (e: FocusEvent) => { const el = adopt(e.target); if (!el) return; input = el; active = -1; render(); };
    const onInput = (e: Event) => { if (e.target === input && e.isTrusted) { active = -1; render(); } };
    const onBlur = (e: FocusEvent) => { if (e.target === input) setTimeout(() => { if (document.activeElement !== input) { hide(); input = null; } }, 120); };
    const pick = (i: number) => { const el = input; if (!el || !items[i]) return; setValue(el, items[i]); hide(); el.blur(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== input) return;
      if (box.style.display === "none") { if (e.key === "ArrowDown") { render(); e.preventDefault(); } return; }
      if (e.key === "ArrowDown") { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter" && active >= 0) { pick(active); e.preventDefault(); }
      else if (e.key === "Escape") { hide(); e.preventDefault(); }
      else if (e.key === "Tab" && active >= 0) pick(active);
    };
    const onDown = (e: MouseEvent) => { const t = (e.target as HTMLElement).closest(".fw-dl-i") as HTMLElement | null; e.preventDefault(); if (t) pick(Number(t.dataset.i)); };
    const onMove = (e: MouseEvent) => { const t = (e.target as HTMLElement).closest(".fw-dl-i") as HTMLElement | null; if (t && Number(t.dataset.i) !== active) { active = Number(t.dataset.i); box.querySelectorAll(".fw-dl-i").forEach((n, i) => n.classList.toggle("on", i === active)); } };
    const onScroll = () => { if (box.style.display !== "none") place(); };
    document.addEventListener("focusin", onFocus); document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onBlur); document.addEventListener("keydown", onKey, true);
    box.addEventListener("mousedown", onDown); box.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, true); window.addEventListener("resize", onScroll);
    return () => {
      mo.disconnect(); box.remove(); style.remove();
      document.removeEventListener("focusin", onFocus); document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onBlur); document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll);
    };
  }, []);
  return null;
}
