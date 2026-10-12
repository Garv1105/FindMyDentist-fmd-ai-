import { randomBytes, randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import type { Auth } from "./auth.ts";
import { bad, forbidden, HttpError, notFound } from "./http.ts";
import { can } from "./clinic/workspace.ts";

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  requested: "Awaiting clinic confirmation",
  confirmed: "Confirmed by clinic",
  declined: "Declined by clinic",
  cancelled_by_patient: "Cancelled by you",
  cancelled_by_clinic: "Cancelled by clinic",
  rescheduled: "Rescheduled",
  completed: "Completed",
  no_show: "Missed",
};
const ACTIVE = ["requested", "confirmed"];

type Policy = { live_schedule: number; schedule_source: string; min_notice_minutes: number; cancellation_terms: string };
const DEFAULT_POLICY: Policy = {
  live_schedule: 0,
  schedule_source: "none",
  min_notice_minutes: 120,
  cancellation_terms: "Cancellation terms are set by the clinic and confirmed with you.",
};

function policyOf(clinicId: string): Policy {
  return (
    one<Policy>("SELECT live_schedule, schedule_source, min_notice_minutes, cancellation_terms FROM clinic_booking_policies WHERE clinic_id = ?", clinicId) ??
    DEFAULT_POLICY
  );
}

/** The clinic to book at: the one asked for (must be linked), else one with a live schedule, else the first listed. */
function primaryClinic(dentistId: string, clinicId?: string) {
  const c = one<{ clinic_id: string; fee_note: string; name: string }>(
    `SELECT dc.clinic_id, dc.fee_note, c.name FROM dentist_clinics dc JOIN clinics c ON c.id = dc.clinic_id
     LEFT JOIN clinic_booking_policies p ON p.clinic_id = dc.clinic_id
     WHERE dc.dentist_id = ? ${clinicId ? "AND dc.clinic_id = ?" : ""} ORDER BY COALESCE(p.live_schedule, 0) DESC, c.created_at LIMIT 1`,
    ...(clinicId ? [dentistId, clinicId] : [dentistId]),
  );
  if (!c) throw notFound(clinicId ? "This dentist doesn't practise at that clinic." : "This dentist has no clinic listed for booking.");
  return c;
}

/** Open slots only when the clinic's schedule is connected (MAIN-26). Otherwise the patient requests a time. */
export function availability(dentistId: string, now = Date.now(), clinicId?: string) {
  const c = primaryClinic(dentistId, clinicId);
  const p = policyOf(c.clinic_id);
  const base = {
    clinicId: c.clinic_id,
    clinicName: c.name,
    feeNote: c.fee_note || "Fee confirmed by the clinic",
    cancellationTerms: p.cancellation_terms,
    scheduleSource: p.schedule_source,
  };
  if (!p.live_schedule) return { ...base, live: false as const, slots: [] as { id: string; startsAt: number; endsAt: number }[] };
  const slots = all<{ id: string; starts_at: number; ends_at: number }>(
    `SELECT s.id, s.starts_at, s.ends_at FROM slots s
     WHERE s.dentist_id = ? AND s.clinic_id = ? AND s.starts_at > ?
       AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE b.slot_id = s.id AND b.status IN ('requested','confirmed'))
     ORDER BY s.starts_at LIMIT 40`,
    dentistId,
    c.clinic_id,
    now + p.min_notice_minutes * 60_000,
  );
  return { ...base, live: true as const, slots: slots.map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at })) };
}

/** Earliest open slot per dentist, for cards. Only for connected schedules. */
export function nextAvailableMap(dentistIds: string[], now = Date.now()) {
  const m = new Map<string, number>();
  if (!dentistIds.length) return m;
  const rows = all<{ dentist_id: string; t: number }>(
    `SELECT s.dentist_id, MIN(s.starts_at) AS t FROM slots s
     JOIN clinic_booking_policies p ON p.clinic_id = s.clinic_id AND p.live_schedule = 1
     WHERE s.dentist_id IN (${dentistIds.map(() => "?").join(",")}) AND s.starts_at > ? + p.min_notice_minutes * 60000
       AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE b.slot_id = s.id AND b.status IN ('requested','confirmed'))
     GROUP BY s.dentist_id`,
    ...dentistIds,
    now,
  );
  for (const r of rows) m.set(r.dentist_id, r.t);
  return m;
}

function newReference() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "BK-" + Array.from(randomBytes(6), (x) => A[x % A.length]).join("");
}

function event(bookingId: string, actorId: string | null, from: string | null, to: string, note = "") {
  run(
    "INSERT INTO booking_events (id, booking_id, at, actor_id, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    bookingId,
    Date.now(),
    actorId,
    from,
    to,
    note,
  );
}

