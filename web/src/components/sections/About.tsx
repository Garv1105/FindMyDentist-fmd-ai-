import { Compass, HeartHandshake, Network, Sparkles, Target } from "lucide-react";
import { Container, Reveal } from "../ui";

const PRINCIPLES = [
  { icon: Network, title: "Connected care", body: "Help patients and dental professionals navigate the journey from discovery to follow-up." },
  { icon: Sparkles, title: "Dentistry-focused intelligence", body: "AI experiences designed around dental information, education and relevant workflows." },
  {
    icon: HeartHandshake,
    title: "Human-centred technology",
    body: "Clinical decisions stay with qualified dental professionals; sensitive actions follow appropriate authorization and consent.",
  },
];

/** Brief §03 / concept 05: the company, not just the patient journey. */
export default function About() {
  return (
    <section id="about" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-5">About FMD</p>
            <h2 className="type-h2-lg">
              <span className="headline-silver">We didn&apos;t build another dental software.</span>{" "}
              <span className="bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-transparent">We reimagined dentistry.</span>
            </h2>
            <p className="mt-6 text-[17px] font-light leading-relaxed text-ink-2">
              Introducing FMD — an AI-native dental ecosystem designed for what comes next.
            </p>
            <p className="type-lede mt-4">
              FMD connects patients, dentists, clinics, students and dental companies through a dentistry-focused technology ecosystem. It brings
              dental discovery, educational AI, digital care experiences and clinic-management workflows into a more connected environment.
            </p>
          </Reveal>

          <div className="grid content-start gap-4">
            {[
              { icon: Target, label: "Mission", text: "Make dental care easier to understand, navigate and manage through connected experiences and responsible AI." },
              {
                icon: Compass,
                label: "Vision",
                text: "Build an intelligence layer for dentistry that supports patient experiences, dental professionals, clinic operations and future dental technology products.",
              },
            ].map(({ icon: Icon, label, text }, i) => (
              <Reveal key={label} delay={0.08 * (i + 1)}>
                <div className="glass rounded-[28px] p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile size-10">
                      <Icon className="size-[18px]" strokeWidth={1.4} />
                    </span>
                    <p className="type-label text-ink-3">{label}</p>
                  </div>
                  <p className="mt-4 text-[16.5px] font-light leading-relaxed text-ink [text-wrap:pretty]">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="glass mt-14 grid overflow-hidden rounded-[28px] max-md:divide-y md:grid-cols-3 md:divide-x divide-[var(--fmd-border)]">
          {PRINCIPLES.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="h-full p-7">
                <span className="icon-tile size-10">
                  <Icon className="size-[18px]" strokeWidth={1.4} />
                </span>
                <h3 className="type-h3 mt-5">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
