"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "@/components/clinic/dismiss";
import { IconButton } from "./kit";

/**
 * A dialog drawn on <body> (so no blurred panel can trap it): centred on laptops, a sheet from the bottom on phones.
 * Escape or a press outside closes it; Tab stays inside; focus returns to whatever was focused before it opened.
 */
export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDismiss(true, onClose, box);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (before?.isConnected) requestAnimationFrame(() => before.focus());
    };
  }, []);

  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const f = [...box.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input, select, textarea")];
    const [first, last] = [f[0], f.at(-1)];
    const to = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null;
    if (!to) return;
    e.preventDefault();
    to.focus();
  };

  return createPortal(
    <div data-overlay className="fixed inset-0 z-50 grid place-items-end bg-black/70 sm:place-items-center sm:p-4">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trap}
        className={`app-panel app-solid max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-b-[22px] sm:p-6 ${wide ? "max-w-[620px]" : "max-w-[520px]"}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-[19px] font-medium text-ink">
            {title}
          </h2>
          <IconButton label="Close" data-close className="size-9" onClick={onClose}>
            <X className="size-4" strokeWidth={1.5} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Labelled form field in the app style. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] text-ink-3">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  );
}

export const fieldCls =
  "h-11 w-full rounded-2xl border border-line-strong bg-[var(--surface-glass)] px-3.5 text-[15px] text-ink transition-colors placeholder:text-ink-3 focus:border-[var(--accent)] [color-scheme:dark]";
