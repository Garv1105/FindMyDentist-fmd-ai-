"use client";

import { ArrowLeft, Bookmark, BookmarkCheck, Building2, CalendarClock, Clock3, ExternalLink, Languages, MapPin, PhoneOff } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { Avatar, Verification } from "@/components/providers";
import { SponsoredBadge } from "@/components/ui";
import { dayLabel, feeRange, istDate, noonOf, timeLabel } from "@/lib/format";
import type { Me } from "@/lib/fmd";
import { useMe } from "@/lib/me";
import { getAvailability, getClinicPage, getClaims, getProvider, submitClaim, type Availability, type Claim, type ClinicPage, type ProviderProfile } from "@/sample/providers";
import { getSaved, toggleSaved } from "@/sample/saved";
import { ReviewsSection } from "../trust/Trust";
import { DentistCard } from "./Search";

function Back() {
  return (
    <Link href="/dentists" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={1.5} /> Find a dentist
    </Link>
  );
}

function NotFound({ what }: { what: string }) {
  return (
    <Panel className="grid justify-items-start gap-3 p-6">
      <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that {what}</h1>
      <p className="text-[14.5px] text-ink-3">The link may be old, or the profile was removed.</p>
      <ButtonLink href="/dentists" variant="secondary">
        Find a dentist
      </ButtonLink>
    </Panel>
  );
}

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Panel as="section" className={`grid gap-3 p-5 sm:p-6 ${className}`}>
      <h2 className="text-[17px] font-medium text-ink">{title}</h2>
      {children}
    </Panel>
  );
}

/* ---------------- /dentists/[id] ---------------- */

