import { ArrowRight, Building2, HeartPulse, Stethoscope, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { Container, Reveal, SectionHeader } from "../ui";

// One explicit next step per audience; every destination exists.
const AUDIENCES = [
  { icon: HeartPulse, who: "Patients", body: "Ask, understand and find the right care.", cta: "Explore FMD Main", href: "/#treatments" },
  { icon: UserRoundPlus, who: "Dentists", body: "Create your professional profile and join the network.", cta: "Join the FMD Network", href: "/signin" },
  { icon: Stethoscope, who: "Clinics", body: "See Clinic OS, or hear first as new capabilities open.", cta: "Book a demo", href: "/#clinic-os-demo" },
  // extra (not in homepage PDF): { icon: GraduationCap, who: "Students", body: "Join with a student membership as Scholar launches.", cta: "Explore FMD Scholar", href: "/#students" },
  { icon: Building2, who: "Partners", body: "Dental companies and partners who want to work with FMD.", cta: "Contact FMD", href: "mailto:support@findmydentist.io?subject=Partnering%20with%20FMD" },
];

/** Brief §19: audience-specific conversion, instead of one generic waitlist for everyone. */
export default function JoinNetwork() {
  return (
    <section id="join" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <SectionHeader
          center
          eyebrow="Join the FMD network"
          title="Be part of what's next in dentistry."
          description="Discover how FMD can support your dental journey, professional practice, clinic or academic work."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map(({ icon: Icon, who, body, cta, href }, i) => (
            <Reveal key={who} delay={i * 0.06}>
              <Link href={href} className="glass glass-interactive group flex h-full flex-col rounded-[24px] p-6">
                <span className="icon-tile size-11">
                  <Icon className="size-[18px]" strokeWidth={1.3} />
                </span>
                <p className="mt-6 type-label text-ink-4">{who}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
                <span className="mt-auto flex items-center gap-2 pt-6 text-[13.5px] text-ink">
                  {cta} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.5} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
