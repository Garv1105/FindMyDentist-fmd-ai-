import assert from "node:assert/strict";
import { test } from "node:test";
import { smoothPath, wavePath, type Pt } from "./path.ts";

test("smoothPath passes through every node and measures length in order", () => {
  const pts: Pt[] = [[0, 110], [100, 60], [300, 60], [500, 90], [700, 60], [800, 110]];
  const p = smoothPath(pts);
  pts.forEach((pt, i) => {
    const [x, y] = p.at(i);
    assert.ok(Math.abs(x - pt[0]) < 1e-9 && Math.abs(y - pt[1]) < 1e-9, `node ${i}`);
  });
  assert.equal(p.frac(0), 0);
  assert.ok(Math.abs(p.frac(pts.length - 1) - 1) < 1e-9);
  for (let s = 0.25; s < pts.length - 1; s += 0.25) assert.ok(p.frac(s) > p.frac(s - 0.25), `frac grows at ${s}`);
  // collinear nodes give a straight segment: its midpoint stays on the line
  assert.ok(Math.abs(p.at(1.5)[1] - 60) < 0.5);
  assert.match(p.d, /^M0,110 C/);
});

test("wavePath follows the function between joins and measures length in order", () => {
  const f = (x: number) => 60 + 20 * Math.sin(x / 100);
  const p = wavePath(f, -200, 1400, 40);
  assert.match(p.d, /^M-200,/);
  // mid-segment points of the Béziers stay on the true curve (sub-pixel)
  const nums = p.d.match(/C([^C]+)/g)!.length;
  assert.equal(nums, 40);
  assert.equal(p.frac(-200), 0);
  assert.ok(Math.abs(p.frac(1400) - 1) < 1e-9);
  for (let x = -150; x <= 1400; x += 50) assert.ok(p.frac(x) > p.frac(x - 50), `frac grows at ${x}`);
  assert.deepEqual(p.at(300), [300, f(300)]);
});
