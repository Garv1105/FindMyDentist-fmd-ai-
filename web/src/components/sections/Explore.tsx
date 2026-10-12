"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import type { FeedItem } from "../content/FeedCard";
import { Container, Reveal, SectionHeader, SponsoredBadge } from "../ui";

/** Homepage preview of the live feed; the full experience lives at /explore. */
export default function Explore() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    api<{ items: FeedItem[] }>("/api/feed").then((r) => setItems(r.items.slice(0, 3))).catch(() => setItems([]));
  }, []);
  return (
    <section id="explore" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <SectionHeader eyebrow="Explore" title="Learn from verified dentists" description="Reviewed before publishing. Sponsored posts are always labelled." action={{ label: "Open Explore", href: "/explore" }} />
        <div className="grid gap-4 md:grid-cols-3">
          {!items && <p className="text-[13px] text-ink-4">Loading…</p>}
          {items?.map((i, n) => (
            <Reveal key={i.id} delay={n * 0.06}>
              <Link href="/explore" className="glass glass-interactive group flex h-full flex-col rounded-[24px] p-6">
                <div className="flex items-center gap-2 text-[12px] text-ink-4">
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-3">{i.topic}</span>
                  {i.sponsoredBy && <SponsoredBadge />}
                  {i.demo && <span className="uppercase tracking-[0.16em]">Demo</span>}
                </div>
                <h3 className="mt-4 text-[17px] font-light leading-snug text-ink">{i.title}</h3>
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-3">{i.body}</p>
                <p className="mt-auto flex items-center gap-2 pt-5 text-[12.5px] text-ink-3">
                  {i.author?.name ?? "FMD"}
                  <ArrowRight className="arrow-nudge ml-auto size-4" strokeWidth={1.5} />
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
