/**
 * Low-memory devices and narrow windows (the browser reports ≤ 4 GB, or under 768 px) get the lighter section-mascot
 * builds in models/rig-mobile (same look, about a third smaller); phones play pre-rendered loops instead.
 * Desktops keep the originals. Always false on the server: only file paths differ, and the markup never shows them.
 */
export const LIGHT_DEVICE =
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 767px)").matches || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4);

/** A section mascot's path under web/public: the phone build on light devices. */
export const rigPath = (name: string) => `/models/${LIGHT_DEVICE ? "rig-mobile" : "rig"}/${name}.glb`;
