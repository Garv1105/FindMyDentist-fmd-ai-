import { Container, Reveal } from "../ui";

const PRINCIPLES = [
  { title: "Dentistry-focused technology", body: "Experiences built around dental needs, professional workflows and patient journeys." },
  { title: "Connected experiences", body: "Patient-facing services and clinic operations brought into one broader ecosystem." },
  { title: "AI-assisted workflows", body: "AI that supports information, preparation and permitted administrative activity." },
  { title: "Responsible design", body: "Privacy, permissions, transparency and human oversight designed in, not added on." },
  { title: "Designed to evolve", body: "A foundation that can support more dental technology experiences over time." },
];

/** Brief §16: why the ecosystem matters — principles, not a third list of features. */
export default function WhyFMD() {
  return (
    <section id="why-fmd" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal className="lg:sticky lg:top-32 lg:self-start">
            <p className="eyebrow mb-5">Why FMD</p>
            <h2 className="type-h2-lg">
              <span className="headline-silver">Dentistry deserves a more connected technology ecosystem.</span>
            </h2>
          </Reveal>
          <ol className="divide-y divide-[var(--fmd-border)] border-y border-[var(--fmd-border)]">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title}>
                <Reveal delay={i * 0.05} className="group flex gap-6 py-7">
                  <span className="bg-gradient-to-b from-[#8fb8ff] to-[#2f6bff] bg-clip-text text-[34px] font-extralight leading-none tabular-nums text-transparent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[19px] font-normal tracking-[-0.015em] text-ink">{p.title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-3">{p.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
