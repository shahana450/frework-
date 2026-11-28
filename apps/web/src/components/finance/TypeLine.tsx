"use client";
// A line that types out one phrase, pauses, erases it and types the next — the "dynamic text" in the Home hero.
// Screen readers get the whole list once; people who prefer reduced motion see the phrases swap without typing.
import { useEffect, useState } from "react";

export default function TypeLine({ lead, phrases, className, style }: { lead: string; phrases: string[]; className?: string; style?: React.CSSProperties }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState("");
  const [del, setDel] = useState(false);
  const [calm, setCalm] = useState(false);
  useEffect(() => { try { setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* */ } }, []);
  useEffect(() => {
    const word = phrases[i % phrases.length] ?? "";
    if (calm) { setShown(word); const t = setTimeout(() => setI(x => x + 1), 3200); return () => clearTimeout(t); }
    let t: ReturnType<typeof setTimeout>;
    if (!del && shown.length < word.length) t = setTimeout(() => setShown(word.slice(0, shown.length + 1)), 42 + Math.random() * 40);
    else if (!del) t = setTimeout(() => setDel(true), 1900);
    else if (shown.length > 0) t = setTimeout(() => setShown(word.slice(0, shown.length - 1)), 22);
    else { setDel(false); setI(x => x + 1); return; }
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, del, i, phrases.join("|"), calm]);
  return (
    <div className={className} style={style}>
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{lead} {phrases.join(", ")}.</span>
      <span aria-hidden="true">
        {lead} <span className="tl-word">{shown}</span><span className="tl-caret" />
      </span>
      <style>{`.tl-word{color:#E9C27A;font-style:italic}.tl-caret{display:inline-block;width:2px;height:1em;margin-left:3px;vertical-align:-0.12em;background:#E9C27A;animation:tlBlink 1s steps(1) infinite}@keyframes tlBlink{50%{opacity:0}}@media (prefers-reduced-motion:reduce){.tl-caret{display:none}}`}</style>
    </div>
  );
}
