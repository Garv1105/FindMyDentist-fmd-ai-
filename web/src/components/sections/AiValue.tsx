"use client";

import { ArrowRight, BookOpenText, Hand, Route, ShieldCheck, Sparkles } from "lucide-react";
import { openAssistant } from "../hero/Assistant";
import { Container, Reveal } from "../ui";

const PRINCIPLES = [
  { icon: BookOpenText, title: "Explains, in plain language", body: "Dental concepts and next steps, with uncertainty stated honestly." },
  { icon: Route, title: "Navigates, never diagnoses", body: "Suggests the right kind of dentist — matching is informational." },
  { icon: Hand, title: "You stay in control", body: "No booking, message or payment happens without your confirmation." },
];

export default function AiValue() {
  return (
    <section id="assistant" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          <div>
            <Reveal>
              <p className="eyebrow mb-5">FMD AI</p>
              <h2 className="text-[32px] font-extralight leading-[1.05] tracking-[-0.035em] text-ink sm:text-[52px]">
                An assistant that guides.
                <br />
                <span className="text-ink-3">You make the decisions.</span>
              </h2>
            </Reveal>
            <div className="mt-10 space-y-6">
              {PRINCIPLES.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={0.08 * i} className="flex gap-4">
                  <span className="icon-tile size-11 shrink-0">
                    <Icon className="size-[18px]" strokeWidth={1.3} />
                  </span>
                  <div>
                    <h3 className="text-[15.5px] text-ink">{title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3} className="mt-10 flex flex-wrap items-center gap-4">
              <button onClick={() => openAssistant()} className="btn-primary group h-12 px-6 text-[14px]">
                Talk to FMD AI <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
              </button>
              <p className="text-[12.5px] text-ink-4">English · हिन्दी · ಕನ್ನಡ · తెలుగు · தமிழ்</p>
            </Reveal>
          </div>

          {/* a still from a conversation */}
          <Reveal delay={0.1} y={30}>
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-y-10 -inset-x-4 -z-10 opacity-70 blur-3xl sm:-inset-x-6 lg:-inset-x-10"
                style={{ background: "radial-gradient(50% 50% at 60% 40%, rgb(var(--accent-rgb) / 0.12), transparent 70%)" }}
              />
              <div className="glass rounded-[30px] p-5 sm:p-7">
                <div className="flex items-center gap-3 border-b border-line pb-4">
                  <span className="icon-tile size-9">
                    <Sparkles className="size-4" strokeWidth={1.4} />
                  </span>
                  <p className="text-[13.5px] text-ink">FMD AI</p>
                  <span className="ml-auto text-[11px] text-ink-4">Example conversation</span>
                </div>
                <div className="space-y-4 pt-5">
                  <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent-soft)] px-4 py-3 text-[13.5px] text-ink">
                    My lower back tooth hurts when I drink something cold.
                  </p>
                  <div className="max-w-[92%] text-[13.5px] leading-relaxed text-ink-2">
                    Short, sharp sensitivity to cold is often linked to exposed dentine or an early cavity. It can&apos;t be confirmed without an examination.
                    <span className="mt-2 block text-ink-3">If it lingers, wakes you at night or there&apos;s swelling, see a dentist promptly.</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-line px-3.5 py-2 text-[12.5px] text-ink-2">Show endodontists near me</span>
                    <span className="rounded-full border border-line px-3.5 py-2 text-[12.5px] text-ink-2">What causes sensitivity?</span>
                  </div>
                  <div className="flex items-start gap-3 rounded-[18px] border border-dashed border-line-strong p-4">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-2" strokeWidth={1.5} />
                    <p className="text-[12.5px] leading-relaxed text-ink-3">
                      <span className="text-ink-2">Confirmation required.</span> If you choose a dentist, you&apos;ll review the time, clinic and fee before anything is booked.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
