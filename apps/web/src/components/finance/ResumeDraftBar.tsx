"use client";
// "You have an unfinished import" — shown at the top of an import screen when work from earlier wasn't all posted.
import { draftAge, type ImportDraft } from "@/lib/importDraft";

export default function ResumeDraftBar({ draft, onResume, onDiscard }: { draft: ImportDraft; onResume: () => void; onDiscard: () => void }) {
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 14, background: "#FFF4DB", border: "1px solid #F2D29B", color: "#5A3A00" }}>
      <span aria-hidden="true" style={{ fontSize: 20 }}>📝</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Unfinished import — {draft.title}</div>
        <div style={{ fontSize: 12.5 }}>{draft.pending} entr{draft.pending === 1 ? "y" : "ies"} not posted yet{draft.posted ? ` · ${draft.posted} already posted` : ""} · saved {draftAge(draft.savedAt)} on this device</div>
      </div>
      <button onClick={onResume} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: "#0F2B25", color: "#FFFFFF", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Resume</button>
      <button onClick={onDiscard} style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid #E0C48A", background: "transparent", color: "#5A3A00", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Discard</button>
    </div>
  );
}
