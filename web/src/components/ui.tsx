"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, Megaphone } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Homepage motion vocabulary (mirrors --ease-settle / --dur-* in globals.css). Motion explains a change: something
 * arrives (reveal, once), changes place (move) or changes state (quick). Nothing loops unless it carries meaning,
 * and every caller drops movement under reduced motion.
 */
export const MOTION = {
  ease: [0.16, 1, 0.3, 1] as const,
  quick: 0.3,
  move: 0.7,
  reveal: 0.9,
};

/**
 * Staggered fade-up as a section enters the viewport; with reduced motion, content is simply there.
 * Reduced motion is handled in two places on purpose: useReducedMotion() is null during SSR, so the server always
 * renders the hidden `initial` state. The [data-reveal] rule in globals.css overrides that from first paint (before
 * hydration or any viewport trigger), and here the in-view transition becomes instant. `initial` itself never varies,
 * so server and client markup match.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 18,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={reduced ? { duration: 0 } : { duration: MOTION.reveal, delay, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; href: string };
  center?: boolean;
}) {
  return (
    <Reveal
      className={`mb-8 flex flex-col gap-3 sm:mb-10 ${center ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between"}`}
    >
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3.5">{eyebrow}</p>}
        <h2 className="type-h2">{title}</h2>
        {description && <p className={`type-lede mt-4 ${center ? "mx-auto" : ""}`}>{description}</p>}
      </div>
      {action && (
        <a href={action.href} className="group inline-flex shrink-0 items-center gap-2 text-sm text-ink-2 transition-colors hover:text-ink">
          {action.label}
          <ArrowRight className="arrow-nudge size-4" strokeWidth={1.5} />
        </a>
      )}
    </Reveal>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[var(--container-max)] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

/** Verification and paid promotion are deliberately different visual languages. */
export function VerifiedBadge() {
  return (
    <span
      title="Credentials checked by FMD"
      className="inline-flex w-fit items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-2"
    >
      <BadgeCheck className="size-3" strokeWidth={1.75} />
      Verified
    </span>
  );
}

export function SponsoredBadge() {
  return (
    <span
      title="Paid placement - not a clinical endorsement"
      className="inline-flex w-fit items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em] text-ink-3"
    >
      <Megaphone className="size-3" strokeWidth={1.5} />
      Sponsored
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] text-ink-2">{children}</span>
  );
}

/**
 * Endless loops run only near the screen. `on` is false while the element is off screen or under reduced motion; then
 * give `animate` the loop's resting values through rest(), whose instant transition ends the loop.
 */
export function useLoop<T extends Element = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const near = useInView(ref, { margin: "200px 0px" });
  const reduced = useReducedMotion();
  return { ref, on: near && !reduced };
}
export const rest = <V extends object>(v: V) => ({ ...v, transition: { duration: 0 } });

/** Pauses every CSS animation inside a section or footer that is off screen (see [data-offscreen] in globals.css). */
export function PauseOffscreen() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.target.toggleAttribute("data-offscreen", !e.isIntersecting)),
      { rootMargin: "200px 0px" },
    );
    document.querySelectorAll("main section, footer").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
