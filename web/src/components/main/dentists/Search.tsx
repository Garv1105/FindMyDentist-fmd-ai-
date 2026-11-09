"use client";

import { CalendarClock, Clock3, Languages, LoaderCircle, LocateFixed, MapPin, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { Avatar, Verification } from "@/components/providers";
import { SponsoredBadge } from "@/components/ui";
import { LANGUAGES, SERVICES, SPECIALTIES } from "@/lib/catalog";
import { feeRange, when } from "@/lib/format";
import { PLACES, searchProviders, type Filters, type ProviderCard, type SearchResult } from "@/sample/providers";


/* ---------------- URL ⇄ filters (every filter lives in the URL, so results can be shared and Back works) ---------------- */

const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
function parse(p: URLSearchParams): Filters {
  const pick = <T extends string>(v: string | null, ok: readonly T[]) => (v && (ok as readonly string[]).includes(v) ? (v as T) : undefined);
  return {
    q: p.get("q") ?? undefined,
    loc: p.get("loc") ?? undefined,
    lat: num(p.get("lat")),
    lng: num(p.get("lng")),
    within: num(p.get("within")),
    specialty: p.get("specialty") ?? undefined,
    service: p.get("service") ?? undefined,
    language: p.get("language") ?? undefined,
    available: pick(p.get("available"), ["today", "week"]),
    fee_max: num(p.get("fee")),
    gender: pick(p.get("gender"), ["female", "male"]),
    sort: pick(p.get("sort"), ["relevance", "distance", "soonest"]),
  };
}

type Opt = [value: string, label: string];
const any = (label = "Any"): Opt => ["", label];
const FILTERS: { key: string; label: string; options: Opt[]; needsLocation?: boolean }[] = [
  { key: "specialty", label: "Specialty", options: [any(), ...SPECIALTIES.map((s): Opt => [s, s])] },
  { key: "service", label: "Treatment", options: [any(), ...SERVICES.map((s): Opt => [s, s])] },
  { key: "available", label: "Available", options: [any("Any time"), ["today", "Today"], ["week", "This week"]] },
  { key: "language", label: "Language", options: [any(), ...LANGUAGES.map((s): Opt => [s, s])] },
  { key: "fee", label: "Consultation fee", options: [any(), ["500", "Up to ₹500"], ["750", "Up to ₹750"], ["1000", "Up to ₹1,000"]] },
  { key: "gender", label: "Dentist", options: [any("Any dentist"), ["female", "Woman"], ["male", "Man"]] },
  { key: "within", label: "Distance", options: [any(), ["5", "Within 5 km"], ["10", "Within 10 km"], ["25", "Within 25 km"]], needsLocation: true },
  { key: "sort", label: "Sort by", options: [["", "Recommended"], ["distance", "Nearest"], ["soonest", "Earliest available"]] },
];

/** /dentists */
export function DentistSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const key = params.toString();
  const f = parse(params);
  const hasLocation = f.lat !== undefined && f.lng !== undefined;

  // the search boxes follow the URL (Back, shared links) and are applied on submit
  const [q, setQ] = useState(f.q ?? "");
  const [loc, setLoc] = useState(f.loc ?? "");
  const [seenKey, setSeenKey] = useState(key);
  if (key !== seenKey) {
    setSeenKey(key);
    setQ(f.q ?? "");
    setLoc(f.loc ?? "");
  }

  const [res, setRes] = useState<{ key: string; r: SearchResult; items: ProviderCard[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    searchProviders({ ...parse(new URLSearchParams(key)), page: 1 }).then(
      (r) => live && (setRes({ key, r, items: r.items }), setErr(null)),
      () => live && setErr("Search isn't working right now. Please try again."),
    );
    return () => {
      live = false;
    };
  }, [key]);

  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(p.size ? `/dentists?${p}` : "/dentists", { scroll: false });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const where = loc.trim();
    // typing a place replaces "near me"
    set({ q: q.trim() || null, loc: where || null, ...(where ? { lat: null, lng: null, within: null, sort: f.sort === "distance" ? null : (f.sort ?? null) } : {}) });
  };
  const locate = () => {
    setGeoErr(null);
    if (!navigator.geolocation) return setGeoErr("This browser can't share your location. Type your city or area instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // ~100 m is plenty for "near me" and keeps the URL from carrying an exact position
        set({ lat: pos.coords.latitude.toFixed(3), lng: pos.coords.longitude.toFixed(3), loc: null, sort: "distance" });
      },
      () => {
        setLocating(false);
        setGeoErr("Couldn't get your location. Type your city or area instead.");
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };
  const more = async () => {
    if (!res) return;
    const r = await searchProviders({ ...f, page: res.r.page + 1 });
    setRes({ ...res, r: { ...r, sponsored: res.r.sponsored }, items: [...res.items, ...r.items] });
  };

  const loading = !res || res.key !== key;
  const active = FILTERS.filter((x) => params.get(x.key) && x.key !== "sort");
  const where = f.loc ? ` in ${f.loc}` : hasLocation ? " near you" : "";

  const fields = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {FILTERS.map((x) => {
        const off = x.needsLocation && !hasLocation;
        return (
          <Field key={x.key} label={x.label} hint={off ? "Use your location first" : undefined}>
            <select className={fieldCls} value={params.get(x.key) ?? ""} disabled={off} onChange={(e) => set({ [x.key]: e.target.value || null })}>
              {x.options.map(([v, l]) => (
                <option key={v} value={v} disabled={v === "distance" && !hasLocation}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[24px] font-medium text-ink">Find a dentist</h1>
        <p className="mt-1 text-[14.5px] text-ink-3">Search by problem, treatment, dentist or clinic. Suggestions are based on what you search for; they are not a diagnosis.</p>
      </div>

      <Panel className="grid gap-3 p-4 sm:p-5">
        <form onSubmit={submit} role="search" className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Problem, treatment, dentist or clinic</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
            <input className={`${fieldCls} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. bleeding gums, braces, Dr. Iyer" maxLength={80} />
          </label>
          <label className="relative block">
            <span className="sr-only">City or area</span>
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
            <input
              className={`${fieldCls} pl-10`}
              list="fmd-places"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder={hasLocation ? "Near your location" : "City or area"}
              autoComplete="address-level2"
              maxLength={60}
            />
          </label>
          <datalist id="fmd-places">
            {PLACES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <Button variant="secondary" onClick={locate} disabled={locating}>
            {locating ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} /> : <LocateFixed className="size-4" strokeWidth={1.75} />}
            Use my location
          </Button>
          <Button type="submit">Search</Button>
        </form>
        {geoErr && <Notice kind="error">{geoErr}</Notice>}
        {hasLocation && (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            <LocateFixed className="size-3.5" strokeWidth={1.75} /> Showing dentists near your location.
            <button type="button" onClick={() => set({ lat: null, lng: null, within: null, sort: null })} className="font-medium text-ink underline underline-offset-4">
              Stop using it
            </button>
          </p>
        )}
      </Panel>

      <Panel className="hidden p-5 lg:block">{fields}</Panel>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setSheet(true)}>
          <SlidersHorizontal className="size-4" strokeWidth={1.75} /> Filters{active.length ? ` (${active.length})` : ""}
        </Button>
        {active.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => set({ [x.key]: null })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[var(--accent-soft)] px-3.5 text-[13px] text-ink"
          >
            {x.options.find(([v]) => v === params.get(x.key))?.[1] ?? params.get(x.key)}
            <X className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Remove filter</span>
          </button>
        ))}
        {(active.length > 0 || f.q || f.loc || hasLocation) && (
          <button type="button" onClick={() => router.replace("/dentists", { scroll: false })} className="px-2 text-[13px] text-ink-3 hover:text-ink">
            Clear all
          </button>
        )}
        <p aria-live="polite" className="ml-auto text-[13.5px] text-ink-3">
          {res && !loading ? `${res.r.total} ${res.r.total === 1 ? "dentist" : "dentists"}${where}` : "Searching…"}
        </p>
      </div>

      {err && <Notice kind="error">{err}</Notice>}

      {loading && !err ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="app-panel h-[260px] animate-pulse" />
          ))}
        </div>
      ) : res && res.r.total === 0 ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <h2 className="text-[17px] font-medium text-ink">No dentists match{where} yet</h2>
          <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-2">
            {res.r.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={() => router.replace("/dentists", { scroll: false })}>
              Clear filters
            </Button>
            <ButtonLink href="/#concierge" variant="secondary">
              Ask FMD Edge to help
            </ButtonLink>
          </div>
        </Panel>
      ) : (
        res && (
          <>
            {res.r.sponsored.length > 0 && (
              <section aria-label="Sponsored" className="grid gap-2">
                <p className="text-[12px] uppercase tracking-[0.14em] text-ink-3">Sponsored</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {res.r.sponsored.map((p) => (
                    <DentistCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            )}
            <section aria-label="Results" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {res.items.map((p) => (
                <DentistCard key={p.id} p={p} />
              ))}
            </section>
            <div className="flex flex-wrap items-center justify-center gap-3 text-[13.5px] text-ink-3">
              <span>
                Showing {res.items.length} of {res.r.total}
              </span>
              {res.items.length < res.r.total && (
                <Button variant="secondary" size="sm" onClick={more}>
                  Show more
                </Button>
              )}
            </div>
          </>
        )
      )}

      <p className="text-[12.5px] text-ink-3">
        Sponsored results are paid placements and are always labelled. Other results are ordered by how well they match your search and whether FMD has verified the
        dentist. All profiles here are demo profiles, not real practitioners.
      </p>

      {sheet && (
        <Sheet title="Filters" onClose={() => setSheet(false)}>
          <div className="grid gap-4">
            {fields}
            <Button onClick={() => setSheet(false)}>{res && !loading ? `Show ${res.r.total} ${res.r.total === 1 ? "dentist" : "dentists"}` : "Show results"}</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13.5px] text-ink-2">
      <span className="mt-0.5 shrink-0 text-ink-3">{icon}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function DentistCard({ p }: { p: ProviderCard }) {
  const extra = p.services.filter((s) => s !== "Consultation");
  return (
    <Panel as="section" className="flex flex-col gap-3.5 p-5">
      <div className="flex items-start gap-4">
        <Avatar p={p} className="size-16" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-medium text-ink">{p.name}</h2>
          <p className="text-[13.5px] text-ink-3">
            {p.specialty}
            {p.experienceYears ? ` · ${p.experienceYears} yrs experience` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Verification v={p.verification} />
            {p.sponsored && <SponsoredBadge />}
            <Tag tone="muted">Demo</Tag>
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Line icon={<MapPin className="size-3.5" strokeWidth={1.75} />}>
          {p.clinic.name} · {p.clinic.area}, {p.clinic.city}
          {p.distanceKm !== null && <span className="text-ink-3"> · {p.distanceKm} km away</span>}
        </Line>
        <Line icon={<Languages className="size-3.5" strokeWidth={1.75} />}>{p.languages.join(", ")}</Line>
      </div>
      {extra.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {extra.slice(0, 3).map((s) => (
            <Tag key={s} tone="muted">
              {s}
            </Tag>
          ))}
          {extra.length > 3 && <Tag tone="muted">+{extra.length - 3} more</Tag>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3.5">
        <div className="grid gap-0.5 text-[13px]">
          <p className="text-ink-2">
            {p.fee ? feeRange(p.fee) : "Fee confirmed by the clinic"}
            {p.fee && <span className="text-ink-3"> consultation</span>}
          </p>
          <p className="flex items-center gap-1.5 text-ink-3">
            {p.nextAvailable ? (
              <>
                <CalendarClock className="size-3.5" strokeWidth={1.75} /> Next: {when(p.nextAvailable)}
              </>
            ) : (
              <>
                <Clock3 className="size-3.5" strokeWidth={1.75} /> Clinic will confirm a time
              </>
            )}
          </p>
        </div>
        <ButtonLink href={`/dentists/${p.id}`} size="sm" variant="secondary" aria-label={`View profile: ${p.name}`}>
          View profile
        </ButtonLink>
      </div>
    </Panel>
  );
}
