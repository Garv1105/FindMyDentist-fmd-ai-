/**
 * Booking and my appointments (plan parts 2.3 and 2.4, PDR §4.5, §15, §18): sample data until the backend has it.
 * Proposed API:
 *   POST /bookings   header Idempotency-Key; {dentist_id, type, start | window, for, notes} → Booking
 *                    409 {code: "slot_taken"} · 409 {code: "duplicate", booking_id} · 422 for times that aren't open
 *   GET  /me/bookings?scope=upcoming|past → Booking[]      GET /bookings/{id} → Booking
 *   POST /bookings/{id}/cancel                       header Idempotency-Key
 *   POST /bookings/{id}/reschedule {start | window}  header Idempotency-Key
 * The status always comes from the backend. Statuses: requested → confirmed → completed, or cancelled_by_patient,
 * cancelled_by_clinic, no_show. Every change is an event recording who made it. The same Idempotency-Key always
 * returns the same booking, so a double tap or a retry after a timeout never books twice.
 */
import { availability, getProvider, hash, PARTS, POLICY, requestWindows, type Window } from "./providers.ts";
import { read, write } from "./store.ts";

export const TYPES = {
  consultation: { label: "Consultation", minutes: 30, text: "First visit or a new problem" },
  cleaning: { label: "Teeth cleaning", minutes: 45, text: "Scaling and polishing" },
  followup: { label: "Follow-up visit", minutes: 20, text: "Check-up after earlier treatment" },
  treatment: { label: "Treatment visit", minutes: 60, text: "Treatment your dentist already advised" },
} as const;
export type TypeKey = keyof typeof TYPES;

export type Status = "requested" | "confirmed" | "completed" | "cancelled_by_patient" | "cancelled_by_clinic" | "no_show";
export type BookingEvent = { at: string; type: "requested" | "confirmed" | "rescheduled" | "cancelled" | "completed" | "no_show"; by: "you" | "clinic"; note?: string };

export type Booking = {
  id: string;
  ref: string;
  dentist: { id: string; name: string; specialty: string; photo: string };
  clinic: { id: string; name: string; area: string; city: string; address: string; mapUrl: string };
  type: TypeKey;
  /** epoch ms, once there is a time */
  start: number | null;
  /** the part of a day asked for, while a clinic without a connected calendar confirms a time */
  window: Window | null;
  /** null: the account holder */
  for: { name: string; age: number | null } | null;
  notes: string | null;
  fee: { min: number; max: number } | null;
  payment: "at_clinic";
  status: Status;
  events: BookingEvent[];
  created_at: string;
  key: string;
};

export type Input = { dentist_id: string; type: TypeKey; start?: number; window?: Window; for: Booking["for"]; notes: string | null };

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: "slot_taken" | "duplicate" | "not_open" | "not_allowed" | "not_found",
    readonly bookingId?: string,
  ) {
    super(message);
  }
}

/** a demo clinic without a calendar confirms a request this long after it's made */
export const CONFIRM_AFTER_MS = 20_000;
const ACTIVE: Status[] = ["requested", "confirmed"];
const iso = (t: number) => new Date(t).toISOString();
const key = (userId: string) => `fmd-demo:bookings:${userId}`;
const save = (userId: string, all: Booking[]) => write(key(userId), all);

/** someone else took this time a moment before (demo: about one time in ten) */
const contested = (dentistId: string, t: number) => hash(`${dentistId}:${t}:race`) % 10 === 0;
export const isUpcoming = (b: Booking, now = Date.now()) => ACTIVE.includes(b.status) && (b.start === null || b.start > now);
const windowStart = (w: Window) => Date.parse(`${w.date}T${String(PARTS[w.part].from).padStart(2, "0")}:00:00+05:30`);

async function base(dentistId: string) {
  const p = await getProvider(dentistId);
  if (!p) throw new BookingError("That dentist isn't on FMD.", "not_found");
  const c = p.clinicDetails;
  return {
    dentist: { id: p.id, name: p.name, specialty: p.specialty, photo: p.photo },
    clinic: { id: c.id, name: c.name, area: c.area, city: c.city, address: c.address, mapUrl: c.mapUrl },
    fee: p.fee,
  };
}

