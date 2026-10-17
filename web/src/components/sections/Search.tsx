"use client";

import { ArrowRight, CalendarCheck, Search as SearchIcon, Sparkles } from "lucide-react";
import SearchBar from "../hero/SearchBar";
import { openAssistant } from "../hero/Assistant";
import { ToothIcon } from "../icons";
import { Container, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

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
      {/* cool light round the search; this scene reaches down only, never up into the hero */}
      <Atmosphere scene="search" />
      <Container className="pb-8 pt-10 sm:pt-14">
        <SearchBar />
        {/* the four ways in, as one segmented strip under the search (not four floating cards) */}
        <Reveal delay={0.1} className="mx-auto mt-10 max-w-[1080px]">
          <div className="grid grid-cols-1 divide-y divide-white/[0.06] overflow-hidden rounded-[var(--sf-r-md)] fmd-glass sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-white/[0.06]">
            {ACTIONS.map(({ icon: Icon, title, body, href, ai }, i) => (
              <a
                key={title}
                href={href ?? "#assistant"}
                onClick={(e) => {
                  if (ai) {
                    e.preventDefault();
                    openAssistant();
                  }
                }}
                className={`group flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-white/[0.03] max-lg:border-white/[0.06] ${i % 2 ? "sm:max-lg:border-l" : ""} ${i > 1 ? "sm:max-lg:border-t" : ""}`}
              >
                <Icon className="size-[18px] shrink-0 text-ink-3 transition-colors group-hover:text-ink" strokeWidth={1.4} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{title}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-4">{body}</span>
                </span>
                <ArrowRight className="arrow-nudge size-4 shrink-0 text-ink-4 group-hover:text-ink" strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
