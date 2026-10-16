import { Container, Reveal } from "../ui";

/**
 * The two typography-led brand moments (brief concepts 02 and 04).
 * Deliberately no cards: whitespace, one horizon line and the words.
 */

/** Concept 02 — the big, bold statement, straight after the search. */
export function BrandStatement() {
  return (
    <section id="future" aria-labelledby="future-h" className="relative scroll-mt-24 pt-32 sm:pt-48">
      <Container className="relative text-center">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[min(1100px,100%)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--accent-rgb)/0.14),transparent_75%)]" />
        <Reveal>
          <p className="eyebrow">The future of dentistry</p>
          <h2 id="future-h" className="mx-auto mt-7 max-w-[15ch] text-[clamp(44px,6.4vw,104px)] font-extralight leading-[0.98] tracking-[-0.045em] [text-wrap:balance]">
            <span className="headline-silver">Dentistry has never seen what&apos;s coming.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-8 bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-[clamp(19px,1.6vw,26px)] font-light tracking-[-0.015em] text-transparent">
            Meet FMD. The next frontier of dental intelligence.
          </p>
          <span aria-hidden className="mx-auto mt-10 block h-px w-[min(560px,70%)] bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.55),transparent)]" />
          <p className="type-lede mx-auto mt-10">
            From the first question a patient asks to the workflows that keep a dental clinic running, FMD is building a more connected dental
            experience.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/** Concept 04 — a short brand-philosophy band at the turn from the story to the products. */
export function Philosophy() {
  return (
    <section aria-labelledby="philosophy-h" className="pt-28 sm:pt-40">
      <Container>
        <Reveal className="relative overflow-hidden rounded-[36px] border border-[var(--fmd-border)] px-6 py-16 text-center sm:px-12 sm:py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_50%_120%,rgb(var(--accent-rgb)/0.22),transparent_60%),linear-gradient(180deg,var(--fmd-midnight),var(--fmd-near-black))]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-[15%] bottom-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.7),transparent)]" />
          <h2 id="philosophy-h" className="mx-auto max-w-[18ch] text-[clamp(34px,4.4vw,68px)] font-extralight leading-[1.02] tracking-[-0.04em] [text-wrap:balance]">
            <span className="headline-silver">A new intelligence. An entirely new dentistry.</span>
          </h2>
          {/* "autonomous" is scoped to what Clinic OS actually does: scheduled internal tasks run on their own, anything external waits for approval */}
          <p className="type-lede mx-auto mt-6">
            The next generation of dental AI, connected care and autonomous clinic workflows — always within the permissions your clinic sets.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
