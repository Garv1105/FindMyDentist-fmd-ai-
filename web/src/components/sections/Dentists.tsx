"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, MapPin, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LANGUAGES, SERVICES } from "@/lib/catalog";
import { useDiscovery } from "../discovery";
import { Avatar, Verification, type ProviderCard } from "../providers";
import { Chip, Container, SectionHeader, SponsoredBadge } from "../ui";
import { fmtDay, fmtTime } from "../booking/BookingPanel";
import ProfileDrawer from "./ProfileDrawer";

type Result = {
  organic: ProviderCard[];
  sponsored: ProviderCard[];
  total: number;
  page: number;
  pages: number;
  suggestions: string[];
};

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-3 transition-colors focus-within:border-line-strong hover:border-line-strong">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[150px] cursor-pointer appearance-none bg-transparent text-ink outline-none [&>option]:bg-[var(--surface)]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function DentistCard({ d, onOpen }: { d: ProviderCard; onOpen: () => void }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass glass-interactive group flex w-[300px] shrink-0 snap-start flex-col rounded-[24px] p-3 sm:w-auto"
    >
      <div className="flex gap-3.5">
        <Avatar p={d} className="h-[112px] w-[88px]" />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Verification v={d.verification} />
            {d.sponsored && <SponsoredBadge />}
          </div>
          <h3 className="mt-2 truncate text-[15.5px] text-ink">{d.name}</h3>
          <p className="text-[12.5px] text-ink-3">
            {d.specialty}
            {d.experienceYears ? ` · ${d.experienceYears} yrs` : ""}
          </p>
          {d.clinic && (
            <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-ink-4">
              <MapPin className="size-3 shrink-0" strokeWidth={1.5} />
              {d.clinic.area}, {d.clinic.city}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {d.services
          .filter((s) => s !== "Consultation")
          .slice(0, 3)
          .map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
      </div>

      <p className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-[12.5px] text-ink-3 [margin-top:max(0.75rem,auto)]">
        <CalendarClock className="size-4 shrink-0" strokeWidth={1.4} />
        {d.nextAvailable ? (
          <>
            Next available: <span className="text-ink-2">{fmtDay(d.nextAvailable)}, {fmtTime(d.nextAvailable)}</span>
          </>
        ) : (
          <span>Availability confirmed by clinic</span>
        )}
      </p>
      <button onClick={onOpen} className="btn-primary group mt-3 h-10 w-full text-[13px]">
        View profile <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.75} />
      </button>
    </motion.article>
  );
}

export default function Dentists() {
  const { query, city, specialty, setSpecialty } = useDiscovery();
  const [sort, setSort] = useState("relevance");
  const [lang, setLang] = useState("");
  const [service, setService] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // filters changed → back to page 1 (reset during render, not in an effect)
  const key = [query, city, specialty, sort, lang, service].join("|");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPage(1);
  }

  useEffect(() => {
    const ctl = new AbortController();
    const qs = new URLSearchParams({ city, sort, page: String(page) });
    if (query.trim()) qs.set("q", query.trim());
    if (specialty) qs.set("specialty", specialty);
    if (lang) qs.set("language", lang);
    if (service) qs.set("service", service);
    // small debounce so typing in the hero search doesn't fire a request per keystroke
    const t = setTimeout(() => {
      fetch(`/api/providers?${qs}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Search is unavailable right now."))))
        .then((r: Result) => {
          setRes(r);
          setErr("");
        })
        .catch((e) => e.name !== "AbortError" && setErr(e.message));
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, city, specialty, sort, lang, service, page]);

  const cards = res ? [...res.sponsored, ...res.organic] : [];

  return (
    <section id="dentists" className="scroll-mt-24 pt-24 sm:pt-32">
      <Container>
        <SectionHeader
          eyebrow="Discover"
          title={`Dentists in ${city}`}
          description="Verification shows the checks FMD has actually completed. Sponsored placements are always labelled, are never a clinical endorsement and don't change the order of other results."
        />

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-2 text-[12.5px] text-ink-4">
            <SlidersHorizontal className="size-3.5" strokeWidth={1.5} /> Refine
          </span>
          {specialty && (
            <button onClick={() => setSpecialty(null)} className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-1.5 text-[12.5px] text-ink">
              {specialty} <X className="size-3" strokeWidth={2} />
              <span className="sr-only">Remove filter</span>
            </button>
          )}
          <Select label="Sort" value={sort} onChange={setSort} options={[["relevance", "Recommended"], ["experience", "Experience"], ["name", "Name"]]} />
          <Select label="Treatment" value={service} onChange={setService} options={[["", "Any"], ...SERVICES.map((s) => [s, s] as [string, string])]} />
          <Select label="Language" value={lang} onChange={setLang} options={[["", "Any"], ...LANGUAGES.map((l) => [l, l] as [string, string])]} />
          {res && (
            <span className="ml-auto text-[12px] text-ink-4" aria-live="polite">
              {res.total} {res.total === 1 ? "dentist" : "dentists"}
            </span>
          )}
        </div>

        {err && (
          <p role="alert" className="mb-4 rounded-2xl border border-line-strong px-4 py-3 text-[13px] text-ink">
            <span className="font-medium">Error:</span> {err}
          </p>
        )}
        {!res && !err && <p className="text-[13px] text-ink-4">Loading dentists…</p>}

        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {cards.map((d) => (
              <DentistCard key={d.id} d={d} onOpen={() => setOpen(d.id)} />
            ))}
          </AnimatePresence>
        </div>

        {res && res.total === 0 && (
          <div className="glass rounded-[24px] p-10 text-center">
            <p className="type-h3">No matching dentists in {city} yet</p>
            <ul className="mx-auto mt-3 max-w-md space-y-1 text-[13.5px] text-ink-4">
              {res.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {/* FMD Edge section hidden: <a href="#concierge" className="btn-ghost mt-6 h-10 px-5 text-[13px]">
              Ask FMD Edge
            </a> */}
          </div>
        )}

        {res && res.pages > 1 && (
          <nav aria-label="Results pages" className="mt-6 flex items-center justify-center gap-3 text-[13px] text-ink-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-40">
              <ChevronLeft className="size-4" />
            </button>
            Page {res.page} of {res.pages}
            <button disabled={page >= res.pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
          </nav>
        )}

        {cards.some((c) => c.demo) && <p className="mt-5 text-center type-label text-ink-4">Demo profiles · not real practitioners</p>}
      </Container>

      <ProfileDrawer id={open} onClose={() => setOpen(null)} />
    </section>
  );
}

