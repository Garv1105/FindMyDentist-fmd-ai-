import { ArrowRight, BrainCircuit, HeartPulse, Stethoscope } from "lucide-react";
import { Container, Reveal, SectionHeader, StatusTag, type Availability } from "../ui";

type Pillar = {
  id: string;
  icon: typeof HeartPulse;
  tag: string;
  name: string;
  headline: string;
  body: string;
  caps: [string, Availability][];
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
};

// Availability mirrors the codebase: Clinic OS modules ship today; its AI manager runs a rule-based planner (beta).
const PILLARS: Pillar[] = [
  {
    id: "main",
    icon: HeartPulse,
    tag: "For patients",
    name: "FMD Main",
    headline: "Your dental journey, connected.",
    body: "A patient-facing platform to understand dental concerns, discover dentists, explore treatment options, manage records and navigate care.",
    caps: [
      ["FMD AI educational guidance", "available"],
      ["Dentist and specialty discovery", "available"],
      ["Dentist profiles and appointments", "available"],
      ["Dental educational content", "available"],
      ["Digital records and treatment continuity", "available"],
    ],
    cta: { label: "Explore FMD Main", href: "#treatments" },
  },
  {
    id: "clinic-os-pillar",
    icon: Stethoscope,
    tag: "For clinics",
    name: "FMD Clinic OS",
    headline: "A smarter operating system for dental clinics.",
    body: "Essential clinic administration in one connected workspace, with AI-assisted clinic operations as part of its vision.",
    caps: [
      ["Appointments and scheduling", "available"],
      ["Digital patient records", "available"],
      ["Billing and payment recording", "available"],
      ["Recalls and follow-ups", "available"],
      ["AI clinic manager: prepares work for approval", "beta"],
    ],
    cta: { label: "Explore Clinic OS", href: "#clinic-os" },
    secondary: { label: "Book a demo", href: "#clinic-os-demo" },
  },
  {
    id: "intelligence-pillar",
    icon: BrainCircuit,
    tag: "The AI layer",
    name: "FMD Intelligence",
    headline: "Intelligence built around dentistry.",
    body: "Not a separate product yet: the dentistry-focused AI capabilities that power experiences across FMD.",
    caps: [
      ["Dental information and education", "available"],
      ["Clinic workflow assistance", "beta"],
      ["Content-preparation support", "beta"],
      ["Deeper integration across FMD products", "roadmap"],
    ],
    cta: { label: "Explore FMD Intelligence", href: "#assistant" }, // was #intelligence while that section is hidden
  },
];

/** Brief §04: the three pillars, early in the page, with honest availability on every capability. */
export default function Ecosystem() {
  return (
    <section id="ecosystem" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <SectionHeader
          center
          eyebrow="One ecosystem. Multiple experiences."
          title="One intelligence layer. Three core product pillars."
          description="FMD brings together patient-facing dental experiences, clinic-management workflows and dentistry-focused AI capabilities."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {PILLARS.map(({ id, icon: Icon, tag, name, headline, body, caps, cta, secondary }, i) => (
            <Reveal key={id} delay={i * 0.08}>
              <article id={id} className="glass relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-[30px] p-7">
                <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[radial-gradient(closest-side,rgb(var(--accent-rgb)/0.22),transparent)]" />
                <div className="relative flex items-center justify-between">
                  <span className="icon-tile size-12">
                    <Icon className="size-5" strokeWidth={1.3} />
                  </span>
                  <span className="type-label text-ink-4">{tag}</span>
                </div>
                <h3 className="relative mt-8 text-[24px] font-normal tracking-[-0.02em] text-ink">{name}</h3>
                <p className="relative mt-1 text-[15px] text-[#9cc0ff]">{headline}</p>
                <p className="relative mt-3 text-[14px] leading-relaxed text-ink-3">{body}</p>
                <ul className="relative mt-6 space-y-2.5 border-t border-line pt-5">
                  {caps.map(([c, s]) => (
                    <li key={c} className="flex items-start justify-between gap-3 text-[13px] leading-snug text-ink-2">
                      {c}
                      <StatusTag s={s} />
                    </li>
                  ))}
                </ul>
                <div className="relative mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-8">
                  <a href={cta.href} className="btn-primary group h-10 px-5 text-[13px]">
                    {cta.label} <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.75} />
                  </a>
                  {secondary && (
                    <a href={secondary.href} className="text-[13px] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
                      {secondary.label}
                    </a>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
