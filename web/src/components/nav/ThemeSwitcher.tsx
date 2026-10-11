"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, MonitorSmartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_THEME, STORAGE_KEY, SYSTEM, THEMES, resolveTheme, type Theme, type ThemeId } from "@/lib/themes";

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (root.dataset.theme === id) return;
  const swap = () => {
    root.dataset.theme = id;
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A whole-page crossfade reads as the lighting changing, not colours snapping.
  if (!reduced && "startViewTransition" in document) {
    document.startViewTransition(swap);
  } else {
    root.classList.add("theme-anim");
    swap();
    window.setTimeout(() => root.classList.remove("theme-anim"), 700);
  }
}

function Swatch({ theme, size = 34 }: { theme: Theme; size?: number }) {
  const [bg, glow] = theme.swatch;
  return (
    <span
      aria-hidden
      className="relative block shrink-0 overflow-hidden rounded-[9px] border border-line"
      style={{ width: size, height: size * 0.72, background: bg }}
    >
      {/* a miniature horizon */}
      <span
        className="absolute left-1/2 top-[58%] block aspect-square w-[260%] -translate-x-1/2 rounded-full"
        style={{
          background: theme.dark ? "#0b0c0e" : "rgba(0,0,0,0.06)",
          boxShadow: `0 -1px 0 ${glow}, 0 -4px 10px ${glow}${theme.dark ? "88" : "44"}`,
        }}
      />
    </span>
  );
}

// The DOM attribute and localStorage are the source of truth; React just subscribes.
const CHANGE = "fmd-theme-change";
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    mo.disconnect();
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}
const readActive = () => resolveTheme(document.documentElement.dataset.theme ?? null);
const readChoice = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};
const serverDefault = () => DEFAULT_THEME;

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const active = useSyncExternalStore(subscribe, readActive, serverDefault);
  const choice = useSyncExternalStore(subscribe, readChoice, serverDefault);
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  // follow OS changes while "Match system" is on
  useEffect(() => {
    if (choice !== SYSTEM) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => applyTheme(resolveTheme(SYSTEM));
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);

  const select = useCallback((next: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(CHANGE));
    applyTheme(resolveTheme(next));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items.current.filter(Boolean) as HTMLButtonElement[];
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        const n = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[n]?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => items.current[THEMES.findIndex((t) => t.id === active)]?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, active]);

  const current = THEMES.find((t) => t.id === active)!;
  const groups = [
    { label: "Dark", themes: THEMES.filter((t) => t.dark) },
    { label: "Light", themes: THEMES.filter((t) => !t.dark) },
  ];

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full border border-transparent text-ink-2 transition-colors hover:border-line hover:text-ink"
      >
        {/* ◐ — half lit, half shadow, tinted with the active glow */}
        <span
          className="block size-[17px] rounded-full border border-current"
          style={{ background: `linear-gradient(90deg, transparent 50%, currentColor 50%)` }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Theme"
            initial={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, scale: 0.98, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="glass absolute right-0 top-12 z-50 w-[288px] origin-top-right rounded-[22px] p-2"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
              <p className="text-[13px] font-medium text-ink">Appearance</p>
              <p className="text-[11px] text-ink-4">Prototype themes</p>
            </div>
            {groups.map((g) => (
              <div key={g.label} className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.24em] text-ink-4">{g.label}</p>
                {g.themes.map((t) => {
                  const i = THEMES.indexOf(t);
                  const selected = choice !== SYSTEM && active === t.id;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        items.current[i] = el;
                      }}
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => select(t.id)}
                      className={`group flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left outline-none transition-colors hover:bg-[var(--accent-soft)] focus-visible:bg-[var(--accent-soft)] ${selected ? "bg-[var(--accent-soft)]" : ""}`}
                    >
                      <Swatch theme={t} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-tight text-ink">{t.name}</span>
                        <span className="block text-[11px] leading-tight text-ink-4">{t.mood}</span>
                      </span>
                      <span
                        className={`grid size-5 place-items-center rounded-full transition-all duration-300 ${selected ? "scale-100 bg-cta text-cta-fg opacity-100" : "scale-75 opacity-0"}`}
                      >
                        <Check className="size-3" strokeWidth={2.5} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="mx-2 mt-1 border-t border-line pt-1">
              <button
                role="menuitemradio"
                aria-checked={choice === SYSTEM}
                onClick={() => select(SYSTEM)}
                className="flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left text-[12.5px] text-ink-3 transition-colors hover:bg-[var(--accent-soft)] hover:text-ink"
              >
                <MonitorSmartphone className="size-4" strokeWidth={1.5} />
                <span className="flex-1">Match system</span>
                {choice === SYSTEM && <Check className="size-3.5 text-ink" strokeWidth={2} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
