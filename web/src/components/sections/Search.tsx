"use client";

import { ArrowRight, CalendarCheck, Search as SearchIcon, Sparkles } from "lucide-react";
import SearchBar from "../hero/SearchBar";
import { openAssistant } from "../hero/Assistant";
import { ToothIcon } from "../icons";
import { Container, Reveal } from "../ui";

const ACTIONS = [
  { icon: SearchIcon, title: "Find Dentists Near You", body: "Verified professionals, clearly labelled.", href: "#dentists" },
  { icon: ToothIcon, title: "Understand Treatments", body: "Clear, simple and reliable information.", href: "#treatments" },
  { icon: Sparkles, title: "AI Dental Assistant", body: "Plain-language answers, any time.", ai: true },
  { icon: CalendarCheck, title: "Book Appointments", body: "Review every detail before you confirm.", href: "#dentists" },
];

/** Section 02: the dentist search, continuing straight out of the hero's navy AI stage. */
export default function Search() {
  return (
    <section aria-label="Search dentists" className="relative z-10 isolate">
      {/* rises out of the hero and settles into the midnight navy of the sections below: no hard boundary on either side */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_0%,var(--bg-midnight)_35%,var(--bg-midnight)_70%,transparent_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(50%_60%_at_50%_0%,var(--bg-glow),transparent_75%)]" />
      <Container className="pb-8 pt-10 sm:pt-14">
        <SearchBar />
        <div className="mx-auto mt-12 grid max-w-[1180px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map(({ icon: Icon, title, body, href, ai }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <a
                href={href ?? "#assistant"}
                onClick={(e) => {
                  if (ai) {
                    e.preventDefault();
                    openAssistant();
                  }
                }}
                className="glass glass-interactive group flex h-full items-center gap-4 rounded-[22px] p-4 pr-5"
              >
                <span className="icon-tile size-12 shrink-0">
                  <Icon className="size-5" strokeWidth={1.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-4">{body}</span>
                </span>
                <ArrowRight className="arrow-nudge size-4 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.5} />
              </a>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
