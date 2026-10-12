"use client";

import { ArrowRight, ChevronDown, MapPin, MoreHorizontal, Search } from "lucide-react";
import { useState } from "react";
import { CITIES, SPECIALTIES } from "@/lib/catalog";
import { useDiscovery } from "../discovery";

export default function SearchBar() {
  const { query, setQuery, city, setCity, specialty, setSpecialty } = useDiscovery();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? SPECIALTIES : SPECIALTIES.slice(0, 6);

  const go = () => document.getElementById("dentists")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div id="search" className="mx-auto w-full max-w-[1080px] scroll-mt-32">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="glass group/search mx-auto flex max-w-[820px] items-center rounded-full p-1.5 pl-5 transition-shadow duration-500 focus-within:shadow-[inset_0_1px_0_var(--inner-hi),0_0_0_1px_rgb(var(--accent-rgb)/0.18),0_0_60px_-10px_var(--accent-glow)] sm:p-2 sm:pl-6"
      >
        <Search className="size-[18px] shrink-0 text-ink-3 transition-colors group-focus-within/search:text-ink" strokeWidth={1.5} />
        <label htmlFor="q" className="sr-only">
          Search dentists, treatments or clinics
        </label>
        <input
          id="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dentists, treatments or clinics…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-ink-4 sm:h-12"
        />
        <span className="hidden h-7 w-px bg-line-strong sm:block" />
        <label className="relative hidden items-center gap-2 pl-4 pr-2 text-[14px] text-ink-2 sm:flex">
          <MapPin className="size-4 text-ink-3" strokeWidth={1.5} />
          <span className="sr-only">Location</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="cursor-pointer appearance-none bg-transparent pr-6 text-ink outline-none [&>option]:bg-[var(--surface)]"
          >
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-ink-4" strokeWidth={1.5} />
        </label>
        <button type="submit" aria-label="Search" className="btn-primary group ml-1 size-11 shrink-0 sm:ml-3 sm:size-12">
          <ArrowRight className="arrow-nudge size-[18px]" strokeWidth={1.75} />
        </button>
      </form>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
        {visible.map((s) => {
          const on = specialty === s;
          return (
            <button
              key={s}
              aria-pressed={on}
              onClick={() => {
                setSpecialty(on ? null : s);
              }}
              className={`glass shrink-0 rounded-full px-4 py-2 text-[13px] transition-all duration-500 ${
                on ? "text-ink shadow-[inset_0_1px_0_var(--inner-hi),0_0_0_1px_rgb(var(--accent-rgb)/0.3),0_0_30px_-8px_var(--accent-glow)]" : "text-ink-3 hover:text-ink"
              }`}
            >
              {s}
            </button>
          );
        })}
        <button
          onClick={() => setShowAll((v) => !v)}
          className="glass flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] text-ink-3 transition-colors hover:text-ink"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.5} />
          {showAll ? "Less" : "More"}
        </button>
      </div>
    </div>
  );
}
