import { ArrowRight, Building2, GraduationCap, HeartPulse, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Container, Reveal, SectionHeader } from "../ui";

// Only routes that exist: Scholar access is part of the student membership (sign-in), there is no Scholar page yet.
const PRODUCTS = [
  {
    id: "main",
    icon: HeartPulse,
    tag: "For patients",
    name: "FMD Main",
    body: "The patient ecosystem: FMD AI guidance, verified dentist discovery, appointments, records and FMD Edge concierge.",
    points: ["FMD AI in five languages", "Verified vs sponsored, always labelled", "Consent-first dental records"],
    cta: { label: "Find a dentist", href: "/#dentists" },
  },
  {
    id: "clinics",
    icon: Stethoscope,
    tag: "For clinics",
    name: "FMD Clinic OS",
    body: "Clinic management with an AI clinic manager that prepares work for your approval.",
    points: ["Runs on authorised actions only", "Separate subscription from dentist membership"],
    cta: { label: "Open Clinic OS", href: "/clinic" },
  },
  {
    id: "students",
    icon: GraduationCap,
    tag: "For students",
    name: "FMD Scholar",
    body: "A dentistry-focused academic AI workspace for doubts, viva, seminars and research.",
    points: ["Included with an active student membership", "Monthly usage limits apply"],
    cta: { label: "Join as a student", href: "/signin" },
  },
];

/** Section 11: the FMD product family. Panels share one frame but each leads with its own audience and action. */
export default function Products() {
  return (
    <section className="pt-28 sm:pt-40">
      <Container>
        <SectionHeader center eyebrow="One ecosystem" title="Different FMD, one standard of care" description="Three products built on the same verification, consent and AI boundaries." />
        <div className="grid gap-4 lg:grid-cols-3">
          {PRODUCTS.map(({ id, icon: Icon, tag, name, body, points, cta }, i) => (
            <Reveal key={id} delay={i * 0.08}>
              <article
                id={id}
                className={`relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-[28px] border border-[var(--fmd-border)] p-7 ${
                  i === 0 ? "bg-[linear-gradient(160deg,var(--fmd-royal)_-30%,var(--fmd-deep)_45%,var(--fmd-midnight))]" : "bg-[linear-gradient(180deg,var(--fmd-deep),var(--fmd-midnight))]"
                }`}
              >
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(closest-side,var(--fmd-glow),transparent)]" />
                <span className="icon-tile relative size-11">
                  <Icon className="size-[18px]" strokeWidth={1.3} />
                </span>
                <p className="relative mt-8 type-label text-ink-4">{tag}</p>
                <h3 className="relative mt-2 text-[22px] font-normal tracking-[-0.018em] text-ink">{name}</h3>
                <p className="relative mt-2 text-[14px] leading-relaxed text-ink-3">{body}</p>
                <ul className="relative mt-5 space-y-2 border-t border-[var(--fmd-border)] pt-5">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[13px] text-ink-3">
                      <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-[rgb(var(--horizon-rgb)/0.6)]" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href={cta.href} className="group relative mt-auto inline-flex items-center gap-2 pt-7 text-[13.5px] text-ink-2 transition-colors hover:text-ink">
                  {cta.label} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.5} />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
        <p id="companies" className="mt-6 flex scroll-mt-28 items-center justify-center gap-2 text-center text-[12.5px] text-ink-4">
          <Building2 className="size-3.5" strokeWidth={1.5} /> FMD for Companies: a verified corporate presence within the dental ecosystem.
        </p>
      </Container>
    </section>
  );
}
