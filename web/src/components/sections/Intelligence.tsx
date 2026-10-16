import { ArrowRight, Check, Clock3, Link2, ShieldCheck, Sparkles, Stethoscope, UserRound } from "lucide-react";
import { Container, Reveal, StatusTag } from "../ui";

// Steps mirror real Clinic OS AI tools and its fixed approval policy: read/internal run, external waits for a person.
const TASK = [
  { tool: "Find patients due for recall", note: "Read-only · ran automatically", state: "done" },
  { tool: "Draft recall reminders", note: "Internal · ran automatically", state: "done" },
  { tool: "Send 14 reminders by SMS", note: "External · needs approval", state: "approval" },
] as const;

/** Brief §05 / concept 03: the AI story beyond a chat box — guidance for patients, permitted action for clinics. */
export default function Intelligence() {
  return (
    <section id="intelligence" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-5">AI that takes action</p>
          <h2 className="type-h2-lg">
            <span className="headline-silver">The world&apos;s first dental ecosystem where AI doesn&apos;t just answer.</span>{" "}
            <span className="bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-transparent">It acts.</span>
          </h2>
          <p className="type-lede mx-auto mt-6">
            From an AI-facing dental platform to an intelligent clinic manager built to execute workflows, FMD is exploring how dentistry-focused
            intelligence can make care experiences and clinic operations more connected.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* A — patients */}
          <Reveal>
            <article className="glass flex h-full flex-col rounded-[30px] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <p className="type-label text-ink-4">A · AI for patients</p>
                <StatusTag s="available" />
              </div>
              <h3 className="mt-4 text-[22px] font-normal tracking-[-0.018em] text-ink">Guidance, in plain language</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
                Explore dental concerns, understand common treatment options, learn the terminology and find the kind of dental professional you may
                need.
              </p>
              <div aria-hidden className="mt-7 space-y-3 rounded-[22px] border border-line bg-black/20 p-4">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[linear-gradient(180deg,#4d8dff,#2f6bff)] px-4 py-2.5 text-[13px] text-white">
                  My tooth hurts when I drink something cold.
                </div>
                <div className="flex gap-2.5">
                  <span className="icon-tile size-7 shrink-0 !rounded-full">
                    <Sparkles className="size-3.5" strokeWidth={1.5} />
                  </span>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-2.5 text-[13px] leading-relaxed text-ink-2">
                    Sharp sensitivity to cold is often linked to exposed dentine. A general dentist can check it — I can&apos;t diagnose it.
                  </div>
                </div>
              </div>
              <p className="mt-auto flex items-center gap-2 pt-6 text-[12px] text-ink-4">
                <UserRound className="size-3.5" strokeWidth={1.5} /> Educational guidance only. You decide every next step.
              </p>
            </article>
          </Reveal>

          {/* B — clinics */}
          <Reveal delay={0.08}>
            <article className="glass flex h-full flex-col rounded-[30px] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <p className="type-label text-ink-4">B · AI for clinics</p>
                <StatusTag s="beta" />
              </div>
              <h3 className="mt-4 text-[22px] font-normal tracking-[-0.018em] text-ink">Prepared work, with you in charge</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
                Clinic teams ask in plain words; the AI clinic manager organises information and prepares permitted administrative work. Anything that
                leaves the clinic waits for a person to approve it.
              </p>
              <div className="mt-7 rounded-[22px] border border-line bg-black/20 p-4">
                <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
                  <Stethoscope className="size-3.5 text-ink-3" strokeWidth={1.5} />
                  &ldquo;Remind patients due for recall this month&rdquo;
                </p>
                <ol className="mt-3 space-y-2">
                  {TASK.map((t) => (
                    <li key={t.tool} className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full ${
                          t.state === "done" ? "bg-[rgba(74,222,160,0.14)] text-[#8ef0c2]" : "bg-[rgb(var(--accent-rgb)/0.18)] text-[#a9c8ff]"
                        }`}
                      >
                        {t.state === "done" ? <Check className="size-3.5" strokeWidth={2} /> : <Clock3 className="size-3.5" strokeWidth={1.75} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{t.tool}</span>
                        <span className="block text-[11px] text-ink-4">{t.note}</span>
                      </span>
                      {t.state === "approval" && (
                        <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-medium text-[#1d4fd8]">Review</span>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[10.5px] uppercase tracking-[0.14em] text-ink-4">Illustration · demo data</p>
              </div>
              <p className="mt-auto flex items-center gap-2 pt-6 text-[12px] text-ink-4">
                <ShieldCheck className="size-3.5" strokeWidth={1.5} /> Runs only on the clinic&apos;s configured permissions, with an audit trail.
              </p>
            </article>
          </Reveal>
        </div>

        {/* C — connected */}
        <Reveal delay={0.1}>
          <div className="mt-4 flex flex-col gap-5 rounded-[30px] border border-[var(--fmd-border)] bg-[linear-gradient(120deg,rgb(var(--accent-rgb)/0.10),transparent_60%)] p-6 sm:flex-row sm:items-center sm:p-8">
            <span className="icon-tile size-12 shrink-0">
              <Link2 className="size-5" strokeWidth={1.3} />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <p className="type-label text-ink-4">C · One connected ecosystem</p>
                <StatusTag s="roadmap" />
              </div>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
                Patient-facing guidance and clinic workflows share one intelligence layer. The products are being connected step by step — not every
                experience is integrated yet.
              </p>
            </div>
            <a href="#assistant" className="btn-primary group h-11 shrink-0 px-5 text-[13.5px]">
              Explore FMD AI <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
