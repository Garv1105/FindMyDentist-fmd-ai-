// Hero timeline invariants from the brief (run with npm test).
import assert from "node:assert/strict";
import { MASCOT_KEYS, MASCOT_OPACITY, PHASES, at } from "./phases.ts";
import { RIM, RIM_APEX, RIM_H, RIM_W, rimPath, rimYAt } from "./rim.ts";

const aiAt = (p: number) => at(p, PHASES.ai, [0, 1]);
const mascotAt = (p: number) => at(p, MASCOT_KEYS, MASCOT_OPACITY);

// keyframe inputs must be strictly increasing or useTransform misbehaves
for (let i = 1; i < MASCOT_KEYS.length; i++) assert.ok(MASCOT_KEYS[i] > MASCOT_KEYS[i - 1], `MASCOT_KEYS[${i}]`);
assert.equal(MASCOT_KEYS.length, MASCOT_OPACITY.length);
for (const [name, [a, b]] of Object.entries(PHASES)) assert.ok(a < b && a >= 0 && b <= 1, `${name} range`);

// the mascot begins shortly after the headline starts leaving, and is still tiny when it does
assert.ok(PHASES.rise[0] > PHASES.title[0], "mascot starts after the headline begins to fade");
assert.ok(PHASES.rise[0] < PHASES.title[1], "mascot starts while the headline is still leaving: no empty stretch");
// no dead interval: something is always moving from the first scroll until the assistant is fully in
const moving = (p: number) =>
  (p >= PHASES.title[0] && p <= PHASES.title[1]) ||
  (p >= PHASES.spread[0] && p <= PHASES.spread[1]) ||
  (p >= PHASES.rise[0] && p <= PHASES.rise[1]) ||
  (p >= PHASES.mascotOut[0] && p <= PHASES.mascotOut[1]) ||
  (p >= PHASES.ai[0] && p <= PHASES.ai[1]);
for (let p = PHASES.title[0]; p <= PHASES.ai[1]; p += 0.0005) {
  // the settled-pose hold is the one intentional pause (the mascot says its line there)
  const hold = p > PHASES.rise[1] && p < PHASES.mascotOut[0];
  assert.ok(moving(p) || hold, `dead scroll interval at p=${p.toFixed(4)}`);
}
assert.ok(PHASES.mascotOut[0] - PHASES.rise[1] >= 0.3, "mascot stays on screen for a long stretch of scroll");
// the speech bubble only shows once the mascot has fully risen, and is gone before it leaves
assert.ok(PHASES.say[0] >= PHASES.rise[1] && PHASES.say[1] <= PHASES.mascotOut[0], "bubble inside the hold");

// the assistant and the mascot are never on screen together
for (let p = 0; p <= 1; p += 0.0005) {
  assert.ok(!(aiAt(p) > 0 && mascotAt(p) > 0), `overlap at p=${p.toFixed(4)}`);
}
// the assistant appears only after the mascot has finished leaving
assert.ok(PHASES.ai[0] >= PHASES.mascotOut[1]);
// the mascot disappears exactly once: opacity never rises again after it starts to leave
for (let p = PHASES.mascotOut[1]; p <= 1; p += 0.001) assert.equal(mascotAt(p), 0, `mascot visible again at ${p}`);

// horizon geometry: measured rim covers the full band, is monotonic away from the apex, and the apex is central
assert.equal(RIM[0][0], 0);
assert.equal(RIM[RIM.length - 1][0], RIM_W);
assert.ok(Math.abs(RIM_APEX[0] - RIM_W / 2) <= 160, "rim apex is near the centre");
for (let i = 1; i < RIM.length; i++) {
  const x = RIM[i][0];
  const prev = RIM[i - 1][1];
  assert.ok(x <= RIM_APEX[0] ? RIM[i][1] <= prev : RIM[i][1] >= prev, `rim not monotonic at x=${x}`);
}
assert.ok(RIM.every(([, y]) => y > 0 && y < RIM_H));
assert.equal(rimYAt(RIM_APEX[0]), RIM_APEX[1]);
assert.ok(rimPath(RIM_APEX[0], 0).startsWith(`M${RIM_APEX[0]} `) && rimPath(RIM_APEX[0], RIM_W).endsWith(`${RIM_W} ${rimYAt(RIM_W).toFixed(1)}`));

console.log("hero phases ok");
