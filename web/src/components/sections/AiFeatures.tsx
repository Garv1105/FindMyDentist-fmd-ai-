"use client";

import { motion } from "motion/react";
import { ArrowRight, BookOpenText, Compass, FileSearch, Route, Sparkles, Stethoscope, UserRound } from "lucide-react";
import Image from "next/image";
import { openAssistant } from "../hero/Assistant";
import { Container, Reveal } from "../ui";

// Wording mirrors what the assistant actually does: it explains and navigates, it never diagnoses or books.
const FEATURES = [
  { icon: BookOpenText, title: "Accurate information", body: "Plain-language explanations, with uncertainty stated honestly." },
  { icon: UserRound, title: "Personalised guidance", body: "Shaped by what you describe, in your language." },
  { icon: FileSearch, title: "Symptom insights", body: "Helps you describe what you feel. Never a diagnosis." },
  { icon: Stethoscope, title: "Treatment education", body: "What happens, how long it takes and what to ask." },
  { icon: Compass, title: "Care recommendations", body: "The kind of dentist to see. Matching is informational." },
  { icon: Route, title: "Next steps & referrals", body: "Points you to verified dentists. Nothing is booked without you." },
];

// node angles on the orbit (degrees, 0 = top, clockwise): two columns of three, clear of the mascot
const ANGLES = [-60, -90, -120, 60, 90, 120];

/** Section 03: FMD AI's capabilities as a restrained orbit around the mascot guide. */
export default function AiFeatures() {
  return (
    <section id="assistant" className="scroll-mt-24 pt-28 sm:pt-36">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">FMD AI</p>
          <h2 className="type-h2-lg text-ink">
            An assistant that guides.
            <br />
            <span className="bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-transparent">You make the decisions.</span>
          </h2>
          <p className="type-lede mx-auto mt-5">
            FMD AI explains dental concepts, helps you understand options and points you to the right kind of care. Clinical
            decisions always stay with a registered dentist.
          </p>
        </Reveal>

        {/* desktop: orbit. Nodes are real HTML positioned on a circle; the ring is decoration only */}
        <div className="relative mx-auto mt-14 hidden aspect-[2.1/1] max-w-[1080px] lg:block">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--fmd-border)]" />
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--bg-glow-focus),transparent_75%)]" />
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[46%] aspect-square -translate-x-1/2 -translate-y-1/2">
            <Image src="/img/hero/mascot-512.webp" alt="" fill sizes="260px" className="object-contain" />
          </div>
          <ul>
            {FEATURES.map((f, i) => {
              const a = (ANGLES[i] * Math.PI) / 180;
              // anchors sit just outside the ring (ring radius ≈ 19% of the box width); labels grow outward from there
              const left = 50 + Math.sin(a) * 22;
              const top = 50 - Math.cos(a) * 52;
              const right = ANGLES[i] > 0;
              return (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, scale: 0.92 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute flex w-[260px] -translate-y-1/2 items-start gap-3 ${right ? "" : "-translate-x-full flex-row-reverse text-right"}`}
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <span className="icon-tile size-11 shrink-0">
                    <f.icon className="size-[18px]" strokeWidth={1.3} />
                  </span>
                  <div>
                    <h3 className="text-[15.5px] font-medium tracking-[-0.005em] text-ink">{f.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{f.body}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* mobile / tablet: mascot, then the same features as a list */}
        <div className="mt-10 lg:hidden">
          <div aria-hidden className="relative mx-auto size-40">
            <div className="absolute inset-[-25%] rounded-full bg-[radial-gradient(closest-side,var(--bg-glow-focus),transparent_75%)]" />
            <Image src="/img/hero/mascot-512.webp" alt="" fill sizes="160px" className="object-contain" />
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05} className="flex gap-3">
                <span className="icon-tile size-11 shrink-0">
                  <f.icon className="size-[18px]" strokeWidth={1.3} />
                </span>
                <div>
                  <h3 className="text-[15.5px] font-medium tracking-[-0.005em] text-ink">{f.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={0.2} className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button onClick={() => openAssistant()} className="btn-primary group h-12 px-6 text-[14px]">
            <Sparkles className="size-4" strokeWidth={1.5} /> Explore AI features <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
          </button>
          <p className="text-[12.5px] text-ink-4">English · हिन्दी · ಕನ್ನಡ · తెలుగు · தமிழ்</p>
        </Reveal>
      </Container>
    </section>
  );
}