/** Moves demo bookings along as time passes: the clinic confirms requests, and past visits are completed. */
function advance(b: Booking, now: number): Booking {
  if (b.status === "requested" && b.window && now - Date.parse(b.events.at(-1)!.at) >= CONFIRM_AFTER_MS) {
    const start = windowStart(b.window) + 30 * 60_000;
    return { ...b, status: "confirmed", start, events: [...b.events, { at: iso(now), type: "confirmed", by: "clinic", note: "The clinic set a time in the part of the day you asked for." }] };
  }
  if (b.status === "confirmed" && b.start && b.start + 2 * 3_600_000 < now) {
    return { ...b, status: "completed", events: [...b.events, { at: iso(b.start + TYPES[b.type].minutes * 60_000), type: "completed", by: "clinic" }] };
  }
  return b;
}

/** A first visit to My appointments gets a short demo history: a past visit, one the clinic cancelled, one it moved. */
async function seed(now: number): Promise<Booking[]> {
  const day = 86_400_000;
  const at = (daysAgo: number, h: number, m = 0) => {
    const d = new Date(now - daysAgo * day + 5.5 * 3_600_000).toISOString().slice(0, 10);
    return Date.parse(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
  };
  const make = async (id: string, dentist: string, type: TypeKey, start: number, status: Status, events: BookingEvent[]): Promise<Booking> => ({
    id,
    ref: `FMD-${id.slice(-6).toUpperCase()}`,
    ...(await base(dentist)),
    type,
    start,
    window: null,
    for: null,
    notes: null,
    payment: "at_clinic",
    status,
    events,
    created_at: events[0].at,
    key: id,
  });
  const past = at(24, 11);
  const cancelled = at(9, 15);
  const moved = at(-3, 11, 30);
  return [
    await make("demo-past-01", "aditi-sharma", "consultation", past, "completed", [
      { at: iso(past - 5 * day), type: "requested", by: "you" },
      { at: iso(past - 5 * day), type: "confirmed", by: "clinic" },
      { at: iso(past + 30 * 60_000), type: "completed", by: "clinic" },
    ]),
    await make("demo-cncl-02", "meenakshi-pillai", "cleaning", cancelled, "cancelled_by_clinic", [
      { at: iso(cancelled - 4 * day), type: "requested", by: "you" },
      { at: iso(cancelled - 4 * day), type: "confirmed", by: "clinic" },
      { at: iso(cancelled - day), type: "cancelled", by: "clinic", note: "The dentist is unwell that day. Sorry: please book another time." },
    ]),
    await make("demo-move-03", "venkat-rao", "followup", moved, "confirmed", [
      { at: iso(now - 2 * day), type: "requested", by: "you" },
      { at: iso(now - 2 * day), type: "confirmed", by: "clinic" },
      { at: iso(now - 3_600_000), type: "rescheduled", by: "clinic", note: `Moved from 10:00 am to 11:30 am the same day: the dentist has a longer surgery first.` },
    ]),
  ];
}

export async function listBookings(userId: string, now = Date.now()): Promise<Booking[]> {
  const stored = read<Booking[]>(key(userId)) ?? (await seed(now));
  const all = stored.map((b) => advance(b, now));
  save(userId, all);
  return all;
}

export async function getBooking(userId: string, id: string, now = Date.now()) {
  return (await listBookings(userId, now)).find((b) => b.id === id) ?? null;
}

/** times this person already holds, so they're not offered again */
export async function bookedTimes(userId: string, now = Date.now()) {
  return new Set((await listBookings(userId, now)).filter((b) => isUpcoming(b, now) && b.start).map((b) => b.start!));
}

/** Checks a requested time against what's open now. Throws the error the backend would return. */
async function checkTime(userId: string, dentistId: string, when: { start?: number; window?: Window }, now: number) {
  const avail = availability(dentistId, now, await bookedTimes(userId, now));
  if (avail.mode === "live") {
    if (!when.start || !avail.slots.includes(when.start)) throw new BookingError("That time isn't open any more. Please pick another.", "not_open");
    if (contested(dentistId, when.start)) throw new BookingError("Someone booked that time a moment ago. Nothing was booked or charged: please pick another time.", "slot_taken");
    return { start: when.start, window: null };
  }
  const w = when.window;
  if (!w || !requestWindows(now).some((x) => x.date === w.date && x.part === w.part)) throw new BookingError("Choose a day and part of the day that's still open.", "not_open");
  return { start: null, window: w };
}

export async function createBooking(userId: string, input: Input, idempotencyKey: string, now = Date.now()): Promise<Booking> {
  const all = await listBookings(userId, now);
  const same = all.find((b) => b.key === idempotencyKey);
  if (same) return same; // a retry or a double tap: the same booking, never a second one
  const dup = all.find((b) => b.dentist.id === input.dentist_id && isUpcoming(b, now));
  if (dup) throw new BookingError("You already have an appointment with this dentist. View it, or change its time from there.", "duplicate", dup.id);
  if (input.for && (!input.for.name.trim() || (input.for.age !== null && (input.for.age < 0 || input.for.age > 120))))
    throw new BookingError("Enter the name, and an age from 0 to 120, of the person the appointment is for.", "not_allowed");
  const time = await checkTime(userId, input.dentist_id, input, now);
  const id = `bk-${hash(idempotencyKey).toString(36)}${now.toString(36).slice(-4)}`;
  const events: BookingEvent[] = [{ at: iso(now), type: "requested", by: "you" }];
  if (time.start) events.push({ at: iso(now), type: "confirmed", by: "clinic", note: "Booked straight into the clinic's calendar." });
  const b: Booking = {
    id,
    ref: `FMD-${hash(idempotencyKey).toString(36).slice(0, 6).toUpperCase()}`,
    ...(await base(input.dentist_id)),
    type: input.type,
    ...time,
    for: input.for ? { name: input.for.name.trim(), age: input.for.age } : null,
    notes: input.notes?.trim() || null,
    payment: "at_clinic",
    status: time.start ? "confirmed" : "requested",
    events,
    created_at: iso(now),
    key: idempotencyKey,
  };
  save(userId, [...all, b]);
  return b;
}

/** Free cancellation until POLICY.freeCancelHours before; after that the clinic may charge. */
export const lateToCancel = (b: Booking, now = Date.now()) => b.start !== null && b.start - now < POLICY.freeCancelHours * 3_600_000;

export async function cancelBooking(userId: string, id: string, now = Date.now()): Promise<Booking> {
  const all = await listBookings(userId, now);
  const b = all.find((x) => x.id === id);
  if (!b) throw new BookingError("We couldn't find that appointment.", "not_found");
  if (b.status === "cancelled_by_patient") return b; // already done: cancelling twice changes nothing
  if (!isUpcoming(b, now)) throw new BookingError("This appointment can't be cancelled any more.", "not_allowed");
  const done: Booking = { ...b, status: "cancelled_by_patient", events: [...b.events, { at: iso(now), type: "cancelled", by: "you" }] };
  save(userId, all.map((x) => (x.id === id ? done : x)));
  return done;
}

export async function rescheduleBooking(userId: string, id: string, when: { start?: number; window?: Window }, now = Date.now()): Promise<Booking> {
  const all = await listBookings(userId, now);
  const b = all.find((x) => x.id === id);
  if (!b) throw new BookingError("We couldn't find that appointment.", "not_found");
  if (!isUpcoming(b, now)) throw new BookingError("This appointment can't be changed any more.", "not_allowed");
  const time = await checkTime(userId, b.dentist.id, when, now);
  const moved: Booking = {
    ...b,
    ...time,
    status: time.start ? "confirmed" : "requested",
    events: [...b.events, { at: iso(now), type: "rescheduled", by: "you" }, ...(time.start ? [] : [{ at: iso(now), type: "requested" as const, by: "you" as const }])],
  };
  save(userId, all.map((x) => (x.id === id ? moved : x)));
  return moved;
}

/** A calendar file for a confirmed appointment (no health details in it, PDR §15). */
export function ics(b: Booking) {
  const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FindMyDentist//FMD Main//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@findmydentist`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(b.start!)}`,
    `DTEND:${stamp(b.start! + TYPES[b.type].minutes * 60_000)}`,
    `SUMMARY:Dental appointment with ${b.dentist.name}`,
    `LOCATION:${b.clinic.name}\\, ${b.clinic.address}`,
    `DESCRIPTION:Booking ${b.ref}. Manage it in FMD.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
