"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { ClipboardList, FileText, HeartPulse, MessagesSquare, Repeat, Search, Stethoscope } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { Container, Reveal } from "../ui";

const STEPS = [
  { icon: Search, title: "Understand a concern", body: "Ask FMD AI, read verified content and learn which kind of dentist helps." },
  { icon: MessagesSquare, title: "Explore care", body: "Compare treatments, timelines and the questions worth asking." },
  { icon: Stethoscope, title: "Consult a dentist", body: "Review profiles and confirm a visit on your terms." },
  { icon: ClipboardList, title: "Plan treatment", body: "Understand your plan, estimates and options before you agree." },
  { icon: HeartPulse, title: "Receive care", body: "Reminders, preparation checklists and clear next steps." },
  { icon: FileText, title: "Manage records", body: "X-rays, reports and prescriptions, kept in your vault." },
  { icon: Repeat, title: "Follow up", body: "Recalls and check-ins so care continues, not restarts." },
];

/**
 * Section 06: the patient's journey over time, as a vertical timeline whose light fills with scroll.
 * Deliberately a different composition from the Walkthrough (a horizontal, interactive path).
 */
export default function Journey() {
  const list = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 75%", "end 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="pt-28 sm:pt-40">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <Reveal>
              <p className="eyebrow mb-3.5">Your dental journey</p>
              <h2 className="type-h2">One journey, not seven disconnected visits</h2>
              <p className="type-lede mt-4 max-w-md">
                FMD keeps context from your first question to your follow-up, so every step builds on the last.
              </p>
            </Reveal>
            <div aria-hidden className="relative mt-10 hidden size-40 lg:block">
              <div className="absolute inset-[-30%] rounded-full bg-[radial-gradient(closest-side,var(--bg-glow-focus),transparent_72%)]" />
              <Image src="/img/hero/mascot-512.webp" alt="" fill sizes="160px" className="object-contain" />
            </div>
          </div>

          <div className="relative">
            {/* rail, and the light that fills it as you read down */}
            <div aria-hidden className="absolute bottom-6 left-[27px] top-6 w-px bg-[var(--fmd-border)]">
              <motion.div style={{ scaleY: fill }} className="absolute inset-0 origin-top bg-[linear-gradient(180deg,rgb(var(--horizon-rgb)/0.7),rgb(var(--horizon-rgb)/0.15))]" />
            </div>
            <ol ref={list} className="relative space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={0.04 * i} className="relative flex gap-5 rounded-[22px] p-3 pr-5 transition-colors hover:bg-white/[0.02]">
                  <span className="relative z-10 grid size-[32px] shrink-0 translate-x-[11px] place-items-center rounded-full border border-[var(--fmd-border-strong)] bg-[var(--fmd-midnight)] text-ink-2">
                    <s.icon className="size-[15px]" strokeWidth={1.4} />
                  </span>
                  <div className="ml-2 pb-1">
                    <p className="text-[11.5px] tabular-nums tracking-[0.2em] text-ink-4">{String(i + 1).padStart(2, "0")}</p>
                    <h3 className="type-h3 mt-1">{s.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{s.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
