"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Container, Reveal, SectionHeader, StatusTag, type Availability } from "../ui";

// Real screenshots of the running product (dev build, fictitious demo data), captured Oct 2026.
// Re-capture when these screens change; never swap in a mock-up without relabelling it as a concept.
const SHOTS: { id: string; product: string; title: string; caption: string; s: Availability; img: string; w: number; h: number; href: string; open: string }[] = [
  {
    id: "clinic-dashboard",
    product: "FMD Clinic OS",
    title: "Clinic dashboard",
    caption: "Today's appointments, confirmations, recalls due, collections and stock alerts at a glance.",
    s: "available",
    img: "/img/showcase/clinic-dashboard.webp",
    w: 1440,
    h: 410,
    href: "/clinic",
    open: "Open Clinic OS",
  },
  {
    id: "clinic-ai",
    product: "FMD Clinic OS",
    title: "AI clinic manager",
    caption: "A recall task, planned step by step. Reading and drafting ran; sending waits for approval.",
    s: "beta",
    img: "/img/showcase/clinic-ai-manager.webp",
    w: 1190,
    h: 780,
    href: "/clinic",
    open: "Open Clinic OS",
  },
  {
    id: "fmd-ai",
    product: "FMD Main",
    title: "FMD AI",
    caption: "Educational guidance in plain language — it never books, messages clinics or pays for you.",
    s: "available",
    img: "/img/showcase/fmd-ai.webp",
    w: 475,
    h: 900,
    href: "/#assistant",
    open: "Try FMD AI",
  },
  {
    id: "dentist-profile",
    product: "FMD Main",
    title: "Dentist profiles",
    caption: "Each profile states exactly what FMD verified, alongside qualifications, hours and services.",
    s: "available",
    img: "/img/showcase/dentist-profile.webp",
    w: 495,
    h: 832,
    href: "/#dentists",
    open: "Find dentists",
  },
  {
    id: "explore",
    product: "FMD Main",
    title: "Learn from dentists",
    caption: "Educational posts reviewed before publishing, with sponsored content labelled.",
    s: "available",
    img: "/img/showcase/explore.webp",
    w: 760,
    h: 790,
    href: "/explore",
    open: "Open Explore",
  },
];

/** Brief §15: the actual interfaces — Clinic OS alongside the patient experience. */
export default function Showcase() {
  const [active, setActive] = useState(0);
  const shot = SHOTS[active];
  return (
    <section id="showcase" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <SectionHeader
          center
          eyebrow="Product showcase"
          title="See what FMD is building."
          description="The interfaces and workflows behind FMD's connected dental ecosystem — real screens, shown with demo data."
        />
        <Reveal className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div
            role="tablist"
            aria-label="Product screens"
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
            onKeyDown={(e) => {
              const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
              if (!k) return;
              e.preventDefault();
              const n = (active + k + SHOTS.length) % SHOTS.length;
              setActive(n);
              document.getElementById(`sc-tab-${n}`)?.focus();
            }}
          >
            {SHOTS.map((s, i) => {
              const on = i === active;
              return (
                <button
                  key={s.id}
                  id={`sc-tab-${i}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls="sc-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`shrink-0 rounded-[20px] border p-4 text-left transition-all duration-300 lg:w-full ${
                    on ? "glass border-transparent" : "border-[var(--fmd-border)] hover:border-[var(--fmd-border-strong)] hover:bg-white/[0.02]"
                  }`}
                >
                  <span className="block text-[11px] uppercase tracking-[0.16em] text-ink-4">{s.product}</span>
                  <span className={`mt-1 block whitespace-nowrap text-[15px] ${on ? "text-ink" : "text-ink-3"}`}>{s.title}</span>
                  <span className="mt-1 hidden text-[12.5px] leading-relaxed text-ink-4 lg:block">{s.caption}</span>
                </button>
              );
            })}
          </div>

          <figure id="sc-panel" role="tabpanel" aria-labelledby={`sc-tab-${active}`} className="glass flex flex-col overflow-hidden rounded-[30px] p-3 sm:p-4">
            <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-[22px] border border-line bg-black/40 p-3 sm:min-h-[460px] sm:p-6">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgb(var(--accent-rgb)/0.16),transparent_70%)]" />
              <Image
                key={shot.id}
                src={shot.img}
                alt={`${shot.product} — ${shot.title} screen, showing demo data`}
                width={shot.w}
                height={shot.h}
                sizes="(min-width: 1024px) 860px, 100vw"
                className="relative max-h-[540px] w-auto max-w-full rounded-[14px] object-contain shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
                style={{ height: "auto" }}
              />
            </div>
            <figcaption className="flex flex-wrap items-center gap-3 px-2 pb-1 pt-4">
              <StatusTag s={shot.s} />
              <span className="text-[12px] text-ink-4">Actual interface · demo data, not real patients or clinics</span>
              <Link href={shot.href} className="group ml-auto inline-flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink">
                {shot.open} <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
              </Link>
            </figcaption>
          </figure>
        </Reveal>
      </Container>
    </section>
  );
}
