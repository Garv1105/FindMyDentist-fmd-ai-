"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { TREATMENTS } from "@/data/demo";
import { openAssistant } from "../hero/Assistant";
import { Container, Reveal, SectionHeader } from "../ui";

export default function Treatments() {
  return (
    <section id="treatments" className="scroll-mt-24 pt-24 sm:pt-32">
      <Container>
        <SectionHeader
          eyebrow="Understand"
          title="Popular treatments"
          description="What happens, how long it takes and what to ask, explained in plain language by FMD AI before you ever sit in the chair."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TREATMENTS.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.07}>
              <button
                onClick={() => openAssistant(`Tell me about ${t.title.toLowerCase()}`)}
                aria-label={`Ask FMD AI about ${t.title}`}
                className="glass glass-interactive group flex h-full w-full items-center gap-4 rounded-[22px] p-2.5 pr-4 text-left"
              >
                <div className="relative h-[84px] w-[92px] shrink-0 overflow-hidden rounded-[16px] border border-line">
                  <Image
                    src={t.img}
                    alt=""
                    fill
                    sizes="104px"
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] text-ink">{t.title}</h3>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{t.blurb}</p>
                  <p className="mt-2 truncate text-[10.5px] uppercase tracking-[0.14em] text-ink-4">{t.meta}</p>
                </div>
                <ArrowRight className="arrow-nudge size-4 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.5} />
              </button>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
