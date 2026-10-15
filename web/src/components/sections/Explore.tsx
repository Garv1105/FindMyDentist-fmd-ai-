"use client";

import { ArrowRight, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import type { FeedItem } from "../content/FeedCard";
import { Container, Reveal, SectionHeader, SponsoredBadge } from "../ui";

/** Section 05: homepage preview of the live feed, editorial layout (one lead story, a short list); full feed at /explore. */
export default function Explore() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    api<{ items: FeedItem[] }>("/api/feed").then((r) => setItems(r.items.slice(0, 4))).catch(() => setItems([]));
  }, []);
  const [lead, ...rest] = items ?? [];
  return (
    <section id="explore" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <SectionHeader eyebrow="Learn" title="Learn from verified dentists" description="Reviewed before publishing. Sponsored posts are always labelled." action={{ label: "Open Explore", href: "/explore" }} />
        {!items && <p className="text-[13px] text-ink-4">Loading…</p>}
        {items?.length === 0 && (
          <p className="rounded-[24px] border border-[var(--fmd-border)] p-6 text-[13.5px] text-ink-3">
            No posts to show right now. <Link href="/explore" className="underline underline-offset-4">Open Explore</Link>
          </p>
        )}
        {lead && (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <Reveal>
              <Link
                href="/explore"
                className="group relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-[28px] border border-[var(--fmd-border)] bg-[linear-gradient(155deg,var(--fmd-royal)_-40%,var(--fmd-deep)_40%,var(--fmd-midnight))] p-7 sm:p-9"
              >
                <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-[radial-gradient(closest-side,var(--fmd-glow-strong),transparent)]" />
                <Meta item={lead} />
                <h3 className="relative mt-6 max-w-lg text-[24px] font-normal leading-[1.2] tracking-[-0.022em] text-ink [text-wrap:balance] sm:text-[30px]">{lead.title}</h3>
                <p className="relative mt-3 line-clamp-4 max-w-lg text-[14.5px] leading-relaxed text-ink-3">{lead.body}</p>
                <Byline item={lead} />
              </Link>
            </Reveal>
            <ul className="flex flex-col divide-y divide-[var(--fmd-border)] rounded-[28px] border border-[var(--fmd-border)] bg-white/[0.015]">
              {rest.map((i, n) => (
                <li key={i.id}>
                  <Reveal delay={0.06 * (n + 1)}>
                    <Link href="/explore" className="group flex flex-col p-6 transition-colors hover:bg-white/[0.02]">
                      <Meta item={i} />
                      <h3 className="type-h3 mt-3">{i.title}</h3>
                      <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-3">{i.body}</p>
                      <Byline item={i} />
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
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
