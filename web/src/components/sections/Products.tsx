import { ArrowRight, Building2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Container, Reveal, SectionHeader, StatusTag, type Availability } from "../ui";

// FMD Main and Clinic OS have their own sections; this is the secondary tier of the ecosystem.
// Scholar: entitlements and usage limits exist server-side, but there's no Scholar workspace page yet.
const PRODUCTS: {
  id: string;
  icon: typeof GraduationCap;
  tag: string;
  name: string;
  body: string;
  points: string[];
  s: Availability;
  cta: { label: string; href: string };
}[] = [
  {
    id: "students",
    icon: GraduationCap,
    tag: "For students",
    name: "FMD Scholar",
    body: "A dentistry-focused academic AI workspace for subject doubts, viva preparation, seminars and research.",
    points: ["Comes with an active FMD student membership", "Monthly usage limits will apply", "Workspace opens to members as it launches"],
    s: "roadmap",
    cta: { label: "Join as a student", href: "/signin" },
  },
  {
    id: "companies",
    icon: Building2,
    tag: "For dental companies",
    name: "FMD for Companies",
    body: "A future pathway for dental companies and partners to establish a relevant, clearly labelled presence within the ecosystem.",
    points: ["Partnerships discussed individually", "Commercial presence is always labelled"],
    s: "roadmap",
    cta: { label: "Contact FMD", href: "mailto:support@findmydentist.io?subject=FMD%20for%20Companies" },
  },
];

/** Brief §14: Scholar and the broader ecosystem, kept secondary to FMD Main and Clinic OS. */
export default function Products() {
  return (
    <section className="pt-28 sm:pt-40">
      <Container>
        <SectionHeader
          center
          eyebrow="The broader ecosystem"
          title="Intelligence for every stage of dentistry."
          description="FMD's broader ecosystem is intended to support patients, dental professionals, clinics and students through connected dental technology."
        />
        <div className="mx-auto grid max-w-[1000px] gap-4 md:grid-cols-2">
          {PRODUCTS.map(({ id, icon: Icon, tag, name, body, points, s, cta }, i) => (
            <Reveal key={id} delay={i * 0.08}>
              <article id={id} className="glass relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-[28px] p-7">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(closest-side,var(--fmd-glow-strong),transparent)]" />
                <div className="relative flex items-start justify-between">
                  <span className="icon-tile size-11">
                    <Icon className="size-[18px]" strokeWidth={1.3} />
                  </span>
                  <StatusTag s={s} />
                </div>
                <p className="relative mt-8 type-label text-ink-4">{tag}</p>
                <h3 className="relative mt-2 text-[22px] font-normal tracking-[-0.018em] text-ink">{name}</h3>
                <p className="relative mt-2 text-[14px] leading-relaxed text-ink-3">{body}</p>
                <ul className="relative mt-5 space-y-2 border-t border-line pt-5">
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
      </Container>
    </section>
  );
}
