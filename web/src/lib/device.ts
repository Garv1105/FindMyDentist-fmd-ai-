/**
 * Phones and low-memory devices (narrow screen, or the browser reports ≤ 4 GB) load the lighter model builds: the hero's
 * mascot-sitting-raw-mobile.glb, models/rig-mobile/ and models/assistant-mobile.glb (same look, ~half the triangles;
 * desktops keep the originals). Always false on the server: only file paths differ, and the markup never shows them.
 */
export const LIGHT_DEVICE =
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 767px)").matches || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4);

/** A section mascot's path under web/public: the phone build on light devices. */
export const rigPath = (name: string) => `/models/${LIGHT_DEVICE ? "rig-mobile" : "rig"}/${name}.glb`;
