"use client";

import { ArrowLeft, CalendarPlus, CircleCheck, Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { Avatar, Verification } from "@/components/providers";
import { dayLabel, feeRange, istDate, longDay, noonOf, timeLabel, when } from "@/lib/format";
import { useMe } from "@/lib/me";
import { bookedTimes, BookingError, createBooking, ics, TYPES, type Booking, type TypeKey } from "@/sample/bookings";
import { CANCEL_TERMS, getAvailability, getProvider, PARTS, type Availability, type Part, type ProviderProfile, type Window } from "@/sample/providers";
import { track } from "@/lib/analytics";

export const windowLabel = (w: Window) => `${dayLabel(noonOf(w.date))} · ${PARTS[w.part].label}`;

/** Download a calendar file for a confirmed appointment. */
export function addToCalendar(b: Booking) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics(b)], { type: "text/calendar" }));
  a.download = `fmd-appointment-${b.ref}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- time picker (booking and rescheduling) ---------------- */

const chip = (on: boolean) =>
  `inline-flex h-10 items-center justify-center rounded-full border px-3.5 text-[14px] transition-colors ${
    on ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
  }`;

export function TimePicker({ avail, start, window, onPick }: { avail: Availability; start: number | null; window: Window | null; onPick: (v: { start: number | null; window: Window | null }) => void }) {
  const days = avail.mode === "live" ? [...new Set(avail.slots.map(istDate))] : [...new Set(avail.windows.map((w) => w.date))];
  const [day, setDay] = useState(start ? istDate(start) : (window?.date ?? days[0]));
  if (!days.length) return <Notice kind="info">No open times in the next week. Check back soon, or ask FMD Edge to help.</Notice>;
  return (
    <div className="grid gap-3">
      <div role="group" aria-label="Day" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {days.map((d) => (
          <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)} className={`${chip(d === day)} shrink-0`}>
            {dayLabel(noonOf(d))}
          </button>
        ))}
      </div>
      {avail.mode === "live" ? (
        <div role="group" aria-label={`Times on ${longDay(noonOf(day))}`} className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {avail.slots
            .filter((t) => istDate(t) === day)
            .map((t) => (
              <button key={t} type="button" aria-pressed={t === start} onClick={() => onPick({ start: t, window: null })} className={chip(t === start)}>
                {timeLabel(t)}
              </button>
            ))}
        </div>
      ) : (
        <div role="group" aria-label={`Part of the day on ${longDay(noonOf(day))}`} className="grid gap-1.5 sm:grid-cols-3">
          {avail.windows
            .filter((w) => w.date === day)
            .map((w) => {
              const on = window?.date === w.date && window.part === w.part;
              return (
                <button key={w.part} type="button" aria-pressed={on} onClick={() => onPick({ start: null, window: w })} className={chip(on)}>
                  {PARTS[w.part as Part].label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

/* ---------------- /book/[dentistId] ---------------- */

type Draft = { type: TypeKey; start: number | null; window: Window | null; other: boolean; name: string; age: string; notes: string; key: string };
const draftKey = (id: string) => `fmd-booking-draft:${id}`;

/** Back from logging in (?resume=1): the choices saved before leaving. The page shows a skeleton until its data loads,
 *  so reading this during the first render can't cause a hydration mismatch. */
function savedDraft(id: string, resume: string | null): Draft | null {
  if (!resume || typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(draftKey(id));
    return v ? (JSON.parse(v) as Draft) : null;
  } catch {
    return null;
  }
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Panel as="section" className="grid gap-3 p-5 sm:p-6">
      <h2 className="text-[16px] font-medium text-ink">
        <span className="mr-2 text-ink-3">{n}.</span>
        {title}
      </h2>
      {children}
    </Panel>
  );
}

export function BookPage() {
  const { dentistId } = useParams<{ dentistId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const [p, setP] = useState<ProviderProfile | null | undefined>(undefined);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [resumed] = useState(() => savedDraft(dentistId, params.get("resume")));
  const [step, setStep] = useState<"choose" | "review" | "done">(resumed ? "review" : "choose");
  const [f, setF] = useState<Draft>(resumed ?? { type: "consultation", start: Number(params.get("slot")) || null, window: null, other: false, name: "", age: "", notes: "", key: "" });
  const [err, setErr] = useState<{ msg: string; bookingId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);

  useEffect(() => {
    getProvider(dentistId).then(setP);
  }, [dentistId]);
  // open times, minus the ones this person already holds; waits until we know who is signed in
  const userId = me === undefined ? undefined : (me?.id ?? null);
  const loadTimes = useCallback(() => {
    if (userId === undefined) return;
    (userId ? bookedTimes(userId) : Promise.resolve(undefined)).then((booked) => getAvailability(dentistId, booked)).then(setAvail);
  }, [dentistId, userId]);
  useEffect(loadTimes, [loadTimes]);

  if (p === undefined || !avail) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (p === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that dentist</h1>
        <ButtonLink href="/dentists" variant="secondary">
          Find a dentist
        </ButtonLink>
      </Panel>
    );

  const set = (patch: Partial<Draft>) => (setErr(null), setF((x) => ({ ...x, ...patch })));
  // a slot from the profile page that's no longer open isn't kept
  const start = f.start && avail.mode === "live" && avail.slots.includes(f.start) ? f.start : null;
  const age = f.age.trim() === "" ? null : Number(f.age);
  const problem =
    !start && !f.window
      ? avail.mode === "live"
        ? "Choose a time."
        : "Choose a day and part of the day."
      : f.other && !f.name.trim()
        ? "Enter the name of the person the appointment is for."
        : f.other && age !== null && !(Number.isInteger(age) && age >= 0 && age <= 120)
          ? "Enter an age from 0 to 120, or leave it empty."
          : null;

  const review = () => {
    if (problem) return setErr({ msg: problem });
    set({ start, key: f.key || crypto.randomUUID() }); // one key per booking, kept through retries
    setStep("review");
    scrollTo({ top: 0 });
  };
  const logInFirst = () => {
    try {
      sessionStorage.setItem(draftKey(dentistId), JSON.stringify(f));
    } catch {
      // nothing kept: they'll choose again after logging in
    }
    router.push(`/login?next=${encodeURIComponent(`/book/${dentistId}?resume=1`)}`);
  };
  const confirm = async () => {
    if (!me) return;
    setBusy(true);
    setErr(null);
    try {
      const b = await createBooking(
        me.id,
        { dentist_id: dentistId, type: f.type, start: f.start ?? undefined, window: f.window ?? undefined, for: f.other ? { name: f.name, age } : null, notes: f.notes || null },
        f.key,
      );
      try {
        sessionStorage.removeItem(draftKey(dentistId));
      } catch {
        // nothing to clear
      }
      track("booking_confirmed", { mode: f.start ? "live" : "request", for_someone_else: f.other });
      setDone(b);
      setStep("done");
      scrollTo({ top: 0 });
    } catch (e) {
      const x = e as BookingError;
      if (x.code === "slot_taken" || x.code === "not_open") {
        // nothing was booked: back to choosing, with fresh times
        setF((d) => ({ ...d, start: null, window: null }));
        setStep("choose");
        loadTimes();
      }
      setErr({ msg: x.message, bookingId: x.code === "duplicate" ? x.bookingId : undefined });
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <Panel className="flex flex-wrap items-center gap-4 p-5">
      <Avatar p={p} className="size-14" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium text-ink">{p.name}</p>
        <p className="text-[13.5px] text-ink-3">
          {p.specialty} · {p.clinicDetails.name}, {p.clinicDetails.area}
        </p>
      </div>
      {/* own line on phones, so the name and clinic keep the width */}
      <div className="flex basis-full flex-wrap gap-1.5 sm:basis-auto">
        <Verification v={p.verification} />
        <Tag tone="muted">Demo</Tag>
      </div>
    </Panel>
  );

  if (step === "done" && done)
    return (
      <div className="mx-auto grid w-full max-w-[640px] gap-5">
        <Panel className="grid justify-items-start gap-3 p-6">
          <CircleCheck className="size-8 text-[var(--tone-ok)]" strokeWidth={1.5} />
          <h1 className="text-[22px] font-medium text-ink">{done.status === "confirmed" ? "You're booked" : "Request sent"}</h1>
          <p className="text-[14.5px] text-ink-2">
            {done.status === "confirmed"
              ? `${TYPES[done.type].label} with ${done.dentist.name} on ${longDay(done.start!)} at ${timeLabel(done.start!)}, at ${done.clinic.name}.`
              : `You asked ${done.clinic.name} for ${windowLabel(done.window!)}. The clinic confirms an exact time, usually within a day, and we'll let you know.`}
          </p>
          <p className="text-[13.5px] text-ink-3">Booking reference {done.ref}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {done.status === "confirmed" && (
              <Button variant="secondary" onClick={() => addToCalendar(done)}>
                <CalendarPlus className="size-4" strokeWidth={1.75} /> Add to calendar
              </Button>
            )}
            <ButtonLink href={`/appointments/${done.id}`}>View appointment</ButtonLink>
          </div>
        </Panel>
      </div>
    );

  if (step === "review") {
    const rows: [string, ReactNode][] = [
      ["Dentist", `${p.name}, ${p.specialty}`],
      ["Clinic", `${p.clinicDetails.name}, ${p.clinicDetails.address}, ${p.clinicDetails.city}`],
      ["When", f.start ? `${longDay(f.start)}, ${timeLabel(f.start)} (India time)` : f.window ? `${windowLabel(f.window)}. The clinic confirms an exact time.` : ""],
      ["Appointment", `${TYPES[f.type].label}, about ${TYPES[f.type].minutes} minutes`],
      ["For", f.other ? `${f.name.trim()}${age !== null ? `, ${age}` : ""}` : `You${me ? ` (${me.full_name})` : ""}`],
      ["Fee", p.fee ? `${feeRange(p.fee)} consultation. Treatment costs are confirmed by the dentist.` : "The clinic confirms the fee."],
      ["Payment", "Pay at the clinic. Online payment comes later."],
      ["Cancelling", CANCEL_TERMS],
    ];
    if (f.notes.trim()) rows.splice(5, 0, ["Your note", f.notes.trim()]);
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-5">
        <button type="button" onClick={() => (setErr(null), setStep("choose"))} className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.5} /> Change details
        </button>
        <h1 className="text-[24px] font-medium text-ink">Check and confirm</h1>
        {err && (
          <Notice kind="error">
            {err.msg}{" "}
            {err.bookingId ? (
              <Link href={`/appointments/${err.bookingId}`} className="font-medium underline underline-offset-4">
                View your appointment
              </Link>
            ) : (
              <Link href={`/help/contact?topic=booking&about=${encodeURIComponent(`booking with ${p.name}`)}`} className="font-medium underline underline-offset-4">
                Get help
              </Link>
            )}
          </Notice>
        )}
        <Panel className="p-5 sm:p-6">
          <dl className="grid gap-3 text-[14.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-0.5 sm:grid-cols-[140px_1fr]">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        {me ? (
          <Button onClick={confirm} disabled={busy}>
            {busy ? "Booking…" : f.start ? "Confirm booking" : "Send request"}
          </Button>
        ) : (
          <>
            <p className="text-[14px] text-ink-2">Log in or create an account to confirm. We&apos;ll keep what you&apos;ve chosen.</p>
            <Button onClick={logInFirst}>Log in to confirm</Button>
          </>
        )}
        <p className="text-[12.5px] text-ink-3">Nothing is booked until you confirm. FMD AI never books for you.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <Link href={`/dentists/${p.id}`} className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> {p.name}
      </Link>
      <h1 className="text-[24px] font-medium text-ink">{avail.mode === "live" ? "Book an appointment" : "Request an appointment"}</h1>
      {header}
      {err && <Notice kind="error">{err.msg}</Notice>}

      <Section n={1} title="What is it for?">
        <div role="radiogroup" aria-label="Appointment type" className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(TYPES) as TypeKey[]).map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer flex-col rounded-2xl border p-3.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--accent)] ${
                f.type === t ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--accent-soft)]" : "border-line hover:border-line-strong"
              }`}
            >
              <input type="radio" name="type" className="sr-only" checked={f.type === t} onChange={() => set({ type: t })} />
              <span className="text-[14.5px] font-medium text-ink">{TYPES[t].label}</span>
              <span className="text-[13px] text-ink-3">
                {TYPES[t].text} · about {TYPES[t].minutes} min
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section n={2} title={avail.mode === "live" ? "Choose a time" : "When suits you?"}>
        <p className="flex items-start gap-2 text-[13.5px] text-ink-3">
          {avail.mode === "live" ? (
            <>
              <Clock3 className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} /> Open times from the clinic&apos;s calendar, in India time. You need to book at least 2 hours ahead.
            </>
          ) : (
            <>
              <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} /> This clinic hasn&apos;t connected its calendar. Pick a day and part of the day, and the clinic confirms an exact time.
            </>
          )}
        </p>
        <TimePicker avail={avail} start={start} window={f.window} onPick={(v) => set(v)} />
        {(start || f.window) && <p className="text-[14px] text-ink">Chosen: {start ? when(start) : windowLabel(f.window!)}</p>}
      </Section>

      <Section n={3} title="Who is it for?">
        <div role="radiogroup" aria-label="Who is it for?" className="flex flex-wrap gap-2">
          {[false, true].map((other) => (
            <label key={String(other)} className={`${chip(f.other === other)} cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--accent)]`}>
              <input type="radio" name="for" className="sr-only" checked={f.other === other} onChange={() => set({ other })} />
              {other ? "Someone else" : "Me"}
            </label>
          ))}
        </div>
        {f.other && (
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Their name">
              <input className={fieldCls} value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Age (optional)">
              <input className={fieldCls} type="number" inputMode="numeric" min={0} max={120} value={f.age} onChange={(e) => set({ age: e.target.value })} />
            </Field>
          </div>
        )}
      </Section>

      <Section n={4} title="Anything the dentist should know? (optional)">
        <Field label="Note for the clinic" hint={`Only what helps the clinic prepare. ${f.notes.length}/300`}>
          <textarea className={`${fieldCls} h-24 resize-y py-2.5`} value={f.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={300} placeholder="e.g. sensitivity on the lower left side for a week" />
        </Field>
      </Section>

      <Button onClick={review}>Review booking</Button>
    </div>
  );
}