type BookingRow = {
  id: string;
  reference: string;
  user_id: string;
  dentist_id: string;
  clinic_id: string;
  slot_id: string | null;
  starts_at: number | null;
  preferred_window: string;
  reason: string;
  fee_note: string;
  cancellation_terms: string;
  status: string;
  rescheduled_from: string | null;
  created_at: number;
  updated_at: number;
};

const byId = (id: string) => one<BookingRow>("SELECT * FROM booking_requests WHERE id = ?", id);

/**
 * Patient creates a booking request. The public AI never calls this (MAIN-14): it needs a signed-in
 * patient session and an explicit `confirmed: true` from the review screen.
 */
export function requestBooking(a: Auth, input: Record<string, unknown>, opts: { rescheduleOf?: string } = {}) {
  if (a.user.status !== "active") throw forbidden();
  if (input.confirmed !== true) throw bad("Please review the details and confirm the request.");
  const key = typeof input.idempotencyKey === "string" && /^[\w-]{8,64}$/.test(input.idempotencyKey) ? input.idempotencyKey : null;
  if (!key) throw bad("Missing request key. Please refresh and try again.");

  // same key again (double click, retry after a timeout) → the same booking, never a duplicate
  const existing = one<BookingRow>("SELECT * FROM booking_requests WHERE user_id = ? AND idempotency_key = ?", a.user.id, key);
  if (existing) return view(existing);

  const dentistId = typeof input.dentistId === "string" ? input.dentistId : "";
  if (!one("SELECT 1 FROM dentists WHERE id = ?", dentistId)) throw notFound("Dentist not found.");
  const avail = availability(dentistId, Date.now(), typeof input.clinicId === "string" && input.clinicId ? input.clinicId : undefined);
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
  const now = Date.now();

  let slot: { id: string; starts_at: number } | undefined;
  let preferred = "";
  if (avail.live) {
    const slotId = typeof input.slotId === "string" ? input.slotId : "";
    slot = one<{ id: string; starts_at: number }>("SELECT id, starts_at FROM slots WHERE id = ? AND dentist_id = ?", slotId, dentistId);
    if (!slot) throw bad("Choose an available time.");
    if (slot.starts_at < now + policyOf(avail.clinicId).min_notice_minutes * 60_000)
      throw new HttpError(409, "slot_unavailable", "That time is too soon or has passed. Please choose another.");
  } else {
    preferred = typeof input.preferredWindow === "string" ? input.preferredWindow.trim() : "";
    if (preferred.length < 3 || preferred.length > 120) throw bad("Tell the clinic when you'd prefer to come (for example, weekday mornings).");
  }

  return tx(() => {
    const dupParams: (string | number)[] = [a.user.id, dentistId, now];
    if (opts.rescheduleOf) dupParams.push(opts.rescheduleOf);
    const dup = one<{ reference: string }>(
      `SELECT reference FROM booking_requests WHERE user_id = ? AND dentist_id = ? AND status IN ('requested','confirmed')
       AND (starts_at IS NULL OR starts_at > ?) ${opts.rescheduleOf ? "AND id != ?" : ""}`,
      ...dupParams,
    );
    if (dup) throw new HttpError(409, "duplicate", `You already have an active request with this dentist (${dup.reference}). Reschedule or cancel it instead.`);

    const id = randomUUID();
    try {
      run(
        `INSERT INTO booking_requests (id, reference, user_id, dentist_id, clinic_id, slot_id, starts_at, preferred_window, reason, fee_note, cancellation_terms, status, rescheduled_from, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?)`,
        id,
        newReference(),
        a.user.id,
        dentistId,
        avail.clinicId,
        slot?.id ?? null,
        slot?.starts_at ?? null,
        preferred,
        reason,
        avail.feeNote,
        avail.cancellationTerms,
        opts.rescheduleOf ?? null,
        key,
        now,
        now,
      );
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new HttpError(409, "slot_taken", "Someone just requested that time. Please choose another.");
      throw e;
    }
    event(id, a.user.id, null, "requested");
    audit(a.user.id, "booking.requested", "booking", id, { dentistId, live: avail.live });
    return view(byId(id)!);
  });
}

function view(b: BookingRow) {
  const d = one<{ name: string; specialty: string; is_demo: number }>("SELECT name, specialty, is_demo FROM dentists WHERE id = ?", b.dentist_id)!;
  const c = one<{ name: string; area: string; phone: string }>("SELECT name, area, phone FROM clinics WHERE id = ?", b.clinic_id)!;
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    statusLabel: BOOKING_STATUS_LABEL[b.status],
    dentist: { id: b.dentist_id, name: d.name, specialty: d.specialty, demo: d.is_demo === 1 },
    clinic: { name: c.name, area: c.area, phone: c.phone },
    startsAt: b.starts_at,
    preferredWindow: b.preferred_window,
    reason: b.reason,
    feeNote: b.fee_note,
    cancellationTerms: b.cancellation_terms,
    canChange: ACTIVE.includes(b.status) && (b.starts_at === null || b.starts_at > Date.now()),
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}
export type BookingView = ReturnType<typeof view>;

