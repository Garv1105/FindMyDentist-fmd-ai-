"use client";

import { ArrowLeft, CalendarPlus, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Panel, Tag, type Tone } from "@/components/app/kit";
import { Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { feeRange, longDay, timeLabel, when } from "@/lib/format";
import { useRequireMe } from "@/lib/me";
import {
  bookedTimes,
  cancelBooking,
  getBooking,
  isUpcoming,
  lateToCancel,
  listBookings,
  rescheduleBooking,
  TYPES,
  type Booking,
  type BookingError,
  type BookingEvent,
  type Status,
} from "@/sample/bookings";
import { CANCEL_TERMS, getAvailability, POLICY, type Availability, type Window } from "@/sample/providers";
import { addToCalendar, TimePicker, windowLabel } from "../booking/Book";
import { FeedbackCard } from "../trust/Trust";

export const STATUS: Record<Status, { label: string; tone: Tone }> = {
  requested: { label: "Waiting for the clinic", tone: "accent" },
  confirmed: { label: "Confirmed", tone: "ok" },
  completed: { label: "Completed", tone: "muted" },
  cancelled_by_patient: { label: "Cancelled by you", tone: "muted" },
  cancelled_by_clinic: { label: "Cancelled by the clinic", tone: "bad" },
  no_show: { label: "Missed", tone: "warn" },
};

/** the latest change the clinic made, so it's never missed (PDR §4.5: provider-side changes) */
const clinicChange = (b: Booking) => {
  const last = b.events.at(-1);
  return last?.by === "clinic" && (last.type === "rescheduled" || last.type === "cancelled") ? last : null;
};
const sortKey = (b: Booking) => b.start ?? Date.parse(`${b.window?.date}T09:00:00+05:30`);
/** clinics confirm requests and visits finish over time; the demo checks again every few seconds */
const REFRESH_MS = 5000;

/* ---------------- /appointments ---------------- */

export function AppointmentsPage() {
  const me = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "past" ? "past" : "upcoming";
  // the time of each load travels with the list, so rendering stays pure
  const [data, setData] = useState<{ list: Booking[]; now: number } | null>(null);
  const userId = me?.id;
  useEffect(() => {
    if (!userId) return;
    const load = () => listBookings(userId).then((list) => setData({ list, now: Date.now() }));
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [userId]);
  if (!me || !data) return <div className="app-panel h-48 animate-pulse" aria-busy />;

  const { list, now } = data;
  const upcoming = list.filter((b) => isUpcoming(b, now)).sort((a, b) => sortKey(a) - sortKey(b));
  const past = list.filter((b) => !isUpcoming(b, now)).sort((a, b) => sortKey(b) - sortKey(a));
  const shown = tab === "past" ? past : upcoming;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
            My appointments <Tag tone="muted">Demo</Tag>
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-3">Your visits, their status, and every change you or the clinic made.</p>
        </div>
        <ButtonLink href="/dentists" variant="secondary" size="sm">
          Book another
        </ButtonLink>
      </div>
      <FeedbackCard me={me} />
      <div role="tablist" aria-label="Appointments" className="flex w-fit gap-1 rounded-full border border-line bg-[var(--surface-glass)] p-1">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => router.replace(t === "past" ? "/appointments?tab=past" : "/appointments", { scroll: false })}
            className={`h-9 rounded-full px-4 text-[13.5px] font-medium ${tab === t ? "bg-[var(--accent-soft)] text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            {t === "past" ? `Past (${past.length})` : `Upcoming (${upcoming.length})`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <p className="text-[15px] text-ink">{tab === "past" ? "No past appointments yet." : "No upcoming appointments."}</p>
          {tab === "upcoming" && <ButtonLink href="/dentists">Find a dentist</ButtonLink>}
        </Panel>
      ) : (
        <ul className="grid gap-3">
          {shown.map((b) => (
            <li key={b.id}>
              <Row b={b} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ b, now }: { b: Booking; now: number }) {
  const change = clinicChange(b);
  const d = b.start ? new Date(b.start) : null;
  return (
    <Link href={`/appointments/${b.id}`} className="app-panel flex items-center gap-4 p-4 transition-colors hover:border-line-strong sm:p-5">
      <span className="grid w-14 shrink-0 place-items-center rounded-2xl border border-line py-2 text-center">
        {d ? (
          <>
            <span className="text-[20px] font-medium leading-none text-ink">{d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</span>
            <span className="mt-1 text-[11.5px] uppercase tracking-wide text-ink-3">{d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span>
          </>
        ) : (
          <span className="text-[11.5px] text-ink-3">To be set</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          {TYPES[b.type].label} with {b.dentist.name}
        </span>
        <span className="block text-[13.5px] text-ink-3">
          {b.start ? timeLabel(b.start) : windowLabel(b.window!)} · {b.clinic.name}, {b.clinic.area}
        </span>
        {change && isUpcoming(b, now) && <span className="mt-1 block text-[13px] text-[var(--tone-warn)]">The clinic changed the time</span>}
      </span>
      <Tag tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Tag>
    </Link>
  );
}

/* ---------------- /appointments/[id] ---------------- */

const EVENT: Record<BookingEvent["type"], (by: BookingEvent["by"]) => string> = {
  requested: () => "You asked for this appointment",
  confirmed: () => "The clinic confirmed it",
  rescheduled: (by) => (by === "clinic" ? "The clinic changed the time" : "You changed the time"),
  cancelled: (by) => (by === "clinic" ? "The clinic cancelled it" : "You cancelled it"),
  completed: () => "Visit completed",
  no_show: () => "Marked as missed",
};

export function AppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const me = useRequireMe();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState<"move" | "cancel" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const userId = me?.id;
  const load = useCallback(() => {
    if (userId) getBooking(userId, id).then((x) => (setB(x), setNow(Date.now())));
  }, [userId, id]);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!me || b === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (b === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that appointment</h1>
        <ButtonLink href="/appointments" variant="secondary">
          My appointments
        </ButtonLink>
      </Panel>
    );

  const upcoming = isUpcoming(b, now);
  const change = clinicChange(b);
  const rows: [string, React.ReactNode][] = [
    ["When", b.start ? `${longDay(b.start)}, ${timeLabel(b.start)} (India time)` : `Waiting for the clinic to set a time: ${windowLabel(b.window!)}`],
    ["Appointment", `${TYPES[b.type].label}, about ${TYPES[b.type].minutes} minutes`],
    ["For", b.for ? `${b.for.name}${b.for.age !== null ? `, ${b.for.age}` : ""}` : "You"],
    [
      "Clinic",
      <>
        {b.clinic.name}, {b.clinic.address}, {b.clinic.city}
        <br />
        <a href={b.clinic.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
          Directions <ExternalLink className="size-3.5" strokeWidth={1.75} />
        </a>
        <span className="text-ink-3"> · Demo clinic: no phone number</span>
      </>,
    ],
    ["Fee", b.fee ? `${feeRange(b.fee)} consultation, paid at the clinic` : "The clinic confirms the fee. Pay at the clinic."],
    ["Reference", b.ref],
  ];
  if (b.notes) rows.splice(3, 0, ["Your note", b.notes]);

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-5">
      <Link href="/appointments" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> My appointments
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-medium text-ink">
          {TYPES[b.type].label} with {b.dentist.name}
        </h1>
        <Tag tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Tag>
      </div>
      {note && <Notice kind="success">{note}</Notice>}
      {change && (
        <Notice kind="info">
          {EVENT[change.type](change.by)} on {when(Date.parse(change.at))}
          {change.note && `: ${change.note}`}
        </Notice>
      )}

      <Panel className="grid gap-4 p-5 sm:p-6">
        <dl className="grid gap-3 text-[14.5px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-0.5 sm:grid-cols-[130px_1fr]">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {upcoming && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {b.start && (
              <Button variant="secondary" onClick={() => addToCalendar(b)}>
                <CalendarPlus className="size-4" strokeWidth={1.75} /> Add to calendar
              </Button>
            )}
            <Button variant="secondary" onClick={() => (setNote(null), setOpen("move"))}>
              Change time
            </Button>
            <Button variant="secondary" className="!text-[var(--tone-bad)]" onClick={() => (setNote(null), setOpen("cancel"))}>
              Cancel appointment
            </Button>
          </div>
        )}
        {!upcoming && (
          <div className="border-t border-line pt-4">
            <ButtonLink href={`/book/${b.dentist.id}`} variant="secondary">
              Book again with {b.dentist.name}
            </ButtonLink>
          </div>
        )}
      </Panel>

      {upcoming && (
        <p className="flex items-start gap-2 text-[13.5px] text-ink-3">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>
            We remind you before the visit, the way you chose in{" "}
            <Link href="/account/privacy" className="font-medium text-ink underline underline-offset-4">
              Privacy and data
            </Link>
            . Questions about the visit itself? Contact the clinic.
          </span>
        </p>
      )}

      {b.status === "completed" && <FeedbackCard me={me} bookingId={b.id} />}

      <Panel as="section" className="grid gap-3 p-5 sm:p-6">
        <h2 className="text-[17px] font-medium text-ink">History</h2>
        <ol className="grid gap-3 border-l border-line pl-4">
          {[...b.events].reverse().map((e, i) => (
            <li key={i} className="relative">
              <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border border-line bg-[var(--surface-elevated)]" />
              <p className="text-[14.5px] text-ink">{EVENT[e.type](e.by)}</p>
              <p className="text-[13px] text-ink-3">{when(Date.parse(e.at))}</p>
              {e.note && <p className="text-[13.5px] text-ink-2">{e.note}</p>}
            </li>
          ))}
        </ol>
      </Panel>

      {open === "move" && (
        <MoveSheet
          userId={me.id}
          b={b}
          onClose={() => setOpen(null)}
          onDone={(x) => (setB(x), setOpen(null), setNote(x.start ? `Moved to ${when(x.start)}.` : `Request changed to ${windowLabel(x.window!)}. The clinic confirms a time.`))}
        />
      )}
      {open === "cancel" && <CancelSheet userId={me.id} b={b} late={lateToCancel(b, now)} onClose={() => setOpen(null)} onDone={(x) => (setB(x), setOpen(null), setNote("Your appointment is cancelled."))} />}
    </div>
  );
}

function MoveSheet({ userId, b, onClose, onDone }: { userId: string; b: Booking; onClose: () => void; onDone: (b: Booking) => void }) {
  const [avail, setAvail] = useState<Availability | null>(null);
  const [pick, setPick] = useState<{ start: number | null; window: Window | null }>({ start: null, window: null });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadTimes = useCallback(() => {
    bookedTimes(userId)
      .then((booked) => getAvailability(b.dentist.id, booked))
      .then(setAvail);
  }, [userId, b.dentist.id]);
  useEffect(loadTimes, [loadTimes]);

  const move = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await rescheduleBooking(userId, b.id, { start: pick.start ?? undefined, window: pick.window ?? undefined }));
    } catch (e) {
      setErr((e as BookingError).message);
      setPick({ start: null, window: null });
      loadTimes();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Change the time" onClose={onClose} wide>
      <div className="grid gap-4">
        <p className="text-[14px] text-ink-2">Now: {b.start ? when(b.start) : windowLabel(b.window!)}. Your current time stays booked until you confirm a new one.</p>
        {err && <Notice kind="error">{err}</Notice>}
        {avail ? <TimePicker avail={avail} start={pick.start} window={pick.window} onPick={setPick} /> : <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-glass)]" />}
        {(pick.start || pick.window) && <p className="text-[14.5px] text-ink">New time: {pick.start ? when(pick.start) : windowLabel(pick.window!)}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Keep the current time
          </Button>
          <Button disabled={busy || (!pick.start && !pick.window)} onClick={move}>
            {busy ? "Changing…" : "Confirm new time"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function CancelSheet({ userId, b, late, onClose, onDone }: { userId: string; b: Booking; late: boolean; onClose: () => void; onDone: (b: Booking) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await cancelBooking(userId, b.id));
    } catch (e) {
      setErr((e as BookingError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Cancel this appointment?" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <p className="text-[14.5px] text-ink-2">
          {TYPES[b.type].label} with {b.dentist.name}, {b.start ? when(b.start) : windowLabel(b.window!)}.
        </p>
        <p className="text-[14px] text-ink-2">{CANCEL_TERMS}</p>
        {late && <Notice kind="info">It&apos;s less than {POLICY.freeCancelHours} hours to the visit, so the clinic may charge a late-cancellation fee.</Notice>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Keep appointment
          </Button>
          <Button disabled={busy} onClick={cancel}>
            {busy ? "Cancelling…" : "Cancel appointment"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
