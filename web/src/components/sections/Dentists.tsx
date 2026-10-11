"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarClock, Heart, MapPin, SlidersHorizontal, Star, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { DENTISTS, type Dentist } from "@/data/demo";
import { useDiscovery } from "../discovery";
import { Chip, Container, SectionHeader, SponsoredBadge, VerifiedBadge } from "../ui";
import ProfileDrawer from "./ProfileDrawer";

type Sort = "recommended" | "rating" | "distance";

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-3 transition-colors focus-within:border-line-strong hover:border-line-strong">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer appearance-none bg-transparent text-ink outline-none [&>option]:bg-[var(--surface)]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function DentistCard({ d, onOpen }: { d: Dentist; onOpen: () => void }) {
  const [fav, setFav] = useState(false);
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
        <div className="relative h-[112px] w-[88px] shrink-0 overflow-hidden rounded-[16px] border border-line">
          <Image src={d.photo} alt={`${d.name} (demo profile)`} fill sizes="88px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <Star className="size-3.5" fill="var(--star)" stroke="none" />
              {d.rating}
              <span className="text-ink-4">({d.reviews})</span>
            </p>
            <button
              aria-label={fav ? "Remove from saved" : "Save dentist"}
              aria-pressed={fav}
              onClick={() => setFav((f) => !f)}
              className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full border border-line text-ink-3 transition-colors hover:text-ink"
            >
              <Heart className="size-3.5" strokeWidth={1.5} fill={fav ? "currentColor" : "none"} />
            </button>
          </div>
          <h3 className="mt-1 truncate text-[15.5px] text-ink">{d.name}</h3>
          <p className="text-[12.5px] text-ink-3">{d.specialty}</p>
          <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-ink-4">
            <MapPin className="size-3 shrink-0" strokeWidth={1.5} />
            {d.area} · {d.distanceKm} km
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {d.verified ? <VerifiedBadge /> : <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-4">Unverified</span>}
        {d.sponsored && <SponsoredBadge />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.services.map((s) => (
          <Chip key={s}>{s}</Chip>
        ))}
      </div>

      <p className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-[12.5px] text-ink-3 [margin-top:max(0.75rem,auto)]">
        <CalendarClock className="size-4 shrink-0" strokeWidth={1.4} />
        {d.nextSlot ? (
          <>
            Next available: <span className="text-ink-2">{d.nextSlot}</span>
          </>
        ) : (
          <span>Availability confirmed by clinic</span>
        )}
      </p>
      <button onClick={onOpen} className="btn-primary group mt-3 h-10 w-full text-[13px]">
        View Profile <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.75} />
      </button>
    </motion.article>
  );
}

export default function Dentists() {
  const { query, city, specialty, setSpecialty } = useDiscovery();
  const [sort, setSort] = useState<Sort>("recommended");
  const [lang, setLang] = useState("any");
  const [today, setToday] = useState(false);
  const [open, setOpen] = useState<Dentist | null>(null);

  const results = useMemo(() => {
    if (city !== "Bengaluru") return [];
    const q = query.trim().toLowerCase();
    const list = DENTISTS.filter(
      (d) =>
        (!specialty || d.specialty === specialty || d.services.some((s) => specialty.toLowerCase().includes(s.toLowerCase()))) &&
        (!q || [d.name, d.specialty, d.area, ...d.services].join(" ").toLowerCase().includes(q)) &&
        (lang === "any" || d.languages.includes(lang)) &&
        (!today || d.availableToday),
    );
    if (sort === "rating") return [...list].sort((a, b) => b.rating - a.rating);
    if (sort === "distance") return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
    return list;
  }, [query, city, specialty, sort, lang, today]);

  return (
    <section id="dentists" className="scroll-mt-24 pt-24 sm:pt-32">
      <Container>
        <SectionHeader
          eyebrow="Discover"
          title="Top rated dentists near you"
          description={
            <>
              Verification reflects checks FMD has completed. Sponsored placements are always labelled and never imply a clinical endorsement.
            </>
          }
          action={{ label: "View all", href: "#dentists" }}
        />

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-2 text-[12.5px] text-ink-4">
            <SlidersHorizontal className="size-3.5" strokeWidth={1.5} /> Refine
          </span>
          {specialty && (
            <button onClick={() => setSpecialty(null)} className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-1.5 text-[12.5px] text-ink">
              {specialty} <X className="size-3" strokeWidth={2} />
            </button>
          )}
          <Select
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              ["recommended", "Recommended"],
              ["rating", "Rating"],
              ["distance", "Distance"],
            ]}
          />
          <Select
            label="Language"
            value={lang}
            onChange={setLang}
            options={[
              ["any", "Any"],
              ["English", "English"],
              ["Hindi", "Hindi"],
              ["Kannada", "Kannada"],
              ["Tamil", "Tamil"],
              ["Telugu", "Telugu"],
            ]}
          />
          <button
            aria-pressed={today}
            onClick={() => setToday((t) => !t)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${today ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3 hover:border-line-strong"}`}
          >
            Available today
          </button>
          <span className="ml-auto hidden text-[11px] uppercase tracking-[0.2em] text-ink-4 md:block">Demo profiles</span>
        </div>

        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {results.map((d) => (
              <DentistCard key={d.id} d={d} onOpen={() => setOpen(d)} />
            ))}
          </AnimatePresence>
        </div>

        {results.length === 0 && (
          <div className="glass rounded-[24px] p-10 text-center">
            <p className="text-[17px] font-light text-ink">No matching dentists in {city} yet</p>
            <p className="mt-2 text-[13.5px] text-ink-4">Try a different specialty or language, or ask FMD Concierge to help coordinate.</p>
          </div>
        )}
      </Container>

      <ProfileDrawer dentist={open} onClose={() => setOpen(null)} />
    </section>
  );
}
