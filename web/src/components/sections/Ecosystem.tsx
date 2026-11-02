"use client";

import { ArrowRight, ConciergeBell, GraduationCap, HeartPulse, Lightbulb, Stethoscope, Wallet, Workflow } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Container, MOTION, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

// Three apps and the modules that live inside each. Only Edge has a homepage target.
const APPS = [
  {
    icon: HeartPulse,
    tag: "For patients",
    name: "FMD ONE",
    body: "The main platform: one community for every dental need.",
    modules: [
      { icon: ConciergeBell, name: "FMD Edge", body: "A private concierge for your dental care.", href: "/#concierge" },
      { icon: Wallet, name: "SaveIN", body: "Pay treatment bills in easy EMIs.", isNew: true },
    ],
  },
  {
    icon: GraduationCap,
    tag: "For students & researchers",
    name: "FMD Scholar",
    body: "Doubts, seminar and viva prep, MCQs and research help.",
    modules: [{ icon: Lightbulb, name: "Innovation Hub", body: "Pitch your idea. Three are backed by FMD each year." }],
  },
  {
    icon: Stethoscope,
    tag: "For clinics",
    name: "FMD Clinic OS",
    body: "Clinic management software, end to end.",
    modules: [{ icon: Workflow, name: "FMD Flow", body: "Automated patient and clinic workflows, with voice notes." }],
  },
];

// one trail leaves the ONE ECOSYSTEM stage at the centre and branches into the three columns (1/6, 1/2, 5/6 of the width)
const LINES = ["M 150 0 C 150 70, 50 50, 50 120", "M 150 0 L 150 120", "M 150 0 C 150 70, 250 50, 250 120"];

/** Section 11b: the ONE ECOSYSTEM stage above, unfolded into each app. */
export default function Ecosystem() {
  const reduced = useReducedMotion();
  return (
    <section id="ecosystem" className="relative isolate scroll-mt-24 pt-6">
      <Atmosphere scene="os" />
      <Container>
        <h2 className="sr-only">The FMD ecosystem</h2>

        {/* light trails from the stage above into each app (md+; phones get one straight trail into the stack) */}
        <svg aria-hidden className="hidden h-32 w-full md:block lg:h-40" viewBox="0 0 300 120" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="eco-line" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#527FB6" stopOpacity="0" />
              <stop offset="1" stopColor="#b9ccf5" stopOpacity="0.75" />
            </linearGradient>
          </defs>
          {LINES.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              data-draw=""
              stroke="url(#eco-line)"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={reduced ? { duration: 0 } : { duration: 1.4, delay: i === 1 ? 0 : 0.15, ease: MOTION.ease }}
            />
          ))}
        </svg>
        <div aria-hidden className="mx-auto h-16 w-px bg-gradient-to-b from-transparent to-[#b9ccf5]/70 md:hidden" />

        <div className="grid gap-4 md:grid-cols-3">
          {APPS.map(({ icon: Icon, tag, name, body, modules }, i) => (
            <Reveal key={name} delay={0.3 + i * 0.06} className="h-full">
              <article className="relative flex h-full flex-col overflow-hidden rounded-[var(--sf-r-lg)] p-7 fmd-surface">
                {/* where the trail lands */}
                <span aria-hidden className="pointer-events-none absolute inset-x-[20%] -top-12 hidden h-24 rounded-full bg-[radial-gradient(closest-side,var(--fmd-glow-strong),transparent)] md:block" />
                <span className="icon-tile relative size-11">
                  <Icon className="size-[18px]" strokeWidth={1.3} />
                </span>
                <p className="mt-6 type-label text-ink-4">{tag}</p>
                <h3 className="mt-2 text-[22px] font-normal tracking-[-0.02em] text-ink">{name}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{body}</p>
                <ul className="mt-6 space-y-2.5 border-t border-[var(--fmd-border)] pt-5">
                  {modules.map((m) => {
                    const inner = (
                      <>
                        <m.icon className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
                        <span className="flex-1">
                          <span className="flex items-center gap-2 text-[13.5px] text-ink-2">
                            {m.name}
                            {"isNew" in m && m.isNew && <span className="rounded-full border border-[rgb(var(--horizon-rgb)/0.5)] px-1.5 py-px text-[9.5px] uppercase tracking-[0.12em] text-ink-3">New</span>}
                            {"href" in m && <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.5} />}
                          </span>
                          <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-4">{m.body}</span>
                        </span>
                      </>
                    );
                    const cls = "flex items-start gap-3 rounded-[12px] border border-[var(--fmd-border)] bg-white/[0.02] p-3";
                    return (
                      <li key={m.name}>
                        {"href" in m ? (
                          <a href={m.href} className={`group ${cls} transition-colors hover:bg-white/[0.04]`}>
                            {inner}
                          </a>
                        ) : (
                          <div className={cls}>{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
