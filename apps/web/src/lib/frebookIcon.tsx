import { ImageResponse } from "next/og";

/** The FreBook app icon as a PNG: navy tile, white open book with three dots. Opaque, so iPhone shows it cleanly. */
export function frebookIcon(size: number, maskable = false) {
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#424879,#2C3263)" }}>
        <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 22 C25 17 17 16 10 17.5 V45 C17 43.5 25 44.5 32 49" />
          <path d="M32 22 C39 17 47 16 54 17.5 V45 C47 43.5 39 44.5 32 49" />
          <path d="M32 22 V49" />
          <circle cx="32" cy="18" r="4.5" fill="#FFFFFF" stroke="none" />
          <circle cx="10" cy="47" r="4.5" fill="#FFFFFF" stroke="none" />
          <circle cx="54" cy="47" r="4.5" fill="#FFFFFF" stroke="none" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
