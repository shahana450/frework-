import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FreWork — GST Registration, IT Filing & CA Services Online India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #1A1208 0%, #2C1F0A 60%, #3D2A0C 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div style={{ position: "absolute", top: "-100px", left: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(184,144,58,0.15) 0%, transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "-100px", right: "-100px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(184,144,58,0.1) 0%, transparent 70%)", display: "flex" }} />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #B8903A, #E8C97A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#1A1208", fontSize: "28px", fontWeight: "900" }}>F</span>
          </div>
          <span style={{ color: "#FAFAF5", fontSize: "40px", fontWeight: "900", letterSpacing: "-1px" }}>
            Fre<span style={{ color: "#E8C97A" }}>Work</span>
          </span>
          <span style={{ background: "rgba(184,144,58,0.2)", border: "1px solid rgba(184,144,58,0.4)", color: "#E8C97A", fontSize: "13px", fontWeight: "700", padding: "4px 10px", borderRadius: "20px", letterSpacing: "2px" }}>BETA</span>
        </div>

        {/* Headline */}
        <div style={{ color: "#FAFAF5", fontSize: "48px", fontWeight: "900", textAlign: "center", lineHeight: 1.1, maxWidth: "900px", marginBottom: "20px" }}>
          GST Registration, IT Filing &{" "}
          <span style={{ color: "#E8C97A" }}>CA Services Online India</span>
        </div>

        {/* Subline */}
        <div style={{ color: "#9C8B70", fontSize: "22px", textAlign: "center", maxWidth: "700px", marginBottom: "36px", lineHeight: 1.4 }}>
          Company Registration · GST Filing · Income Tax · Accounting · Audit
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["⭐ 4.9/5 Rating", "✅ 500+ Businesses", "🏛️ expert-qualified", "🇮🇳 Pan India Service"].map((b) => (
            <div key={b} style={{ background: "rgba(184,144,58,0.12)", border: "1px solid rgba(184,144,58,0.3)", color: "#E8C97A", fontSize: "15px", fontWeight: "700", padding: "8px 18px", borderRadius: "30px", display: "flex" }}>
              {b}
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: "absolute", bottom: "28px", color: "rgba(156,139,112,0.7)", fontSize: "16px", letterSpacing: "1px" }}>
          frework.online
        </div>
      </div>
    ),
    { ...size }
  );
}
