import Link from "next/link";

export default function ListingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#070C1A" }}>
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
          style={{ background: "rgba(201,168,76,0.12)", border: "2px solid rgba(201,168,76,0.3)" }}>
          🏛️
        </div>
        <h1 className="text-2xl font-black mb-3" style={{ color: "#EDE8DC" }}>Listing Submitted!</h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "#8A9BB8" }}>
          Thank you for listing your space on FreWork. Our team will review your details within 24 hours and contact you on WhatsApp or email to confirm.
        </p>
        <div className="rounded-2xl border p-5 mb-8 text-left space-y-3" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.15)" }}>
          <p className="text-xs font-black tracking-widest uppercase" style={{ color: "#C9A84C" }}>What happens next</p>
          {[
            "Our team reviews your listing (within 24 hrs)",
            "We may WhatsApp you to verify details or request photos",
            "Once approved, your space goes live on frework.online/coworking",
            "Interested customers can directly contact you via WhatsApp",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3 text-sm" style={{ color: "#8A9BB8" }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}>
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/"
            className="px-6 py-3 rounded-xl text-sm font-bold border transition-all hover:opacity-80"
            style={{ borderColor: "rgba(201,168,76,0.2)", color: "#C9A84C", background: "rgba(201,168,76,0.06)" }}>
            Back to Home
          </Link>
          <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20just%20submitted%20my%20coworking%20space%20listing."
            target="_blank" rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
            WhatsApp Us
          </a>
        </div>
      </div>
    </div>
  );
}