export function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const [p, setP] = useState<ProviderProfile | null | undefined>(undefined);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [saved, setSaved] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [claiming, setClaiming] = useState(false);
  useEffect(() => {
    getProvider(id).then(setP);
    getAvailability(id).then(setAvail);
  }, [id]);
  const userId = me?.id;
  useEffect(() => {
    if (!userId) return;
    getSaved(userId, "dentist").then((l) => setSaved(l.includes(id)));
    getClaims(userId).then((l) => setClaim(l.find((c) => c.provider_id === id) ?? null));
  }, [userId, id]);

  if (p === undefined || !avail) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (p === null) return <NotFound what="dentist" />;

  const save = async () => {
    if (!me) return router.push(`/login?next=${encodeURIComponent(`/dentists/${id}`)}`);
    setSaved(await toggleSaved(me.id, "dentist", id));
  };
  const c = p.clinicDetails;

  return (
    <div className="grid gap-5">
      <Back />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <Panel className="grid gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar p={p} className="size-24" />
              <div className="min-w-0 flex-1">
                <h1 className="text-[22px] font-medium text-ink">{p.name}</h1>
                <p className="text-[14.5px] text-ink-3">
                  {p.specialty}
                  {p.experienceYears ? ` · ${p.experienceYears} years of experience` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Verification v={p.verification} />
                  {p.sponsored && <SponsoredBadge />}
                  <Tag tone="muted">Demo</Tag>
                </div>
                {/* say what was checked, not just "verified" (PDR §4.8) */}
                <p className="mt-1.5 text-[12.5px] text-ink-3">{p.verification.checks}</p>
                {p.sponsored && <p className="text-[12.5px] text-ink-3">Sponsored by {p.sponsored.sponsor}: a paid placement, not a clinical endorsement.</p>}
              </div>
            </div>
            <p className="flex items-center gap-2 text-[14px] text-ink-2">
              <Languages className="size-4 text-ink-3" strokeWidth={1.75} /> Consults in {p.languages.join(", ")}
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/book/${p.id}`}>{avail.mode === "live" ? "Book appointment" : "Request appointment"}</ButtonLink>
              <Button variant="secondary" onClick={save} aria-pressed={saved}>
                {saved ? <BookmarkCheck className="size-4" strokeWidth={1.75} /> : <Bookmark className="size-4" strokeWidth={1.75} />}
                {saved ? "Saved" : "Save"}
              </Button>
            </div>
            {!p.claimed && (
              <div className="rounded-2xl border border-line px-4 py-3 text-[14px] text-ink-2">
                Listed by FMD from public information; this dentist hasn&apos;t joined FMD yet.{" "}
                {claim ? (
                  <Tag tone="accent">Your claim is being reviewed</Tag>
                ) : (
                  <button type="button" onClick={() => setClaiming(true)} className="font-medium text-ink underline underline-offset-4">
                    Is this you? Claim this profile
                  </button>
                )}
              </div>
            )}
          </Panel>

          <Card title="About">
            <p className="text-[14.5px] text-ink-2">{p.bio}</p>
            <div>
              <p className="text-[13.5px] text-ink-3">Qualifications</p>
              <p className="text-[14.5px] text-ink">{p.qualifications.join(", ")}</p>
            </div>
          </Card>

          <ReviewsSection dentistId={p.id} />

          <Card title="Treatments and fees">
            <ul className="divide-y divide-[var(--border)] rounded-2xl border border-line text-[14px]">
              <li className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span className="text-ink">Consultation</span>
                <span className="text-ink-2">{p.fee ? feeRange(p.fee) : "Confirmed by the clinic"}</span>
              </li>
              {p.serviceFees.map((f) => (
                <li key={f.service} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                  <span className="text-ink">{f.service}</span>
                  <span className="text-ink-2">{feeRange(f)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-ink-3">Typical ranges (demo estimates), not quotes. Your dentist confirms the cost after examining you.</p>
          </Card>
        </div>

        <div className="grid gap-5 lg:sticky lg:top-24">
          <Card title={avail.mode === "live" ? "Next open times" : "Appointments"}>
            <Times p={p} avail={avail} />
          </Card>
          <Card title="Clinic">
            <div className="grid gap-2 text-[14px] text-ink-2">
              <Link href={`/clinics/${c.id}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
                <Building2 className="size-4 text-ink-3" strokeWidth={1.75} /> {c.name}
              </Link>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.75} /> {c.address}, {c.city}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 className="size-4 text-ink-3" strokeWidth={1.75} /> {c.hours}
              </p>
              <p className="flex items-center gap-2 text-ink-3">
                <PhoneOff className="size-4" strokeWidth={1.75} /> Demo clinic: no phone number
              </p>
            </div>
            {c.facilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.facilities.map((x) => (
                  <Tag key={x} tone="muted">
                    {x}
                  </Tag>
                ))}
              </div>
            )}
            <a href={c.mapUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[14px] font-medium text-ink hover:underline">
              Open in Google Maps <ExternalLink className="size-3.5" strokeWidth={1.75} />
            </a>
          </Card>
        </div>
      </div>

      {claiming && <ClaimSheet me={me ?? null} p={p} onClose={() => setClaiming(false)} onDone={(c) => (setClaim(c), setClaiming(false))} />}
    </div>
  );
}

/** A few open times to tap straight into booking, or how a clinic without a connected calendar works. */
function Times({ p, avail }: { p: ProviderProfile; avail: Availability }) {
  if (avail.mode === "request")
    return (
      <>
        <p className="text-[14px] text-ink-2">This clinic hasn&apos;t connected its calendar. Ask for a day and part of the day, and the clinic confirms an exact time, usually within a day.</p>
        <ButtonLink href={`/book/${p.id}`} variant="secondary">
          Request an appointment
        </ButtonLink>
      </>
    );
  if (!avail.slots.length) return <p className="text-[14px] text-ink-2">No open times this week. Check back soon, or ask FMD Edge to help.</p>;
  const days = [...new Set(avail.slots.map(istDate))].slice(0, 3);
  return (
    <>
      {days.map((d) => (
        <div key={d}>
          <p className="mb-1.5 text-[13px] text-ink-3">{dayLabel(noonOf(d))}</p>
          <div className="flex flex-wrap gap-1.5">
            {avail.slots
              .filter((t) => istDate(t) === d)
              .slice(0, 6)
              .map((t) => (
                <Link
                  key={t}
                  href={`/book/${p.id}?slot=${t}`}
                  className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13.5px] text-ink hover:border-[var(--accent)]"
                  aria-label={`Book ${dayLabel(t)} at ${timeLabel(t)}`}
                >
                  {timeLabel(t)}
                </Link>
              ))}
          </div>
        </div>
      ))}
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <CalendarClock className="size-3.5" strokeWidth={1.75} /> Live from the clinic&apos;s calendar (demo)
      </p>
      <ButtonLink href={`/book/${p.id}`} variant="secondary">
        See all times
      </ButtonLink>
    </>
  );
}

