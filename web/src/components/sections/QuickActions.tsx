"use client";

import { ArrowRight, CalendarCheck, Search, Sparkles } from "lucide-react";
import { ToothIcon } from "../icons";
import { openAssistant } from "../hero/Assistant";
import { Container, Reveal } from "../ui";

const ACTIONS = [
  { icon: Search, title: "Find Dentists Near You", body: "Verified professionals. Real reviews.", href: "#dentists" },
  { icon: ToothIcon, title: "Understand Treatments", body: "Clear, simple and reliable information.", href: "#treatments" },
  { icon: Sparkles, title: "AI Dental Assistant", body: "Plain-language answers, any time.", ai: true },
  { icon: CalendarCheck, title: "Book Appointments", body: "Review every detail before you confirm.", href: "#dentists" },
];

export default function QuickActions() {
  return (
    <section className="relative pb-20 pt-4">
      <Container className="relative z-10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                className="liquid-glass group flex h-full items-center gap-4 rounded-[26px] p-4 pr-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
              >
                <span className="liquid-glass grid size-12 shrink-0 place-items-center rounded-2xl text-ink">
                  <Icon className="size-5" strokeWidth={1.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-4">
                    {body}
                  </span>
                </span>
                <ArrowRight
                  className="arrow-nudge size-4 shrink-0 text-ink-3 group-hover:text-ink"
                  strokeWidth={1.5}
                />
              </a>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
