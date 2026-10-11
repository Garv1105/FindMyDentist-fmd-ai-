import { Bookmark, Heart, Play } from "lucide-react";
import Image from "next/image";
import { Container, Reveal, SectionHeader, SponsoredBadge, VerifiedBadge } from "../ui";

const POLL = [
  { label: "Every 3 months", pct: 46 },
  { label: "Every 6 months", pct: 31 },
  { label: "When it looks worn", pct: 23 },
];

export default function Explore() {
  return (
    <section id="explore" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <SectionHeader
          eyebrow="Explore"
          title="Learn from dentists, not guesswork"
          description="Short videos, explainers and polls from dental professionals — personalised to your interests, with sponsored content always labelled."
          action={{ label: "Open Explore", href: "#explore" }}
        />

        <div className="grid gap-3 md:grid-cols-3 md:grid-rows-2 lg:grid-cols-4">
          {/* reel */}
          <Reveal className="md:row-span-2">
            <article className="glass glass-interactive group relative flex h-full min-h-[420px] flex-col justify-end overflow-hidden rounded-[26px] p-5">
              <Image src="/img/tx-implants.png" alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="-z-10 object-cover opacity-60 transition-transform duration-[1.6s] group-hover:scale-105" />
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_30%,var(--background)_100%)]" />
              <span className="absolute left-1/2 top-[40%] grid size-14 -translate-x-1/2 place-items-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-md transition-transform duration-500 group-hover:scale-110">
                <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
              </span>
              <div className="flex gap-1.5">
                <VerifiedBadge />
                <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-3">Reel · 0:48</span>
              </div>
              <h3 className="mt-3 text-[19px] font-light leading-snug tracking-[-0.01em] text-ink">What actually happens during an implant procedure</h3>
              <p className="mt-2 text-[12px] text-ink-4">Dr. Sneha Iyer · demo creator</p>
            </article>
          </Reveal>

          <Reveal delay={0.06}>
            <article className="glass glass-interactive group flex h-full flex-col rounded-[26px] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-4">Explainer · 4 min read</p>
              <h3 className="mt-3 text-[17px] font-light leading-snug text-ink">Sensitive teeth: five common causes and when to see a dentist</h3>
              <div className="mt-auto flex items-center justify-between pt-6 text-ink-4">
                <span className="text-[12px]">FMD Editorial</span>
                <Bookmark className="size-4 transition-colors group-hover:text-ink" strokeWidth={1.5} />
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.12}>
            <article className="glass flex h-full flex-col rounded-[26px] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-4">Poll · 2.4K votes</p>
              <h3 className="mt-3 text-[15.5px] text-ink">How often do you replace your toothbrush?</h3>
              <ul className="mt-4 space-y-2">
                {POLL.map((o) => (
                  <li key={o.label} className="relative overflow-hidden rounded-[12px] border border-line px-3 py-2 text-[12.5px] text-ink-2">
                    <span className="absolute inset-y-0 left-0 bg-[var(--accent-soft)]" style={{ width: `${o.pct}%` }} />
                    <span className="relative flex justify-between">
                      {o.label}
                      <span className="tabular-nums text-ink-4">{o.pct}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal delay={0.18} className="lg:row-span-2">
            <article className="glass glass-interactive group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-[26px]">
              <div className="relative h-44 shrink-0 lg:h-1/2">
                <Image src="/img/tx-aligners.png" alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition-transform duration-[1.6s] group-hover:scale-105" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <SponsoredBadge />
                <h3 className="mt-3 text-[17px] font-light leading-snug text-ink">Clear aligners: is your case a good fit?</h3>
                <p className="mt-2 text-[12.5px] text-ink-4">Paid placement by a demo aligner brand</p>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.24} className="md:col-span-2 lg:col-span-2">
            <article className="glass glass-interactive group flex h-full items-center gap-5 rounded-[26px] p-3 pr-5">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-[18px] border border-line">
                <Image src="/img/tx-whitening.png" alt="" fill sizes="128px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-4">Post · Cosmetic dentistry</p>
                <h3 className="mt-2 text-[16px] font-light leading-snug text-ink">Whitening at home vs in-clinic — what dentists want you to know</h3>
              </div>
              <span className="hidden items-center gap-1.5 text-[12px] text-ink-4 sm:flex">
                <Heart className="size-3.5" strokeWidth={1.5} /> 1.2K
              </span>
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
