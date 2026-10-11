"use client";

import { motion } from "motion/react";
import { ArrowRight, BadgeCheck, Megaphone } from "lucide-react";
import type { ReactNode } from "react";

/** Staggered fade-up as a section enters the viewport. */
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
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
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
      <div className={center ? "max-w-2xl" : "max-w-2xl"}>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 className="text-[28px] font-light leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">{title}</h2>
        {description && <p className="mt-4 text-[15px] leading-relaxed text-ink-3 sm:text-base">{description}</p>}
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
  return <div className={`mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
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
      title="Paid placement — not a clinical endorsement"
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
