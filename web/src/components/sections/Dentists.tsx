"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Clock3, MapPin, SlidersHorizontal, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LANGUAGES, SERVICES } from "@/lib/catalog";
import { useDiscovery } from "../discovery";
import { Avatar, Verification, type ProviderCard } from "../providers";
import { Container, Reveal, SponsoredBadge } from "../ui";
import { fmtDay, fmtTime } from "../booking/BookingPanel";
import ProfileDrawer from "./ProfileDrawer";
import { Atmosphere } from "./LowerWorld";

type Result = {
  organic: ProviderCard[];
  sponsored: ProviderCard[];
  total: number;
  page: number;
  pages: number;
  suggestions: string[];
};

// glass pill; a sapphire inner glow on hover and while it holds a non-default choice
const PILL =
  "rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-[border-color,box-shadow,color] duration-300 hover:border-blue-400/40 hover:shadow-[inset_0_0_0_1px_rgb(59_130_246/0.25),inset_0_0_14px_rgb(59_130_246/0.18)]";
const PILL_ON = "border-blue-400/50 shadow-[inset_0_0_0_1px_rgb(59_130_246/0.3),inset_0_0_16px_rgb(59_130_246/0.22)]";

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const active = value !== options[0][0];
  return (
    <label
      className={`${PILL} ${active ? PILL_ON : ""} flex items-center gap-2 px-4 py-2 text-[12.5px] text-ink-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]`}
    >
      {/* status light: lit sapphire while this filter holds a choice */}
      <span
        aria-hidden
        className={`size-1.5 shrink-0 rounded-full transition-[background-color,box-shadow] duration-300 ${active ? "bg-blue-400 shadow-[0_0_6px_2px_rgb(96_165_250/0.7)]" : "bg-white/20"}`}
      />
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[150px] cursor-pointer appearance-none bg-transparent text-ink outline-none [&>option]:bg-[var(--surface)]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {/* readout: how many choices this filter offers */}
      <span aria-hidden className="rounded-full border border-white/10 px-1.5 font-mono text-[9.5px] tabular-nums text-ink-4">
        {String(options.length).padStart(2, "0")}
      </span>
    </label>
  );
}

/*
 * The locator hub behind the guide, in a 200-unit box centred on 0,0: static range rings, crosshairs, bearings and three
 * topographic contours; a tick ring turning slowly one way and a dashed tracking ring with blips the other (CSS, see
 * .fmd-spin); a radar sweep; the pulse waves (.fmd-radar); and five data points pinging on the contours. All decorative,
 * all fixed geometry computed here, so server and browser markup match.
 */
const rd = (n: number) => Math.round(n * 100) / 100;
const TICKS = Array.from({ length: 72 }, (_, k) => {
  const a = (k * 5 * Math.PI) / 180;
  const r0 = k % 6 ? 85 : 81;
  return { x1: rd(r0 * Math.cos(a)), y1: rd(r0 * Math.sin(a)), x2: rd(88 * Math.cos(a)), y2: rd(88 * Math.sin(a)), major: k % 6 === 0 };
});
const CONTOUR = "M-62,-18C-50,-48 -8,-60 22,-50C52,-40 70,-12 60,14C50,40 14,58 -18,52C-50,46 -74,12 -62,-18Z";
const BLIPS = [0, 128, 236].map((deg) => ({ x: rd(60 * Math.cos((deg * Math.PI) / 180)), y: rd(60 * Math.sin((deg * Math.PI) / 180)) }));
const DATA_POINTS = [
  { x: -40, y: -22, d: 0 },
  { x: 34, y: -36, d: 0.9 },
  { x: 52, y: 20, d: 1.8 },
  { x: -24, y: 40, d: 2.7 },
  { x: 8, y: 6, d: 3.6 },
];
const BEARINGS: [string, number, number][] = [
  ["000", 0, -91],
  ["090", 92, 2],
  ["180", 0, 95],
  ["270", -92, 2],
];

