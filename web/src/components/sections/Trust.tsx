import { BadgeCheck, Eye, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Container, Reveal, SectionHeader } from "../ui";

// Counts are published only once they come from the live system; until then the slot says so instead of guessing.
// Set a value (string) here when a verified figure exists.
/* extra (not in homepage PDF) — stats row
const STATS: { value: string | null; label: string }[] = [
  { value: null, label: "Verified dentists" },
  { value: null, label: "Patients guided" },
  { value: "5", label: "Languages in FMD AI" },
  { value: "Always", label: "Sponsored placements labelled" },
];
*/

// Each claim matches what's implemented (providers verification, records sharing, auth/audit, labelling).
const PILLARS = [
  { icon: BadgeCheck, title: "Dentist verification", body: "Verified means FMD checked the dentist's dental council registration. Each profile shows the checks completed; paid placements are labelled separately." },
  { icon: Fingerprint, title: "Consent-first records", body: "Records are shared only by the patient, with a chosen dentist, through access that expires and can be revoked. Every view is logged." },
  { icon: ShieldCheck, title: "AI with boundaries", body: "Educational guidance for patients and approval-gated assistance for clinics. Neither replaces professional clinical judgement." },
  { icon: LockKeyhole, title: "Privacy and security", body: "Health details are stored apart from contact details and never used for advertising. Role-based access and an audit trail cover sensitive actions." },
  { icon: Eye, title: "Transparency", body: "Demo content, beta and roadmap capabilities, concept previews and sponsored placements are always labelled." },
];

const LEGAL = [
  ["Privacy notice", "/legal#privacy"],
  ["Terms of use", "/legal#terms"],
  ["AI disclaimer", "/legal#ai-disclaimer"],
  ["Contact support", "/help"],
] as const;


export default function Trust() {
  return (
    <section className="pt-28 sm:pt-40">
      <Container>
        <SectionHeader center eyebrow="Trust" title="Built for care that deserves trust" />

        {/* extra (not in homepage PDF) — stats row, restore when needed
        <Reveal>
          <dl className="grid grid-cols-2 rounded-[28px] border border-white/[0.07] bg-[radial-gradient(60%_120%_at_50%_0%,rgba(40,102,234,0.10),transparent_70%)] lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={s.label} className={`border-line px-4 py-10 text-center ${i % 2 ? "border-l" : ""} ${i === 2 ? "max-lg:border-t lg:border-l" : ""} ${i === 3 ? "max-lg:border-t" : ""}`}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  {s.value ? (
                    <span className="headline-silver block text-[44px] font-light leading-none tracking-[-0.035em] tabular-nums sm:text-[60px]">{s.value}</span>
                  ) : (
                    <span className="block text-[44px] font-light leading-none tracking-[-0.04em] text-ink-4 sm:text-[60px]"><span aria-hidden>—</span><span className="sr-only">Not yet published</span></span>
                  )}
                  <span className="mt-3 block text-[13px] text-ink-3">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-center text-[11px] text-ink-4">Platform counts are published at launch, from live data only.</p>
        </Reveal>
        */}

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PILLARS.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="glass h-full rounded-[24px] p-6">
                <span className="icon-tile size-10">
                  <Icon className="size-[18px]" strokeWidth={1.4} />
                </span>
                <h3 className="mt-5 text-[15.5px] text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <nav aria-label="Legal and support" className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
          {LEGAL.map(([l, href]) => (
            <Link key={l} href={href} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
              {l}
            </Link>
          ))}
        </nav>
      </Container>
    </section>
  );
}
