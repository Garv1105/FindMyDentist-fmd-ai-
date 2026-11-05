/**
 * Limb of the Earth in public/img/hero/earth-4320.webp, measured from its pixels (4320×1440 source space (FMD_Earth_Horizon_Original_Composition)):
 * per column, the row of the bright blue rim line, median-filtered and smoothed; the cloud/city-light-covered
 * middle span is fitted with a parabola through the clean left and right limb. [x, y] every ~143px.
 * The hero draws its horizon light in this same coordinate space, so it stays on the planet's edge at any size.
 * Regenerate if the Earth image changes.
 */
export const RIM_W = 4320;
export const RIM_H = 1440;
export const RIM: [number, number][] = [
  [0, 956.5], [143, 911.7], [286, 861.8], [430, 816.3], [573, 775.7], [716, 739.1],
  [859, 705.7], [1002, 677.4], [1146, 650.2], [1289, 628.3], [1432, 610.0], [1575, 595.3],
  [1718, 584.4], [1862, 577.0], [2005, 573.2], [2148, 573.0], [2291, 576.6], [2434, 583.8],
  [2578, 583.8], [2721, 598.5], [2864, 619.8], [3007, 639.4], [3150, 665.9], [3294, 695.7],
  [3437, 728.8], [3580, 766.7], [3723, 805.7], [3867, 849.7], [4010, 898.0], [4153, 950.5],
  [4296, 1002.0], [4320, 1005.8],
];

/** Rim height (source px) at column x, linearly interpolated. */
export function rimYAt(x: number) {
  if (x <= RIM[0][0]) return RIM[0][1];
  for (let i = 1; i < RIM.length; i++) {
    if (x <= RIM[i][0]) {
      const [x0, y0] = RIM[i - 1];
      const [x1, y1] = RIM[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return RIM[RIM.length - 1][1];
}

/** The emergence point: where the rim is highest (centre of the sunrise). */
export const RIM_APEX = RIM.reduce((a, p) => (p[1] < a[1] ? p : a));

/** SVG path along the rim between two columns (either direction). */
export function rimPath(from: number, to: number) {
  const dir = Math.sign(to - from) || 1;
  const mid = RIM.map((p) => p[0])
    .filter((x) => (dir > 0 ? x > from && x < to : x < from && x > to))
    .sort((a, b) => dir * (a - b));
  return [from, ...mid, to].map((x, i) => `${i ? "L" : "M"}${x} ${rimYAt(x).toFixed(1)}`).join(" ");
}
