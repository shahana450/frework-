export function FreWorkLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fw_logo_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F2044" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="9" fill="url(#fw_logo_bg)" />
      <g stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round">
        <line x1="19" y1="19" x2="19" y2="11" />
        <line x1="19" y1="19" x2="26.5" y2="24" />
        <line x1="19" y1="19" x2="11.5" y2="24" />
      </g>
      <circle cx="19" cy="19" r="3" fill="white" />
      <circle cx="19" cy="11" r="2" fill="rgba(255,255,255,0.9)" />
      <circle cx="26.5" cy="24" r="2" fill="rgba(255,255,255,0.9)" />
      <circle cx="11.5" cy="24" r="2" fill="rgba(255,255,255,0.9)" />
    </svg>
  );
}
