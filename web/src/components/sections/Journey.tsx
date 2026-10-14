"use client";

import { motion } from "motion/react";
import { ClipboardList, FileText, HeartPulse, MessagesSquare, Repeat, Search } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Container, SectionHeader } from "../ui";

const STEPS = [
  { icon: Search, title: "Discover", body: "Ask FMD AI, explore content and find the right specialist." },
  { icon: MessagesSquare, title: "Consult", body: "Review profiles, compare and confirm a visit on your terms." },
  { icon: ClipboardList, title: "Plan", body: "Understand your treatment plan, estimates and options." },
  { icon: HeartPulse, title: "Treatment", body: "Reminders, preparation checklists and clear next steps." },
  { icon: FileText, title: "Records", body: "X-rays, reports and prescriptions — kept in your vault." },
  { icon: Repeat, title: "Follow-up", body: "Recalls and check-ins so care continues, not restarts." },
];

export default function Journey() {
  const [active, setActive] = useState(0);
  return (
    <section className="pt-28 sm:pt-40">
      <Container className="relative">
        <div aria-hidden className="pointer-events-none absolute right-6 top-0 hidden h-[120px] w-[112px] lg:right-10 lg:block">
          <div className="absolute inset-[-30%] bg-[radial-gradient(closest-side,rgba(46,108,240,0.22),transparent_72%)]" />
          <Image src="/img/hero/mascot-512.webp" alt="" fill sizes="112px" className="object-contain" />
        </div>
        <SectionHeader
          center
          eyebrow="Continuity of care"
          title="One journey, not six disconnected visits"
          description="FMD keeps context from your first question to your follow-up, so every step builds on the last."
        />

        <div className="relative mt-10 rounded-[32px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(42,100,232,0.06),rgba(42,100,232,0.01))] px-5 pb-8 pt-8 sm:px-8" onMouseLeave={() => setActive(0)}>
          {/* rail */}
          <div aria-hidden className="absolute left-[39px] top-8 h-[calc(100%-4rem)] w-px bg-line md:left-8 md:top-[52px] md:h-px md:w-[calc(100%-4rem)]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgb(var(--accent-rgb)/0.35),transparent)] max-md:bg-[linear-gradient(180deg,transparent,rgb(var(--accent-rgb)/0.35),transparent)]" />
            {/* a slow pulse of light travelling along the rail */}
            <span className="absolute -top-[3px] hidden h-[7px] w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--horizon-rgb)/0.9),transparent)] [animation:pulse-travel_7s_ease-in-out_infinite] md:block" />
            <span className="absolute -left-[3px] h-24 w-[7px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--horizon-rgb)/0.9),transparent)] [animation:pulse-travel-y_7s_ease-in-out_infinite] md:hidden" />
          </div>

          <ol className="relative grid gap-8 md:grid-cols-6 md:gap-4">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <motion.li
                  key={s.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  tabIndex={0}
                  className="flex gap-5 outline-none md:flex-col md:gap-0"
                >
                  <span
                    className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums transition-all duration-500 ${
                      on
                        ? "border-line-strong bg-[var(--surface-elevated)] text-ink shadow-[0_0_0_6px_var(--accent-soft),0_0_30px_-4px_var(--accent-glow)]"
                        : "border-line bg-[var(--background)] text-ink-4"
                    }`}
                  >
                    <s.icon className="size-[17px]" strokeWidth={1.3} />
                  </span>
                  <div className="md:mt-6 md:pr-4">
                    <p className="mb-1 text-[10.5px] tabular-nums tracking-[0.2em] text-ink-4">{String(i + 1).padStart(2, "0")}</p>
                    <h3 className={`text-[17px] font-light tracking-[-0.01em] transition-colors duration-500 ${on ? "text-ink" : "text-ink-2"}`}>{s.title}</h3>
                    <p className={`mt-1.5 text-[13px] leading-relaxed transition-colors duration-500 ${on ? "text-ink-3" : "text-ink-4"}`}>{s.body}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}
