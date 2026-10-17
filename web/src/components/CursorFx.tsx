"use client";

import { useEffect, useRef, useState } from "react";

// what tilts toward the cursor: the mascots (their art sits in a box; the box tilts, so stacked crossfading poses move
// as one), the raised surfaces and anything marked data-tilt. Not frosted glass: rotating an element with a backdrop
// blur makes the browser re-blur what's behind it every frame, which is where the lag came from
const TILT = '.fmd-surface-raised, .fmd-surface, .edge-panel, [data-tilt], img[src*="mascots"]';
// never the approved Hero, the nav or dialogs, nor anything opted out; frosted elements themselves are skipped in targetFor
const SKIP = "#top, header, nav, [role='dialog'], [data-no-tilt]";
// share of the remaining distance covered per 60th of a second (scaled to the real frame time, so the feel is the same
// at 60Hz, 120Hz or after a dropped frame): close enough to track precisely, still a touch of weighted lag
const LERP_ORB = 0.2;
const LERP_TILT = 0.12;
// where the light centres, relative to the pointer's hotspot. The hotspot is the arrow's tip, with the arrow's body
// down and to the right of it, so a light centred on the tip itself reads as running ahead of the cursor; centred on the
// body it sits behind the cursor. (The light centres itself with translate(-50%, -50%), whatever its size.)
const BEHIND = { x: 8, y: 11 };

type Tilt = { el: HTMLElement; rect: DOMRect; rx: number; ry: number; tx: number; ty: number };

/**
 * Site-wide cursor light and tilt, mouse only. No React state is touched while the mouse moves: pointermove only
 * records the target, and one requestAnimationFrame loop eases the light (translate3d on a fixed element) and any
 * tilted element toward it, then stops itself once everything has settled. The hovered element's box is measured
 * once when the pointer arrives on it (and again after scrolling), not on every move. Renders nothing at all for
 * touch screens or under reduced motion.
 */
export default function CursorFx() {
  const [enabled, setEnabled] = useState(false);
  const orbRef = useRef<HTMLDivElement>(null);

  // on only for a fine pointer without reduced motion; follows either preference if it changes
  useEffect(() => {
    const fine = matchMedia("(pointer: fine)");
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setEnabled(fine.matches && !still.matches);
    sync();
    fine.addEventListener("change", sync);
    still.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      still.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const orb = orbRef.current;
    if (!enabled || !orb) return;
    const tilts = new Map<HTMLElement, Tilt>();
    const pos = { x: 0, y: 0 };
    const to = { x: 0, y: 0 };
    let hot: Tilt | null = null;
    let seen = false;
    let raf = 0;
    let last = 0;
    const ease = (k: number, dt: number) => 1 - Math.pow(1 - k, dt / 16.667);

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(now - last, 64) : 16.667;
      last = now;
      const ko = ease(LERP_ORB, dt);
      const kt = ease(LERP_TILT, dt);
      pos.x += (to.x - pos.x) * ko;
      pos.y += (to.y - pos.y) * ko;
      orb.style.transform = `translate3d(${pos.x + BEHIND.x}px, ${pos.y + BEHIND.y}px, 0) translate(-50%, -50%)`;
      let moving = Math.abs(to.x - pos.x) > 0.05 || Math.abs(to.y - pos.y) > 0.05;
      for (const t of tilts.values()) {
        t.rx += (t.tx - t.rx) * kt;
        t.ry += (t.ty - t.ry) * kt;
        if (t !== hot && Math.abs(t.rx) < 0.02 && Math.abs(t.ry) < 0.02) {
          t.el.style.transform = "";
          tilts.delete(t.el);
          continue;
        }
        t.el.style.transform = `perspective(1000px) rotateX(${t.rx.toFixed(3)}deg) rotateY(${t.ry.toFixed(3)}deg)`;
        if (Math.abs(t.tx - t.rx) > 0.01 || Math.abs(t.ty - t.ry) > 0.01) moving = true;
      }
      if (moving) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const targetFor = (node: EventTarget | null) => {
      let el = node instanceof Element ? (node.closest(TILT) as HTMLElement | null) : null;
      if (el?.tagName === "IMG") el = el.parentElement;
      if (!el || el.closest(SKIP) || el.matches('[class*="backdrop-blur"]')) return null;
      // someone else owns this element's transform: leave it be
      if (!tilts.has(el) && el.style.transform) return null;
      return el;
    };

    const aim = (t: Tilt) => {
      const { left, top, width, height } = t.rect;
      // wide panels lean less than small cards: about ±1.5° across a full-width panel, at most ±5°
      const max = Math.min(5, 2000 / Math.max(width, 1));
      t.ty = ((to.x - left) / width - 0.5) * 2 * max;
      t.tx = -((to.y - top) / height - 0.5) * 2 * max;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      to.x = e.clientX;
      to.y = e.clientY;
      if (!seen) {
        pos.x = to.x;
        pos.y = to.y;
        seen = true;
        orb.style.opacity = "1";
      }
      hover(targetFor(e.target));
      kick();
    };
    const hover = (el: HTMLElement | null) => {
      if (el !== hot?.el) {
        if (hot) hot.tx = hot.ty = 0;
        hot = null;
        if (el) {
          hot = tilts.get(el) ?? { el, rect: el.getBoundingClientRect(), rx: 0, ry: 0, tx: 0, ty: 0 };
          tilts.set(el, hot);
        }
      }
      if (hot) aim(hot);
    };
    // the page moved under a still pointer: once a frame at most, see what is under it now and re-measure that
    let scrollQueued = false;
    let alive = true;
    const onScroll = () => {
      if (!seen || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        if (!alive) return;
        const el = targetFor(document.elementFromPoint(to.x, to.y));
        if (el && el === hot?.el) hot.rect = el.getBoundingClientRect();
        hover(el);
        kick();
      });
    };
    const leave = () => {
      orb.style.opacity = "0";
      seen = false;
      if (hot) hot.tx = hot.ty = 0;
      hot = null;
      kick();
    };

    addEventListener("pointermove", move, { passive: true });
    addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      alive = false;
      removeEventListener("pointermove", move);
      removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
      for (const t of tilts.values()) t.el.style.transform = "";
    };
  }, [enabled]);

  return enabled ? <div ref={orbRef} aria-hidden className="fmd-cursor-orb" /> : null;
}
