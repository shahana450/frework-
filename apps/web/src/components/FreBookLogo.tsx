// FreBook brand: navy tile with an open book whose spine and corners are connected nodes.
export const FREBOOK_NAVY = "#1E2457";
export const FREBOOK_TILE = "#363C6E";

export function FreBookBookGlyph({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M32 22 C25 17 17 16 10 17.5 V45 C17 43.5 25 44.5 32 49" />
      <path d="M32 22 C39 17 47 16 54 17.5 V45 C47 43.5 39 44.5 32 49" />
      <path d="M32 22 V49" />
      <circle cx="32" cy="18" r="4.5" fill={color} stroke="none" />
      <circle cx="10" cy="47" r="4.5" fill={color} stroke="none" />
      <circle cx="54" cy="47" r="4.5" fill={color} stroke="none" />
    </svg>
  );
}

export function FreBookMark({ size = 32 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.24, background: `linear-gradient(160deg, #424879, ${FREBOOK_TILE})`, border: "1px solid rgba(255,255,255,0.22)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}>
      <FreBookBookGlyph size={size * 0.68} />
    </span>
  );
}

export function FreBookLogo({ size = 32, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}>
      <FreBookMark size={size} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: size * 0.62, color: "#141A3A", letterSpacing: "0.01em" }}>Fre<strong>Book</strong></span>
        {tagline && <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: Math.max(9, size * 0.24), color: "#5A6080", marginTop: size * 0.08 }}>Chat in. Books out.</span>}
      </span>
    </span>
  );
}
