"use client";

import { ArrowRight, BadgeCheck } from "lucide-react";
import MascotArt from "@/components/MascotArt";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import type { FeedItem } from "../content/FeedCard";
import { Container, Reveal, SponsoredBadge } from "../ui";
import { Atmosphere } from "./LowerWorld";

/** Section 05: homepage preview of the live feed, editorial layout (one lead story, a short list); full feed at /explore. */
export default function Explore() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    api<{ items: FeedItem[] }>("/api/feed").then((r) => setItems(r.items.slice(0, 4))).catch(() => setItems([]));
  }, []);
  const [lead, ...rest] = items ?? [];
  return (
    <section id="explore" className="relative isolate scroll-mt-24 pt-28 sm:pt-40">
      <Atmosphere scene="learn" />
      <Container>
        {/* editorial spread: the heading on its own on the left; on the right a reading room, the guide reading in the lead story's own card */}
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-10">
          <Reveal className="lg:pb-4">
            <p className="eyebrow mb-3.5">Learn</p>
            <h2 className="type-h2-lg max-w-sm text-ink">Learn from verified dentists</h2>
            <p className="type-lede mt-5 max-w-sm">Explore expert dental advice and simple tips for a healthier, brighter smile.</p>
            <a href="/explore" className="group mt-7 inline-flex w-fit items-center gap-2 text-sm text-ink-2 transition-colors hover:text-ink">
              Open Explore <ArrowRight className="arrow-nudge size-4" strokeWidth={1.5} />
            </a>
          </Reveal>

          {!items && <p className="self-center p-6 text-[13px] text-ink-4">Loading…</p>}
          {items?.length === 0 && (
            <p className="self-start rounded-[var(--sf-r-md)] fmd-surface p-6 text-[13.5px] text-ink-3">
              No posts to show right now. <Link href="/explore" className="underline underline-offset-4">Open Explore</Link>
            </p>
          )}
          {lead && (
            <Reveal delay={0.06}>
              <Link
                href="/explore"
                className="group relative flex min-h-[360px] flex-col overflow-hidden rounded-[var(--sf-r-lg)] fmd-surface-raised fmd-hover p-7 sm:p-9 lg:pl-[290px]"
              >
                {/* the reading corner: a lamp-like pool of light over the book; 270px box (lg) → ~227px visible, glasses and pages legible */}
                <div aria-hidden className="relative mx-auto -mt-2 mb-4 size-[190px] lg:absolute lg:bottom-0 lg:left-4 lg:m-0 lg:size-[270px]">
                  <div className="absolute left-1/2 top-[18%] h-[70%] w-[90%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(157,184,255,0.14),transparent)]" />
                  <div className="absolute bottom-[5%] left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(157,184,255,0.2),transparent)]" />
                  <MascotArt src="/img/mascots/mascot-read-1024.webp" sizes="(min-width:1024px) 270px, 190px" />
                </div>
                <span aria-hidden className="pointer-events-none absolute bottom-[22px] left-0 hidden h-px w-[300px] bg-[linear-gradient(90deg,transparent,var(--fmd-border-strong),transparent)] lg:block" />
                <Meta item={lead} />
                <h3 className="relative mt-auto max-w-lg pt-8 text-[26px] font-normal leading-[1.15] tracking-[-0.024em] text-ink [text-wrap:balance] sm:text-[32px]">{lead.title}</h3>
                <p className="relative mt-4 line-clamp-4 max-w-lg text-[14.5px] leading-relaxed text-ink-3">{lead.body}</p>
                <Byline item={lead} />
              </Link>
            </Reveal>
          )}
        </div>
        {/* the rest read as an editorial column set under the lead story, not three more cards: a hairline above each,
            open space, and a quiet hover on the text. Only the lead story is a surface. */}
        {rest.length > 0 && (
          <ul className="mt-10 grid gap-x-8 gap-y-8 md:grid-cols-3">
            {rest.map((i, n) => (
              <li key={i.id}>
                <Reveal delay={0.06 * (n + 1)} className="h-full">
                  <Link href="/explore" className="group fmd-divider flex h-full flex-col rounded-[2px] pt-5">
                    <Meta item={i} />
                    <h3 className="type-h3 mt-3 transition-colors duration-300 group-hover:text-[var(--sapphire-hi)]">{i.title}</h3>
                    <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-3 transition-colors duration-300 group-hover:text-ink-2">{i.body}</p>
                    <Byline item={i} />
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

function Meta({ item }: { item: FeedItem }) {
  return (
    <div className="relative flex flex-wrap items-center gap-2 text-[12px] text-ink-4">
      <span className="rounded-full border border-[var(--fmd-border)] px-2.5 py-0.5 text-ink-3">{item.topic}</span>
      {item.sponsoredBy && <SponsoredBadge />}
      {item.demo && <span className="uppercase tracking-[0.16em]">Demo</span>}
    </div>
  );
}

function Byline({ item }: { item: FeedItem }) {
  return (
    <p className="relative mt-auto flex items-center gap-2 pt-5 text-[12.5px] text-ink-3">
      {item.author?.name ?? "FMD"}
      {item.author?.verified && <BadgeCheck className="size-3.5 text-ink-2" strokeWidth={1.75} aria-label="Verified dentist" />}
      <ArrowRight className="arrow-nudge ml-auto size-4" strokeWidth={1.5} />
    </p>
  );
}
