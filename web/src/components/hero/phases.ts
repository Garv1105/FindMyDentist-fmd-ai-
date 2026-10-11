/** Named phases of the cinematic hero, as progress (0..1) through the pinned section. */
export const PHASES = {
  title: [0.04, 0.16], // A: headline leaves
  core: [0.04, 0.18], // A: centre light intensifies, sky darkens
  spread: [0.08, 0.4], // A→B: light travels along the rim
  revealAt: 0.78, // B: mascot may start once 78% of the rim is lit
  rise: 0.52, // C: ascent + rotation complete
  settle: 0.56, // C: overshoot settles
  mascotOut: [0.6, 0.64], // D: mascot leaves before the assistant arrives
  ai: [0.645, 0.69, 0.8, 0.84], // D: assistant in / hold / out
  mascotBack: [0.845, 0.865], // E: mascot returns at rest…
  descend: 0.97, // E: …then reverses into the horizon; pin releases at 1
};

/** Progress at which the rim is `revealAt` lit — the earliest the mascot may move. */
export const REVEAL = PHASES.spread[0] + PHASES.revealAt * (PHASES.spread[1] - PHASES.spread[0]);

/** Keyframe inputs shared by every mascot transform. */
export const MASCOT_KEYS = [
  0, REVEAL, PHASES.rise, PHASES.settle, ...PHASES.mascotOut, ...PHASES.mascotBack, PHASES.descend, 1,
];
export const MASCOT_OPACITY = [1, 1, 1, 1, 1, 0, 0, 1, 1, 1];

/** Piecewise-linear lookup, same as motion's useTransform with clamping. */
export function at(p: number, xs: number[], ys: number[]) {
  if (p <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (p <= xs[i]) return ys[i - 1] + ((p - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  }
  return ys[ys.length - 1];
}
