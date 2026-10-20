// Shared geometry for the Walkthrough and Journey paths: one smooth curve through the nodes, so the line, the travelling
// light and the guide all sit on exactly the same path.

export type Pt = [number, number];
type Seg = [Pt, Pt, Pt, Pt];

const bez = ([a, b, c, d]: Seg, t: number): Pt => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
};

/**
 * Smooth path through `pts` (cubic Béziers with Catmull-Rom spacing and level tangents). Positions are in "point units": s = 2 is pts[2],
 * s = 2.5 is halfway along the segment to pts[3].
 *  - d:    the SVG path data
 *  - at:   the (x, y) at position s
 *  - frac: how far along the path's length position s is (0–1), for pathLength / pathOffset
 */
export function smoothPath(pts: Pt[]) {
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[i + 2] ?? p2;
    // horizontal tangent at every point: level runs stay straight and the wave crests exactly on each node
    segs.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1]], [p2[0] - (p3[0] - p1[0]) / 6, p2[1]], p2]);
  }
  const lens = segs.map((seg) => {
    let len = 0;
    let prev = seg[0];
    for (let k = 1; k <= 32; k++) {
      const p = bez(seg, k / 32);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    return len;
  });
  const before = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const total = before[before.length - 1] + lens[lens.length - 1];
  const split = (s: number) => {
    const i = Math.min(segs.length - 1, Math.max(0, Math.floor(s)));
    return [i, Math.min(1, Math.max(0, s - i))] as const;
  };
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    d: `M${pts[0].map(r)} ` + segs.map(([, a, b, c]) => `C${a.map(r)} ${b.map(r)} ${c.map(r)}`).join(" "),
    at: (s: number): Pt => {
      const [i, t] = split(s);
      return bez(segs[i], t);
    },
    // ponytail: linear in t within a segment, not true arc length; within a pixel for these gentle curves
    frac: (s: number) => {
      const [i, t] = split(s);
      return (before[i] + lens[i] * t) / total;
    },
  };
}

/**
 * A precise smooth curve y = f(x) from x0 to x1: n cubic Béziers whose control points follow the curve's own slope
 * (Hermite form), so the joins are invisible and a sine stays a sine. Control x's sit at thirds, which makes x linear
 * in t on every segment, so `frac(x)` (how far along the length x is, 0–1) needs no search.
 */
export function wavePath(f: (x: number) => number, x0: number, x1: number, n = 48) {
  const h = (x1 - x0) / n;
  const df = (x: number) => (f(x + 0.01) - f(x - 0.01)) / 0.02;
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M${r(x0)},${r(f(x0))}`;
  const lens: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = x0 + k * h;
    const b = a + h;
    const seg: Seg = [[a, f(a)], [a + h / 3, f(a) + (df(a) * h) / 3], [b - h / 3, f(b) - (df(b) * h) / 3], [b, f(b)]];
    d += ` C${seg.slice(1).map((p) => p.map(r).join(",")).join(" ")}`;
    let len = 0;
    let prev = seg[0];
    for (let s = 1; s <= 16; s++) {
      const p = bez(seg, s / 16);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    lens.push(len);
  }
  const before = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const total = before[n - 1] + lens[n - 1];
  return {
    d,
    at: (x: number): Pt => [x, f(x)],
    frac: (x: number) => {
      const u = Math.min(n, Math.max(0, (x - x0) / h));
      const k = Math.min(n - 1, Math.floor(u));
      return (before[k] + lens[k] * (u - k)) / total;
    },
  };
}
