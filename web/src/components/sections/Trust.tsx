import { ArrowUpRight, BadgeCheck, Building2, Fingerprint, GraduationCap, ShieldCheck, Stethoscope } from "lucide-react";
import { Container, Reveal, SectionHeader } from "../ui";

const STATS = [
  { value: "10K+", label: "Dentists listed" },
  { value: "50K+", label: "Patients guided" },
  { value: "4.9", label: "Average rating" },
  { value: "5", label: "Languages supported" },
];

const PILLARS = [
  { icon: BadgeCheck, title: "Verification ≠ advertising", body: "Verified means credentials were checked. Paid placements are labelled separately — always." },
  { icon: Fingerprint, title: "Consent-first records", body: "Least-privilege access, explicit sharing and an audit trail for sensitive data." },
  { icon: ShieldCheck, title: "AI with boundaries", body: "Educational and navigational. Clinical decisions stay with registered dentists." },
];

const ECOSYSTEM = [
  { id: "clinics", icon: Stethoscope, name: "FMD Clinic OS", body: "Practice management with an agentic AI clinic manager that executes authorised work.", tag: "For clinics" },
  { id: "students", icon: GraduationCap, name: "FMD Scholar", body: "A dentistry-focused academic AI workspace for doubts, viva, seminars and research.", tag: "For students" },
  { id: "companies", icon: Building2, name: "FMD for Companies", body: "A verified corporate presence within the dental ecosystem.", tag: "For dental companies" },
];

export default function Trust() {
  return (
    <section className="pt-28 sm:pt-40">
      <Container>
        <SectionHeader center eyebrow="Trust" title="Built for care that deserves trust" />

        <Reveal>
          <dl className="grid grid-cols-2 border-y border-line lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={s.label} className={`border-line px-4 py-10 text-center ${i % 2 ? "border-l" : ""} ${i === 2 ? "max-lg:border-t lg:border-l" : ""} ${i === 3 ? "max-lg:border-t" : ""}`}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="headline-silver block text-[44px] font-extralight leading-none tracking-[-0.04em] sm:text-[60px]">{s.value}</span>
                  <span className="mt-3 block text-[12.5px] text-ink-4">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-center text-[11px] text-ink-4">Prototype figures shown for design review.</p>
        </Reveal>

        <div className="mt-14 grid gap-3 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="h-full rounded-[24px] border border-line p-6">
                <Icon className="size-5 text-ink-2" strokeWidth={1.3} />
                <h3 className="mt-5 text-[15.5px] text-ink">{title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-28 sm:mt-36">
          <SectionHeader eyebrow="One ecosystem" title="FMD, beyond the patient app" />
          <div className="grid gap-3 md:grid-cols-3">
            {ECOSYSTEM.map(({ id, icon: Icon, name, body, tag }, i) => (
              <Reveal key={id} delay={i * 0.07}>
                <a id={id} href={`#${id}`} className="glass glass-interactive group flex h-full scroll-mt-28 flex-col rounded-[26px] p-6">
                  <div className="flex items-center justify-between">
                    <span className="icon-tile size-11">
                      <Icon className="size-[18px]" strokeWidth={1.3} />
                    </span>
                    <ArrowUpRight className="size-4 text-ink-4 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" strokeWidth={1.5} />
                  </div>
                  <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-ink-4">{tag}</p>
                  <h3 className="mt-2 text-[19px] font-light tracking-[-0.01em] text-ink">{name}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
