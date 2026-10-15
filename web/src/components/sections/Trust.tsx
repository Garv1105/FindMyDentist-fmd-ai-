import { BadgeCheck, Fingerprint, ShieldCheck } from "lucide-react";
import { Container, Reveal, SectionHeader } from "../ui";

// Counts are published only once they come from the live system; until then the slot says so instead of guessing.
// Set a value (string) here when a verified figure exists.
const STATS: { value: string | null; label: string }[] = [
  { value: null, label: "Verified dentists" },
  { value: null, label: "Patients guided" },
  { value: "5", label: "Languages in FMD AI" },
  { value: "Always", label: "Sponsored placements labelled" },
];

const PILLARS = [
  { icon: BadgeCheck, title: "Verification ≠ advertising", body: "Verified means credentials were checked. Paid placements are labelled separately — always." },
  { icon: Fingerprint, title: "Consent-first records", body: "Least-privilege access, explicit sharing and an audit trail for sensitive data." },
  { icon: ShieldCheck, title: "AI with boundaries", body: "Educational and navigational. Clinical decisions stay with registered dentists." },
];


export default function Trust() {
  return (
    <section className="pt-28 sm:pt-40">
      <Container>
        <SectionHeader center eyebrow="Trust" title="Built for care that deserves trust" />

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

        <div className="mt-14 grid overflow-hidden rounded-[28px] border border-white/[0.07] bg-white/[0.02] max-md:divide-y md:grid-cols-3 md:divide-x divide-white/[0.07]">
          {PILLARS.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="h-full p-7">
                <Icon className="size-5 text-ink-2" strokeWidth={1.3} />
                <h3 className="mt-5 text-[15.5px] text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
