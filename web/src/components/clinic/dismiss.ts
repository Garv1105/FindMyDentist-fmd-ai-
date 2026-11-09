"use client";

import { useEffect, type RefObject } from "react";

/** Close an open menu, sheet or drawer on Escape or a press outside `ref`; focus goes back to `returnTo`. */
export function useDismiss(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>, returnTo?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const shut = () => {
      close();
      returnTo?.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && shut();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !returnTo?.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close, ref, returnTo]);
}
