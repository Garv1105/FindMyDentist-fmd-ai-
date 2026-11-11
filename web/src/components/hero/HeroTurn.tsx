"use client";

import { useEffect, useRef } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";

/**
 * Phones: the hero's rising mascot as one full turn of pre-rendered frames, drawn into a plain 2D canvas and picked by
 * the same scroll-driven angle that turns the live model on desktop (Mascot3D's rotY). No WebGL and no three.js, so the
 * first scroll doesn't stall while a 3D engine boots. fmd-website's full turn: 120 frames, one every 3°, rendered from
 * the full model in Mascot3D's own framing (its render_hero_turn.cjs), resized from 1021px to 640px (the mascot's size
 * on a 3x phone screen), ~17 KB each: about 2 MB in all. They load in the background after the page has painted, coarse
 * angles first, so the turn works almost at once and gets finer as the rest arrive. Bump V when the frames change.
 */
const STEPS = 120;
const V = 2;
// where the cropped frames sit in the 1.7 : 1 canvas, and the canvas width that draws them 1:1 (640 / crop width)
const CROP = { l: 408 / 1836, t: 26 / 1080, w: 1021 / 1836, h: 1054 / 1080 };
const MAX_W = Math.round(640 / CROP.w);
const url = (i: number) => `/models/hero-turn/${String(i).padStart(3, "0")}.webp?v=${V}`;
const frameOf = (deg: number) => Math.round((((deg % 360) + 360) % 360) / (360 / STEPS)) % STEPS;
const gap = (a: number, b: number) => Math.min(Math.abs(a - b), STEPS - Math.abs(a - b));

// Frame 0 first (the pose it starts and ends in), then coarse to fine, so any angle soon has one near it
const ORDER = [...new Set([24, 12, 6, 3, 1].flatMap((step) => Array.from({ length: STEPS / step }, (_, k) => k * step)))];
// Two stages: the first 20 (every 18°, ~0.35 MB) once the page is idle, the rest only once the visitor starts scrolling
// the hero, so a visit that never scrolls pays almost nothing. Low fetch priority: never ahead of what the page needs.
export const COARSE = 20;
const blobs: (Blob | undefined)[] = [];
const arrived = new Set<() => void>();
const queue = [...ORDER];
let wanted = 0; // how many frames to have fetched
let running = 0;
let fetched = 0;
let notifying = false;
// arrivals are told at most once per frame, however many frames landed in it
const announce = () => {
  if (notifying) return;
  notifying = true;
  requestAnimationFrame(() => {
    notifying = false;
    arrived.forEach((f) => f());
  });
};
export function loadFrames(count: number) {
  wanted = Math.max(wanted, count);
  while (running < 4 && queue.length && fetched + running < wanted) {
    const i = queue.shift()!;
    running++;
    void fetch(url(i), { priority: "low" } as RequestInit)
      .then((r) => (r.ok ? r.blob() : undefined))
      .then(
        (b) => void (blobs[i] = b),
        () => {}, // a missing frame: its neighbours stand in
      )
      .finally(() => {
        running--;
        fetched++;
        announce();
        loadFrames(wanted);
      });
  }
}

// Decoded frames (~1.7 MB each in memory): only the most recent few, so low-memory phones stay comfortable
const KEEP = 12;
const decoded = new Map<number, ImageBitmap>();
const decoding = new Map<number, Promise<ImageBitmap | null>>();
function decode(i: number): Promise<ImageBitmap | null> {
  const hit = decoded.get(i);
  if (hit) {
    decoded.delete(i);
    decoded.set(i, hit); // most recently used last
    return Promise.resolve(hit);
  }
  let p = decoding.get(i);
  if (!p) {
    // createImageBitmap decodes off the main thread: scrolling never waits on it
    p = createImageBitmap(blobs[i]!).then(
      (b) => {
        decoding.delete(i);
        decoded.set(i, b);
        for (const [k, old] of decoded) {
          if (decoded.size <= KEEP) break;
          decoded.delete(k);
          old.close();
        }
        return b;
      },
      () => (decoding.delete(i), null),
    );
    decoding.set(i, p);
  }
  return p;
}

export default function HeroTurn({ rotY, onReady }: { rotY: MotionValue<number>; onReady: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const want = useRef(-1); // the frame being decoded for the current angle
  const shown = useRef(-1); // the frame on the canvas
  const last = useRef(0); // the previous angle: which way it is turning

  const paint = (i: number, b: ImageBitmap) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(b, CROP.l * c.width, CROP.t * c.height, CROP.w * c.width, CROP.h * c.height);
    if (shown.current < 0) onReady();
    shown.current = i;
  };

  // the frame for this angle, or the nearest one loaded; while it decodes, the nearest decoded one stays up
  const show = (deg: number) => {
    const dir = deg >= last.current ? 1 : -1;
    last.current = deg;
    const at = frameOf(deg);
    let j = -1;
    for (let d = 0; d <= STEPS / 2 && j < 0; d++) {
      j = blobs[(at + d) % STEPS] ? (at + d) % STEPS : blobs[(at - d + STEPS) % STEPS] ? (at - d + STEPS) % STEPS : -1;
    }
    if (j < 0 || j === shown.current) return;
    want.current = j;
    const hit = decoded.get(j);
    if (hit) paint(j, hit);
    else {
      let near: number | null = null;
      for (const k of decoded.keys()) if (near === null || gap(k, j) < gap(near, j)) near = k;
      if (near !== null && near !== shown.current && (shown.current < 0 || gap(near, j) < gap(shown.current, j))) {
        paint(near, decoded.get(near)!);
      }
      void decode(j).then((b) => b && want.current === j && paint(j, b));
    }
    // the next few frames in the direction it is turning, decoded ahead so the spin never waits on one
    for (let k = 1; k <= 3; k++) {
      const n = (j + dir * k + STEPS) % STEPS;
      if (blobs[n] && !decoded.has(n)) void decode(n);
    }
  };

  useMotionValueEvent(rotY, "change", (deg) => {
    loadFrames(STEPS); // the visitor is scrolling the hero: fetch the rest of the turn (a no-op once under way)
    show(deg);
  });

  useEffect(() => {
    const c = canvas.current!;
    // drawn at the screen's resolution (capped at the frames' own)
    const ro = new ResizeObserver(() => {
      const w = Math.min(Math.round(c.offsetWidth * devicePixelRatio), MAX_W);
      const h = Math.round((w * c.offsetHeight) / Math.max(c.offsetWidth, 1));
      if (w === c.width && h === c.height) return;
      c.width = w;
      c.height = h; // resizing clears it: repaint
      const i = shown.current;
      if (i >= 0) void decode(i).then((b) => b && shown.current === i && paint(i, b));
    });
    ro.observe(c);
    const onArrive = () => show(rotY.get());
    arrived.add(onArrive);
    // after the page has painted and settled: the still stands in until then
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => loadFrames(COARSE), { timeout: 2000 });
    onArrive(); // frames already fetched on an earlier mount
    return () => {
      ro.disconnect();
      arrived.delete(onArrive);
      cancel(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint/show only read refs and module state
  }, [rotY]);

  return <canvas ref={canvas} aria-hidden className="hero-turn-float absolute inset-0 size-full" />;
}