/* ---------------- claim a profile ---------------- */

function ClaimSheet({ me, p, onClose, onDone }: { me: Me | null; p: ProviderProfile; onClose: () => void; onDone: (c: Claim) => void }) {
  const reg = me?.dentist_profile;
  const [f, setF] = useState({ full_name: me?.full_name ?? "", council: reg?.council ?? "", registration_no: reg?.registration_no ?? "", confirm: false });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileId = useId();

  if (!me)
    return (
      <Sheet title="Claim this profile" onClose={onClose}>
        <div className="grid gap-4">
          <p className="text-[14.5px] text-ink-2">Log in or create an account first, so FMD knows who&apos;s asking.</p>
          <ButtonLink href={`/login?next=${encodeURIComponent(`/dentists/${p.id}`)}`}>Log in to claim</ButtonLink>
        </div>
      </Sheet>
    );

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onDone(await submitClaim(me.id, p.id, f, file));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Claim ${p.name}'s profile`} onClose={onClose}>
      <form onSubmit={send} className="grid gap-4">
        <p className="text-[14px] text-ink-2">FMD checks your registration before the profile becomes yours. Only FMD&apos;s verification team sees your certificate.</p>
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Your full name">
          <input className={fieldCls} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={200} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dental council">
            <input className={fieldCls} value={f.council} onChange={(e) => setF({ ...f, council: e.target.value })} maxLength={100} required />
          </Field>
          <Field label="Registration number">
            <input className={fieldCls} value={f.registration_no} onChange={(e) => setF({ ...f, registration_no: e.target.value })} maxLength={50} required />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={fileId}
            className="inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-[var(--button-secondary)] px-4 text-[13px] font-semibold text-ink hover:border-line-strong focus-within:border-[var(--accent)]"
          >
            {file ? "Replace certificate" : "Upload registration certificate"}
          </label>
          <input id={fileId} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && <span className="break-all text-[13.5px] text-ink-2">{file.name}</span>}
        </div>
        <label className="flex items-start gap-2.5 text-[14px] text-ink">
          <input type="checkbox" checked={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.checked })} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
          I am {p.name}, and the details I&apos;ve given are true.
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send claim"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- /clinics/[id] ---------------- */

export function ClinicView() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<ClinicPage | null | undefined>(undefined);
  useEffect(() => {
    getClinicPage(id).then(setC);
  }, [id]);
  if (c === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (c === null) return <NotFound what="clinic" />;
  return (
    <div className="grid gap-5">
      <Back />
      <Panel className="grid gap-3 p-5 sm:p-6">
        <h1 className="flex flex-wrap items-center gap-3 text-[22px] font-medium text-ink">
          {c.name} <Tag tone="muted">Demo</Tag>
        </h1>
        <div className="grid gap-1.5 text-[14px] text-ink-2">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.75} /> {c.address}, {c.city}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 className="size-4 text-ink-3" strokeWidth={1.75} /> {c.hours}
          </p>
          <p className="flex items-center gap-2">
            <CalendarClock className="size-4 text-ink-3" strokeWidth={1.75} />
            {c.live ? "Book online: this clinic's calendar is connected." : "This clinic confirms a time after you ask."}
          </p>
        </div>
        {c.facilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.facilities.map((x) => (
              <Tag key={x} tone="muted">
                {x}
              </Tag>
            ))}
          </div>
        )}
        <a href={c.mapUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[14px] font-medium text-ink hover:underline">
          Open in Google Maps <ExternalLink className="size-3.5" strokeWidth={1.75} />
        </a>
      </Panel>
      <section className="grid gap-3">
        <h2 className="text-[17px] font-medium text-ink">Dentists at this clinic</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {c.dentists.map((d) => (
            <DentistCard key={d.id} p={d} />
          ))}
        </div>
      </section>
      <Card title="Treatments offered">
        <div className="flex flex-wrap gap-1.5">
          {c.services.map((s) => (
            <Tag key={s} tone="muted">
              {s}
            </Tag>
          ))}
        </div>
      </Card>
    </div>
  );
}
