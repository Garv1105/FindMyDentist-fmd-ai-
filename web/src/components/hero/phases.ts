/**
 * Named phases of the cinematic hero, as progress (0..1) through the pinned section.
 * One scroll source drives all of them; the mascot and the assistant are never on screen together.
 *
 *   0 ─ title fades, light awakens ─ mascot rises & grows ─ long hold (speech bubble) ─ mascot fades ─ AI chat ─ 1
 *
 * Once the assistant is fully in, only a short tail (~0.16 of the pin) remains before the pin releases: a long
 * pinned stretch where nothing moves reads as the page being stuck.
 */
export const PHASES = {
  title: [0.02, 0.105], // A: headline leaves
  core: [0.02, 0.125], // A: centre light intensifies, sky darkens
  spread: [0.03, 0.33], // A→C: light travels along the rim, still spreading as the mascot rises
  rise: [0.05, 0.335], // C: mascot emerges small from behind the rim and grows into its pose
  hold: [0.335, 0.74], // D: settled pose, held for a long stretch of scroll (~1.3 screens on desktop)
  say: [0.36, 0.71], // D: speech bubble "I will take over", shown while it holds
  mascotOut: [0.74, 0.8], // E: fade + slight recede, once
  ai: [0.8, 0.89], // F: assistant fades in the instant the mascot is gone; short tail, then the pin releases
};

/** Keyframe inputs shared by every mascot transform (strictly increasing). */
export const MASCOT_KEYS = [
  0,
  PHASES.rise[0],
  0.103, // a fifth of the way up: still small, mostly behind the rim
  0.176,
  0.255,
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