function LocatorHub() {
  return (
    <div className="absolute left-1/2 top-[44%] size-[300px] -translate-x-1/2 -translate-y-1/2 lg:size-[360px]">
      <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.28),transparent)]" />
      {/* the sweep: a soft wedge of light turning round the hub */}
      <div className="fmd-sweep absolute inset-[6%] rounded-full bg-[conic-gradient(from_0deg,rgb(59_130_246/0.3),rgb(59_130_246/0.06)_50deg,transparent_70deg)] [mask-image:radial-gradient(closest-side,#000_96%,transparent)]" />
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full" fill="none">
        {[96, 72, 48, 24].map((rr, i) => (
          <circle key={rr} r={rr} stroke="#93c5fd" strokeOpacity={i === 0 ? 0.14 : 0.1 + i * 0.03} strokeWidth={0.4} />
        ))}
        <path d="M-96 0H96M0 -96V96" stroke="#93c5fd" strokeOpacity={0.08} strokeWidth={0.4} />
        {[1, 0.7, 0.42].map((s, i) => (
          <path key={s} d={CONTOUR} transform={`translate(${i * 4} ${i * -3}) scale(${s})`} stroke="#60a5fa" strokeOpacity={0.16} strokeWidth={0.5 / s} />
        ))}
        {BEARINGS.map(([l, x, y]) => (
          <text key={l} x={x} y={y} textAnchor="middle" fontSize={5.5} fill="#93c5fd" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
            {l}
          </text>
        ))}
      </svg>
      <div className="fmd-spin absolute inset-0">
        <svg viewBox="-100 -100 200 200" className="size-full" fill="none">
          {TICKS.map((k, i) => (
            <line key={i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} stroke="#93c5fd" strokeOpacity={k.major ? 0.45 : 0.18} strokeWidth={k.major ? 0.7 : 0.4} />
          ))}
        </svg>
      </div>
      <div className="fmd-spin-rev absolute inset-0">
        <svg viewBox="-100 -100 200 200" className="size-full" fill="none">
          <circle r={60} stroke="#60a5fa" strokeOpacity={0.35} strokeWidth={0.6} strokeDasharray="2 5" />
          {BLIPS.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r={1.6} fill="#bfdbfe" />
          ))}
        </svg>
      </div>
      {[0, 1, 2].map((k) => (
        <span key={k} className="fmd-radar absolute inset-0 rounded-full border border-blue-400/40" style={{ animationDelay: `${k * 1.4}s` }} />
      ))}
      {DATA_POINTS.map((p, i) => (
        <span
          key={i}
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgb(103_232_249/0.6)]"
          style={{ left: `${(p.x + 100) / 2}%`, top: `${(p.y + 100) / 2}%` }}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/70" style={{ animationDelay: `${p.d}s`, animationDuration: "2.6s" }} />
        </span>
      ))}
    </div>
  );
}

