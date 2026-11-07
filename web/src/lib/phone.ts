import { useSyncExternalStore } from "react";

/**
 * Phones and tablets (touch, no hover) get the light mascots: MascotArt plays pre-rendered loops instead of live
 * canvases, the hero runs its phone model, and there is no loading screen (hidden by the same query in globals.css).
 */
export const PHONE_QUERY = "(hover: none) and (pointer: coarse)";
export const isPhone = () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;

const noSubscribe = () => () => {};
/** isPhone for rendering: false on the server and while hydrating (so the markup matches), the real answer after */
export const usePhone = () => useSyncExternalStore(noSubscribe, isPhone, () => false);

// phones: woken by the visitor's first scroll, touch or key
let awake = false;
const sleepers = new Set<() => void>();
if (typeof window !== "undefined") {
  const wake = () => {
    if (awake) return;
    awake = true;
    sleepers.forEach((f) => f());
  };
  for (const e of ["scroll", "touchstart", "pointerdown", "keydown"]) addEventListener(e, wake, { passive: true, once: true });
}
const subscribeWake = (f: () => void) => {
  sleepers.add(f);
  return () => {
    sleepers.delete(f);
  };
};
/**
 * Phones: false until the visitor first scrolls or touches the page, so the hero's 3D (three.js and its models) never
 * competes with the first paint; its stills stand in until then. Everywhere else: true once hydrated.
 */
export const useAwake = () => useSyncExternalStore(subscribeWake, () => awake || !isPhone(), () => false);
