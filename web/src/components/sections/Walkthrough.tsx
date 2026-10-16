"use client";

import { ArrowRight, CalendarCheck, Compass, MessageCircleQuestion, Repeat, Search, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { openAssistant } from "../hero/Assistant";
import { Container, SectionHeader } from "../ui";

const TREATMENTS = [
  { title: "Teeth Cleaning", img: "/img/tx-cleaning.png", meta: "30–45 min" },
  { title: "Braces & Aligners", img: "/img/tx-aligners.png", meta: "6–24 months" },
  { title: "Dental Implants", img: "/img/tx-implants.png", meta: "Staged treatment" },
  { title: "Teeth Whitening", img: "/img/tx-whitening.png", meta: "1–2 visits" },
];

type Step = { icon: typeof Search; title: string; line: string; detail: string; action: ReactNode };

const ask = (p?: string) => () => openAssistant(p);
const STEPS: Step[] = [
  {
    icon: MessageCircleQuestion,
    title: "Ask",
    line: "Start with a question",
    detail: "Describe what you feel or what you want to know, in plain words and in your language.",
    action: <ActionButton onClick={ask()}>Ask FMD AI</ActionButton>,
  },
  {
    icon: Sparkles,
    title: "Understand",
    line: "Get clear guidance",
    detail: "FMD AI explains what it could mean and which kind of dentist helps. It never diagnoses.",
    action: <ActionButton onClick={ask("What kind of dentist should I see for tooth sensitivity?")}>Try an example</ActionButton>,
  },
  {
    icon: Compass,
    title: "Explore",
    line: "Compare your options",
    detail: "Popular treatments, explained: what happens, how long it takes and what to ask.",
    action: null, // treatment picker below
  },
  {
    icon: Search,
    title: "Find",
    line: "Choose a dentist",
    detail: "Browse verified dentists and clinics. Sponsored placements are always labelled.",
    action: <ActionLink href="#dentists">Find dentists</ActionLink>,
  },
  {
    icon: CalendarCheck,
    title: "Act",
    line: "Book on your terms",
    detail: "Review the time, clinic and fee before anything is confirmed.",
    action: <ActionLink href="/appointments">My appointments</ActionLink>,
  },
  {
    icon: Repeat,
    title: "Follow up",
    line: "Keep care continuous",
    detail: "Records and next steps stay in one place, so the next visit builds on the last.",
    action: <ActionLink href="/records">Dental records</ActionLink>,
  },
];

/** FMD Main, the patient experience: one interactive path from question to follow-up. */
export default function Walkthrough() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  // the nav's "Treatments" link lands here: open the Explore step
  useEffect(() => {
    const on = () => location.hash === "#treatments" && setActive(2);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return (
    <section id="treatments" className="scroll-mt-24 pt-28 sm:pt-36">
      <Container>
        <SectionHeader
          center
          eyebrow="Dental care, connected"
          title="From a question to the right care"
          description="One place to understand a concern, explore treatment and find a dentist. Pick a step to see how it works."
        />

        {/* the path: a tablist, so arrow keys and screen readers work like any tab set */}
        <div className="relative mx-auto max-w-[1080px]">
          <div aria-hidden className="absolute left-[6%] right-[6%] top-[22px] hidden h-px bg-[var(--fmd-border)] md:block">
            <span className="absolute -top-[3px] h-[7px] w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--horizon-rgb)/0.8),transparent)] [animation:pulse-travel_8s_ease-in-out_infinite]" />
          </div>
          <div
            role="tablist"
            aria-label="How FMD works"
            className="relative grid grid-cols-3 gap-y-6 md:grid-cols-6"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const n = (active + (e.key === "ArrowRight" ? 1 : STEPS.length - 1)) % STEPS.length;
              setActive(n);
              document.getElementById(`wt-tab-${n}`)?.focus();
            }}
          >
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <button
                  key={s.title}
                  id={`wt-tab-${i}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls="wt-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className="group flex flex-col items-center gap-3 rounded-2xl px-1 text-center outline-none focus-visible:ring-1 focus-visible:ring-[var(--fmd-border-strong)]"
                >
                  <span
                    className={`grid size-11 place-items-center rounded-full border transition-all duration-500 ${
                      on
                        ? "border-[rgba(150,185,255,0.45)] bg-[linear-gradient(160deg,rgba(60,100,220,0.45),rgba(10,18,40,0.85))] text-[#cfe0ff] shadow-[0_0_0_6px_var(--fmd-glow),0_0_28px_-6px_rgba(77,141,255,0.7)]"
                        : "border-[var(--fmd-border)] bg-[var(--fmd-midnight)] text-ink-4 group-hover:text-ink-2"
                    }`}
                  >
                    <s.icon className="size-[17px]" strokeWidth={1.3} />
                  </span>
                  <span>
                    <span className="block text-[11.5px] tabular-nums tracking-[0.2em] text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                    <span className={`mt-1 block text-[15px] transition-colors ${on ? "text-ink" : "text-ink-3"}`}>{s.title}</span>
                    <span className="mt-0.5 hidden text-[12px] text-ink-4 sm:block">{s.line}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="wt-panel"
            role="tabpanel"
            aria-labelledby={`wt-tab-${active}`}
            className="glass mt-10 rounded-[28px] p-6 sm:p-8"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="type-label text-ink-4">
                  Step {active + 1} · {step.line}
                </p>
                <p className="mt-3 text-[18px] font-normal leading-snug tracking-[-0.012em] text-ink [text-wrap:pretty] sm:text-[20px]">{step.detail}</p>
              </div>
              {step.action}
            </div>

            {step.title === "Explore" && (
              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {TREATMENTS.map((t) => (
                  <button
                    key={t.title}
                    onClick={() => openAssistant(`Tell me about ${t.title.toLowerCase()}`)}
                    aria-label={`Ask FMD AI about ${t.title}`}
                    className="group flex items-center gap-4 rounded-[20px] border border-[var(--fmd-border)] bg-white/[0.02] p-2.5 pr-4 text-left transition-colors hover:border-[var(--fmd-border-strong)]"
                  >
                    <span className="relative h-[64px] w-[72px] shrink-0 overflow-hidden rounded-[14px]">
                      <Image src={t.img} alt="" fill sizes="72px" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] text-ink">{t.title}</span>
                      <span className="mt-1 block truncate text-[11.5px] uppercase tracking-[0.14em] text-ink-4">{t.meta}</span>
                    </span>
                    <ArrowRight className="arrow-nudge size-4 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="btn-primary group h-11 shrink-0 px-5 text-[13.5px]">
      {children} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
    </button>
  );
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="btn-primary group h-11 shrink-0 px-5 text-[13.5px]">
      {children} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
    </a>
  );
}
