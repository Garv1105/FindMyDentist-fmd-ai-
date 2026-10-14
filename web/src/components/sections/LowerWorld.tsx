import type { ReactNode } from "react";

/**
 * One continuous midnight-navy / royal-sapphire atmosphere behind every section after the AI block.
 * Scoped to this wrapper (own stacking context) so nothing leaks into the hero or global tokens.
 * Pure CSS gradients + one inline SVG, no images, no JS.
 */
export default function LowerWorld({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate mt-20 pb-10 sm:mt-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(180deg,transparent,#000_7%,#000_96%,transparent)]"
      >
        {/* base: deep navy that swells toward the middle */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,9,26,0)_0%,rgba(7,14,34,0.85)_16%,rgba(9,20,48,0.9)_50%,rgba(7,14,34,0.9)_84%,rgba(5,8,22,0.95)_100%)]" />
        {/* soft sapphire light pools, placed off-axis so no section sits in a spotlight */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(48% 9% at 88% 6%, rgba(38,98,232,0.16), transparent 70%)," +
              "radial-gradient(42% 8% at 6% 30%, rgba(30,84,214,0.12), transparent 70%)," +
              "radial-gradient(46% 9% at 94% 56%, rgba(28,92,226,0.13), transparent 70%)," +
              "radial-gradient(40% 8% at 8% 84%, rgba(40,104,236,0.12), transparent 70%)",
          }}
        />
        {/* fine particles */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(215,225,255,0.55) 0.6px, transparent 1.2px)," +
              "radial-gradient(circle, rgba(170,198,245,0.4) 0.5px, transparent 1.1px)",
            backgroundSize: "170px 170px, 263px 263px",
            backgroundPosition: "0 0, 71px 113px",
            maskImage: "radial-gradient(70% 60% at 50% 50%, #000, transparent)",
          }}
        />
        {/* flowing contours */}
        <svg className="absolute inset-0 size-full" viewBox="0 0 1440 3000" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="lw-line" x1="0" x2="1">
              <stop offset="0" stopColor="#6f98ee" stopOpacity="0" />
              <stop offset="0.5" stopColor="#a9c4f2" stopOpacity="0.22" />
              <stop offset="1" stopColor="#6f98ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M-60 380 C 360 220, 700 620, 1500 360" stroke="url(#lw-line)" />
          <path d="M-60 1180 C 420 1020, 900 1400, 1500 1120" stroke="url(#lw-line)" />
          <path d="M-60 1880 C 380 1740, 860 2100, 1500 1840" stroke="url(#lw-line)" />
          <path d="M-60 2620 C 500 2480, 940 2760, 1500 2560" stroke="url(#lw-line)" />
        </svg>
      </div>
      {children}
    </div>
  );
}