export function myBookings(a: Auth) {
  return all<BookingRow>("SELECT * FROM booking_requests WHERE user_id = ? ORDER BY created_at DESC", a.user.id).map(view);
}

/** Own bookings only; another patient's booking is a 404 so its existence isn't revealed. */
function ownBooking(a: Auth, id: string) {
  const b = byId(id);
  if (!b || b.user_id !== a.user.id) throw notFound("Booking not found.");
  return b;
}

export function bookingHistory(a: Auth, id: string) {
  const b = ownBooking(a, id);
  return {
    booking: view(b),
    events: all<{ at: number; from_status: string | null; to_status: string; note: string }>(
      "SELECT at, from_status, to_status, note FROM booking_events WHERE booking_id = ? ORDER BY at",
      id,
    ),
  };
}

export function cancelBooking(a: Auth, id: string, reason: unknown) {
  return tx(() => {
    const b = ownBooking(a, id);
    if (!view(b).canChange) throw new HttpError(409, "not_cancellable", "This booking can no longer be cancelled here. Please contact the clinic.");
    run("UPDATE booking_requests SET status = 'cancelled_by_patient', updated_at = ? WHERE id = ?", Date.now(), id);
    releaseClinicAppointment(id, a.user.id, "Cancelled by the patient on FMD");
    event(id, a.user.id, b.status, "cancelled_by_patient", typeof reason === "string" ? reason.slice(0, 300) : "");
    audit(a.user.id, "booking.cancelled", "booking", id);
    return view(byId(id)!);
  });
}

/** Reschedule = a new request for the same dentist. The old one is released only if the new one succeeds (one transaction). */
export function rescheduleBooking(a: Auth, id: string, input: Record<string, unknown>) {
  return tx(() => {
    const b = ownBooking(a, id);
    if (!view(b).canChange) throw new HttpError(409, "not_reschedulable", "This booking can no longer be changed here. Please contact the clinic.");
    run("UPDATE booking_requests SET status = 'rescheduled', updated_at = ? WHERE id = ?", Date.now(), id); // frees the old slot
    releaseClinicAppointment(id, a.user.id, "Patient requested a new time on FMD");
    event(id, a.user.id, b.status, "rescheduled");
    return requestBooking(a, { ...input, dentistId: b.dentist_id }, { rescheduleOf: id });
  });
}

/** Keep the clinic calendar in step when the patient cancels or reschedules a confirmed visit. */
function releaseClinicAppointment(bookingId: string, actorId: string, note: string) {
  const ap = one<{ id: string; status: string }>("SELECT id, status FROM appointments WHERE booking_request_id = ? AND status IN ('booked','confirmed','checked_in')", bookingId);
  if (!ap) return;
  run("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?", Date.now(), ap.id);
  run("INSERT INTO appointment_events (id, appointment_id, actor_id, from_status, to_status, note, at) VALUES (?, ?, ?, ?, 'cancelled', ?, ?)", randomUUID(), ap.id, actorId, ap.status, note, Date.now());
}

/* ---------------- clinic side (used by Clinic OS) ---------------- */

const CLINIC_TRANSITIONS: Record<string, string[]> = {
  requested: ["confirmed", "declined"],
  confirmed: ["cancelled_by_clinic", "completed", "no_show"],
};

export function clinicUpdateBooking(a: Auth, id: string, to: string, note = "") {
  return tx(() => {
    const b = byId(id);
    if (!b) throw notFound("Booking not found.");
    // organisation scoping: staff of *this* clinic only (ROL-06, ROL-12)
    if (!can(a, b.clinic_id, "appointments.write")) throw forbidden();
    if (!(CLINIC_TRANSITIONS[b.status] ?? []).includes(to)) throw new HttpError(409, "invalid_transition", `Can't change a ${b.status} booking to ${to}.`);
    if ((to === "declined" || to === "cancelled_by_clinic") && note.trim().length < 3) throw bad("Tell the patient why.");
    run("UPDATE booking_requests SET status = ?, updated_at = ? WHERE id = ?", to, Date.now(), id);
    event(id, a.user.id, b.status, to, note);
    audit(a.user.id, `booking.${to}`, "booking", id);
    return view(byId(id)!);
  });
}
