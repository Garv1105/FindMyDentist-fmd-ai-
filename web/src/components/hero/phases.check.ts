// Run: npm test — asserts the hero timeline invariants from the brief.
import assert from "node:assert/strict";
import { MASCOT_KEYS, MASCOT_OPACITY, PHASES, REVEAL, at } from "./phases.ts";

const spreadAt = (p: number) => at(p, PHASES.spread, [0, 1]);
const aiAt = (p: number) => at(p, PHASES.ai, [0, 1, 1, 0]);
const mascotAt = (p: number) => at(p, MASCOT_KEYS, MASCOT_OPACITY);

// keyframe inputs must be strictly increasing or useTransform misbehaves
for (let i = 1; i < MASCOT_KEYS.length; i++) assert.ok(MASCOT_KEYS[i] > MASCOT_KEYS[i - 1], `MASCOT_KEYS[${i}]`);

// mascot starts only once 75–80% of the horizon is lit
const lit = spreadAt(REVEAL);
assert.ok(lit >= 0.75 && lit <= 0.8, `reveal at ${lit}`);
assert.ok(PHASES.title[1] < REVEAL, "headline is gone before the mascot");

// the assistant and the mascot are never on screen together
for (let p = 0; p <= 1; p += 0.0005) {
  assert.ok(!(aiAt(p) > 0 && mascotAt(p) > 0), `overlap at p=${p.toFixed(4)}`);
}
// the assistant appears only after the ascent completes
assert.ok(PHASES.ai[0] > PHASES.settle);

console.log("hero phases ok");
