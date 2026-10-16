import { ArrowRight, BadgeCheck, Bot, Briefcase, Megaphone, PenLine, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Container, Reveal, StatusTag, type Availability } from "../ui";

const AREAS: { icon: typeof BadgeCheck; title: string; body: string; s: Availability }[] = [
  { icon: BadgeCheck, title: "Digital professional profile", body: "Claim your profile with your council registration; the verified badge shows the checks FMD completed.", s: "available" },
  { icon: Megaphone, title: "Online discoverability", body: "Appear in specialty and treatment search. Ranking is never sold — sponsored slots are labelled separately.", s: "available" },
  { icon: PenLine, title: "Patient engagement", body: "Publish educational posts, reviewed before they go live, that patients can follow.", s: "available" },
  { icon: Stethoscope, title: "Clinic tools via Clinic OS", body: "Scheduling, records, billing and recalls for your own clinic workspace.", s: "available" },
  { icon: Bot, title: "AI-assisted admin", body: "The AI clinic manager prepares routine administrative work for your approval.", s: "beta" },
  { icon: Briefcase, title: "Professional community", body: "A dental jobs board today; broader community features as they open up.", s: "available" },
];

/** Brief §13: what FMD offers dentists, separate from the patient-facing directory. */
export default function ForDentists() {
  return (
    <section id="for-dentists" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal className="lg:sticky lg:top-32 lg:self-start">
            <p className="eyebrow mb-5">Built for dental professionals</p>
            <h2 className="type-h2-lg">
              <span className="headline-silver">A more connected professional experience.</span>
            </h2>
            <p className="type-lede mt-6">
              FMD helps dental professionals establish their digital presence, connect with patients and access relevant tools across the dental
              ecosystem.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/signin" className="btn-primary group h-12 px-6 text-[14px]">
                Join the FMD Network <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
              </Link>
              <Link href="/jobs" className="text-[13.5px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                Browse dental jobs
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {AREAS.map(({ icon: Icon, title, body, s }, i) => (
              <Reveal key={title} delay={(i % 2) * 0.06}>
                <div className="glass glass-interactive h-full rounded-[24px] p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="icon-tile size-11">
                      <Icon className="size-[18px]" strokeWidth={1.3} />
                    </span>
                    <StatusTag s={s} />
                  </div>
                  <h3 className="type-h3 mt-5">{title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
