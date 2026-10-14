/**
 * Named phases of the cinematic hero, as progress (0..1) through the pinned section.
 * One scroll source drives all of them; the mascot and the assistant are never on screen together.
 *
 *   0 ─ title fades, light awakens ─ mascot rises & grows ─ hold ─ mascot fades ─ AI chat ─ 1 (pin releases)
 *
 * Once the assistant is fully in, only a short tail (~0.16 of the pin) remains before the pin releases: a long
 * pinned stretch where nothing moves reads as the page being stuck.
 */
export const PHASES = {
  title: [0.03, 0.16], // A: headline leaves
  core: [0.03, 0.19], // A: centre light intensifies, sky darkens
  spread: [0.04, 0.49], // A→C: light travels along the rim, still spreading as the mascot rises
  rise: [0.08, 0.51], // C: mascot emerges small from behind the rim and grows into its pose
  hold: [0.51, 0.62], // D: settled pose, held briefly
  mascotOut: [0.62, 0.71], // E: fade + slight recede, once
  ai: [0.71, 0.84], // F: assistant fades in the instant the mascot is gone; short tail, then the pin releases
};

/** Keyframe inputs shared by every mascot transform (strictly increasing). */
export const MASCOT_KEYS = [
  0,
  PHASES.rise[0],
  0.16, // quarter of the way up: still small, mostly behind the rim
  0.27,
  0.39,
  PHASES.rise[1],
  PHASES.mascotOut[0],
  PHASES.mascotOut[1],
  1,
];
export const MASCOT_OPACITY = [0, 0, 1, 1, 1, 1, 1, 0, 0];

/** Piecewise-linear lookup, same as motion's useTransform with clamping. */
export function at(p: number, xs: number[], ys: number[]) {
  if (p <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (p <= xs[i]) return ys[i - 1] + ((p - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  }
  return ys[ys.length - 1];
}
