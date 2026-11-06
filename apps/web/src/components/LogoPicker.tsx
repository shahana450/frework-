"use client";
import { useState } from "react";

/** Resize an image file in the browser to fit maxSide px; returns a PNG/JPEG data URL. */
export function resizeLogo(file: File, maxSide = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) { reject(new Error("Choose a PNG, JPG, WebP or SVG image.")); return; }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round((img.width || maxSide) * scale)); cv.height = Math.max(1, Math.round((img.height || maxSide) * scale));
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      let url = cv.toDataURL("image/png");
      if (url.length > 280_000) url = cv.toDataURL("image/jpeg", 0.85); // photos compress better as JPEG
      resolve(url);
    };
    img.onerror = () => reject(new Error("That image couldn't be read."));
    img.src = URL.createObjectURL(file);
  });
}

// The same picker for the business logo and the authorised signatory's signature
const KINDS = {
  logo: { word: "logo", alt: "Business logo", box: [84, 84], side: 360, hint: "PNG with a transparent background looks best. Shown on your invoices." },
  signature: { word: "signature", alt: "Authorised signature", box: [150, 70], side: 480, hint: "Sign on white paper and photograph it, or use a PNG with a transparent background. Shown above “Authorised signatory”." },
} as const;

export default function LogoPicker({ value, onChange, disabled, kind = "logo", compact }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean; kind?: keyof typeof KINDS; compact?: boolean }) {
  const [err, setErr] = useState("");
  const k = KINDS[kind];
  const [w, h] = compact ? [Math.round(k.box[0] * 0.7), Math.round(k.box[1] * 0.7)] : k.box;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 14, flexWrap: "wrap" }}>
      <span style={{ width: w, height: h, borderRadius: 12, border: value ? "1px solid #E1E4EE" : "1.5px dashed #C9CEDF", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {value ? <img src={value} alt={k.alt} style={{ maxWidth: "88%", maxHeight: "88%", objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: "#5A6080", textAlign: "center" }}>No {k.word}</span>}
      </span>
      {!disabled && (
        <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ display: "flex", gap: 8 }}>
            <label style={{ height: compact ? 32 : 38, padding: "0 14px", borderRadius: 10, border: "1px solid #C9CEDF", background: "#FFFFFF", color: "#141A3A", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", cursor: "pointer" }}>
              {value ? `Change ${k.word}` : `Upload ${k.word}`}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }}
                onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setErr(""); try { onChange(await resizeLogo(f, k.side)); } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't use that image."); } }} />
            </label>
            {value && <button type="button" onClick={() => onChange(null)} style={{ height: compact ? 32 : 38, padding: "0 12px", borderRadius: 10, border: "none", background: "transparent", color: "#C2321F", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Remove</button>}
          </span>
          {(!compact || err) && <span style={{ fontSize: 12, color: err ? "#C2321F" : "#5A6080", maxWidth: 360 }}>{err || k.hint}</span>}
        </span>
      )}
    </div>
  );
}