// Cards mount on the client after the fetch, so reading the preference here is safe (no server-rendered state to match).
// Cyber-glass card: photo in a circular lit frame, verification as a corner chip (the shared badge itself, so its wording
// never changes; holographic rim only when verified), services as dark-glass capsules, a small glowing availability light.
// Every piece of text is the record's own value, unaltered.
function DentistCard({ d, onOpen }: { d: ProviderCard; onOpen: () => void }) {
  const reduced = useReducedMotion();
  const verified = d.verification.status === "verified";
  return (
    <motion.article
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="group relative isolate flex w-[300px] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_24px_48px_-30px_rgb(0_0_0/0.85)] backdrop-blur-xl transition-[border-color] duration-300 hover:border-white/20 sm:w-auto"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        {/* the photo (or initials) in a circular frame, lit from behind */}
        <div className="relative shrink-0">
          <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.45),rgb(59_130_246/0.12)_60%,transparent)]" />
          <div className="rounded-full bg-[conic-gradient(from_210deg,rgb(96_165_250/0.9),rgb(147_197_253/0.12),rgb(59_130_246/0.7),rgb(147_197_253/0.12),rgb(96_165_250/0.9))] p-[1.5px] shadow-[0_0_18px_rgb(59_130_246/0.3)]">
            <Avatar p={d} className="size-[76px] rounded-full! border-0!" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 pt-0.5">
          <span className={`rounded-full p-px ${verified ? "fmd-holo shadow-[0_0_12px_rgb(103_232_249/0.25)]" : ""}`}>
            <span className="block rounded-full bg-[#0b1224]/90">
              <Verification v={d.verification} />
            </span>
          </span>
          {d.sponsored && <SponsoredBadge />}
        </div>
      </div>

      <h3 className="mt-4 truncate text-[16px] font-medium tracking-[-0.01em] text-ink">{d.name}</h3>
      <p className="mt-0.5 text-[12.5px] text-ink-3">
        {d.specialty}
        {d.experienceYears ? ` · ${d.experienceYears} yrs` : ""}
      </p>
      {d.clinic && (
        <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-ink-4">
          <MapPin className="size-3 shrink-0" strokeWidth={1.5} />
          {d.clinic.area}, {d.clinic.city}
        </p>
      )}

      {/* fixed capsule band, so cards line up whatever their service count */}
      <div className="mt-4 flex h-[22px] flex-wrap gap-1.5 overflow-hidden">
        {d.services
          .filter((s) => s !== "Consultation")
          .slice(0, 3)
          .map((s) => (
            <span key={s} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-[3px] text-xs leading-none text-ink-2">
              {s}
            </span>
          ))}
      </div>

      <p className="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-4 text-[12.5px] text-ink-3 [margin-top:max(1rem,auto)]">
        {/* availability light: a live slot pings; clinic-confirmed availability holds a steady clock */}
        <span aria-hidden className="relative grid size-6 shrink-0 place-items-center rounded-full bg-blue-500/10 shadow-[0_0_10px_rgb(59_130_246/0.3)] ring-1 ring-blue-400/30">
          {d.nextAvailable ? <CalendarClock className="size-3.5 text-blue-300" strokeWidth={1.5} /> : <Clock3 className="size-3.5 text-blue-300/80" strokeWidth={1.5} />}
          {d.nextAvailable && (
            <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-cyan-300">
              <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/70" />
            </span>
          )}
        </span>
        {/* one span, so the label and the time wrap together as a line rather than splitting into flex columns */}
        {d.nextAvailable ? (
          <span>
            Next available: <span className="text-ink-2">{fmtDay(d.nextAvailable)}, {fmtTime(d.nextAvailable)}</span>
          </span>
        ) : (
          <span>Availability confirmed by clinic</span>
        )}
      </p>
      <button
        onClick={onOpen}
        className="group/btn mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] text-[13px] font-medium text-white/80 backdrop-blur-md transition-[border-color,box-shadow,color] duration-300 hover:border-blue-400/60 hover:text-white hover:shadow-[0_0_0_1px_rgb(59_130_246/0.25),0_0_18px_rgb(59_130_246/0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--env-midnight)]"
      >
        View profile
        {/* momentum: the arrow overshoots slightly and settles */}
        <ArrowRight className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/btn:translate-x-1.5" strokeWidth={1.75} />
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
    <section id="dentists" className="relative isolate scroll-mt-24 pt-24 sm:pt-32">
      <Atmosphere scene="discovery" />
      <Container>
        {/* discovery band, straight on the page (no box): the brief on the left; on the right the guide holds the pin over the
            city you picked, on a pin-drop ripple, in front of a live locator (a dotted map grid and a slow radar pulse) */}
        <Reveal className="relative mb-8 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="relative max-w-2xl pb-1">
            <div className="mb-3.5 flex flex-wrap items-center gap-3">
              <p className="eyebrow">Discover</p>
              {/* live readout from the results themselves: the total, plus the verified count only when every result is on this page */}
              {res && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/25 bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-blue-200/90">
                  <span aria-hidden className="relative size-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgb(103_232_249/0.6)]">
                    <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/70" />
                  </span>
                  {res.total} {res.total === 1 ? "dentist" : "dentists"} in {city}
                  {res.pages === 1 && ` · ${cards.filter((c) => c.verification.status === "verified").length} verified`}
                </span>
              )}
            </div>
            <h2 className="type-h2">{`Dentists in ${city}`}</h2>
            <p className="type-lede mt-4">Explore dental professionals by speciality, experience, and location to find the right care for your needs.</p>
          </div>
          {/* the guide and his locator hub, tilting gently toward the cursor as one (data-tilt, CursorFx: the children let the
              pointer through, so the whole hub is the target). 270px box (lg) → ~227px visible: the pin is the focal point */}
          <div aria-hidden data-tilt className="relative hidden h-[250px] md:block lg:h-[300px] [&>*]:pointer-events-none">
            {/* a dotted map grid fading out from the guide */}
            <div className="absolute -inset-x-10 -inset-y-6 bg-[radial-gradient(rgb(147_197_253/0.22)_1px,transparent_1.6px)] [background-size:16px_16px] [mask-image:radial-gradient(closest-side,#000_30%,transparent)]" />
            <LocatorHub />
            {[100, 72, 46].map((w, i) => (
              <span
                key={w}
                className="absolute bottom-[14px] left-1/2 -translate-x-1/2 translate-y-1/2 rounded-[50%] border border-[var(--fmd-border)]"
                style={{ width: `${w}%`, height: `${w * 0.22}%`, opacity: 0.5 + i * 0.25 }}
              />
            ))}
            <span className="absolute left-[6%] top-6 flex items-center gap-1.5 rounded-full border border-[var(--fmd-border)] bg-[var(--fmd-deep)] px-3 py-1.5 text-[12px] text-ink-2">
              <MapPin className="size-3.5 text-[rgb(var(--horizon-rgb))]" strokeWidth={1.6} /> {city}
            </span>
            <div className="absolute bottom-0 left-1/2 size-[230px] lg:size-[270px] -translate-x-1/2">
              <Image src="/img/mascots/mascot-pin-1024.webp" alt="" fill sizes="(min-width:1024px) 270px, 230px" className="object-contain object-bottom" />
            </div>
          </div>
        </Reveal>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-4">
            <SlidersHorizontal className="size-3.5" strokeWidth={1.5} /> Refine
          </span>
          {specialty && (
            <button onClick={() => setSpecialty(null)} className={`${PILL} ${PILL_ON} flex items-center gap-1.5 px-4 py-2 text-[12.5px] text-ink`}>
              {specialty} <X className="size-3" strokeWidth={2} />
              <span className="sr-only">Remove filter</span>
            </button>
          )}
          <Select label="Sort" value={sort} onChange={setSort} options={[["relevance", "Recommended"], ["experience", "Experience"], ["name", "Name"]]} />
          <Select label="Treatment" value={service} onChange={setService} options={[["", "Any"], ...SERVICES.map((s) => [s, s] as [string, string])]} />
          <Select label="Language" value={lang} onChange={setLang} options={[["", "Any"], ...LANGUAGES.map((l) => [l, l] as [string, string])]} />
          {res && (
            <span
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 backdrop-blur-xl"
              aria-live="polite"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgb(103_232_249/0.55)]" />
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
          <div className="fmd-surface rounded-[24px] p-10 text-center">
            <p className="type-h3">No matching dentists in {city} yet</p>
            <ul className="mx-auto mt-3 max-w-md space-y-1 text-[13.5px] text-ink-4">
              {res.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <a href="#concierge" className="btn-ghost mt-6 h-10 px-5 text-[13px]">
              Ask FMD Edge
            </a>
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

