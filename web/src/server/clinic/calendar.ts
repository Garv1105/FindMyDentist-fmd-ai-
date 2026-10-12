import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "../db.ts";
import type { Auth } from "../auth.ts";
import { bad, HttpError, notFound } from "../http.ts";
import { clinicUpdateBooking } from "../booking.ts";
import { requireActive, requireClinic } from "./workspace.ts";

/* ---------------- time (clinics operate in IST; no DST) ---------------- */

const IST = 5.5 * 3600_000;
export const istDayStart = (t: number) => Math.floor((t + IST) / 86400_000) * 86400_000 - IST;
const istWeekday = (t: number) => new Date(t + IST).getUTCDay();
const hhmmToMs = (s: string) => (Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))) * 60_000;

/* ---------------- appointments ---------------- */

type Appt = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  provider_dentist_id: string | null;
  chair_id: string | null;
  type_id: string | null;
  kind: "visit" | "block";
  starts_at: number;
  ends_at: number;
  status: "booked" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
  source: string;
  booking_request_id: string | null;
  note: string;
};
const ACTIVE = ["booked", "confirmed", "checked_in"];

const TRANSITIONS: Record<string, string[]> = {
  booked: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["completed", "cancelled"],
};

function event(apptId: string, actor: string, from: string | null, to: string, note = "") {
  run("INSERT INTO appointment_events (id, appointment_id, actor_id, from_status, to_status, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)", randomUUID(), apptId, actor, from, to, note, Date.now());
}

function withinHours(clinicId: string, start: number, end: number) {
  const day = istDayStart(start);
  if (istDayStart(end - 1) !== day) return false;
  const periods = all<{ opens: string; closes: string }>("SELECT opens, closes FROM clinic_hours WHERE clinic_id = ? AND weekday = ?", clinicId, istWeekday(start));
  return periods.some((p) => start >= day + hhmmToMs(p.opens) && end <= day + hhmmToMs(p.closes));
}

/**
 * Conflict rules (PRD §6.4): no overlap on the same chair or the same provider, counting the type's
 * buffer, active appointments, blocks, and FMD booking requests already holding that provider's time.
 */
function conflicts(clinicId: string, p: { start: number; end: number; chairId: string | null; providerId: string | null; ignoreId?: string; ignoreBookingId?: string }) {
  const params: (string | number)[] = [clinicId, p.end, p.start, p.ignoreId ?? ""];
  const who: string[] = [];
  if (p.chairId) {
    who.push("a.chair_id = ?");
    params.push(p.chairId);
  }
  if (p.providerId) {
    who.push("a.provider_dentist_id = ?");
    params.push(p.providerId);
  }
  const clash = who.length
    ? one<{ id: string }>(
        `SELECT a.id FROM appointments a LEFT JOIN appointment_types t ON t.id = a.type_id
         WHERE a.clinic_id = ? AND a.status IN ('booked','confirmed','checked_in')
           AND a.starts_at < ? AND (a.ends_at + COALESCE(t.buffer_min, 0) * 60000) > ? AND a.id != ?
           AND (${who.join(" OR ")})`,
        ...params,
      )
    : undefined;
  if (clash) return "That time overlaps another appointment or block for the same chair or provider.";
  if (p.providerId) {
    const held = one(
      `SELECT 1 FROM booking_requests b WHERE b.clinic_id = ? AND b.dentist_id = ? AND b.status = 'requested' AND b.starts_at IS NOT NULL
         AND b.starts_at < ? AND b.starts_at + 30 * 60000 > ? AND b.id != ?
         AND NOT EXISTS (SELECT 1 FROM appointments x WHERE x.booking_request_id = b.id)`,
      clinicId, p.providerId, p.end, p.start, p.ignoreBookingId ?? "",
    );
    if (held) return "A patient has requested this time through FMD. Confirm or decline that request first.";
  }
  return null;
}

function view(a: Appt & { patient: string | null; type: string | null; provider: string | null; chair: string | null }) {
  return {
    id: a.id,
    kind: a.kind,
    patientId: a.patient_id,
    patient: a.patient,
    type: a.type,
    typeId: a.type_id,
    providerId: a.provider_dentist_id,
    provider: a.provider,
    chairId: a.chair_id,
    chair: a.chair,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    source: a.source,
    note: a.note,
    next: TRANSITIONS[a.status] ?? [],
  };
}
const SELECT = `SELECT a.*, p.full_name AS patient, t.name AS type, d.name AS provider, c.name AS chair FROM appointments a
  LEFT JOIN clinic_patients p ON p.id = a.patient_id LEFT JOIN appointment_types t ON t.id = a.type_id
  LEFT JOIN dentists d ON d.id = a.provider_dentist_id LEFT JOIN chairs c ON c.id = a.chair_id`;

export function calendar(a: Auth, clinicId: string, from: number, days: number) {
  requireClinic(a, clinicId, "appointments.read");
  const start = istDayStart(from);
  const end = start + Math.max(1, Math.min(31, days)) * 86400_000;
  const appts = all<Appt & { patient: string | null; type: string | null; provider: string | null; chair: string | null }>(
    `${SELECT} WHERE a.clinic_id = ? AND a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at`,
    clinicId, start, end,
  ).map(view);
  // FMD patient requests awaiting this clinic's decision
  const requests = all<{ id: string; reference: string; patient: string; dentist: string; dentist_id: string; starts_at: number | null; preferred_window: string; reason: string; created_at: number }>(
    `SELECT b.id, b.reference, u.name AS patient, d.name AS dentist, b.dentist_id, b.starts_at, b.preferred_window, b.reason, b.created_at
     FROM booking_requests b JOIN users u ON u.id = b.user_id JOIN dentists d ON d.id = b.dentist_id
     WHERE b.clinic_id = ? AND b.status = 'requested' ORDER BY b.created_at`,
    clinicId,
  );
  return { from: start, to: end, appointments: appts, fmdRequests: requests };
}

export function createAppointment(a: Auth, clinicId: string, input: Record<string, unknown>, opts: { source?: string; bookingRequestId?: string } = {}) {
  requireClinic(a, clinicId, "appointments.write");
  const kind = input.kind === "block" ? "block" : "visit";
  const start = Number(input.startsAt);
  if (!Number.isFinite(start)) throw bad("Choose a start time.");
  const chairId = typeof input.chairId === "string" && input.chairId ? input.chairId : null;
  const providerId = typeof input.providerId === "string" && input.providerId ? input.providerId : null;
  if (chairId && !one("SELECT 1 FROM chairs WHERE id = ? AND clinic_id = ?", chairId, clinicId)) throw bad("Unknown chair.");
  if (providerId && !one("SELECT 1 FROM dentist_clinics WHERE dentist_id = ? AND clinic_id = ?", providerId, clinicId)) throw bad("That dentist isn't linked to this clinic.");

  let end: number;
  let typeId: string | null = null;
  let patientId: string | null = null;
  if (kind === "visit") {
    typeId = typeof input.typeId === "string" ? input.typeId : null;
    const t = typeId ? one<{ duration_min: number }>("SELECT duration_min FROM appointment_types WHERE id = ? AND clinic_id = ? AND active = 1", typeId, clinicId) : undefined;
    if (!t) throw bad("Choose an appointment type.");
    patientId = typeof input.patientId === "string" ? input.patientId : null;
    if (!patientId || !one("SELECT 1 FROM clinic_patients WHERE id = ? AND clinic_id = ? AND merged_into IS NULL", patientId, clinicId)) throw bad("Choose a patient.");
    end = start + t.duration_min * 60_000;
    if (!withinHours(clinicId, start, end)) throw new HttpError(409, "outside_hours", "That time is outside the clinic's working hours.");
  } else {
    end = Number(input.endsAt);
    if (!Number.isFinite(end) || end <= start || end - start > 12 * 3600_000) throw bad("Blocks need an end time after the start (up to 12 hours).");
    if (!chairId && !providerId) throw bad("Block a chair or a provider.");
  }
  const clash = conflicts(clinicId, { start, end, chairId, providerId, ignoreBookingId: opts.bookingRequestId });
  if (clash) throw new HttpError(409, "conflict", clash);

  const id = randomUUID();
  const now = Date.now();
  tx(() => {
    run(
      `INSERT INTO appointments (id, clinic_id, patient_id, provider_dentist_id, chair_id, type_id, kind, starts_at, ends_at, status, source, booking_request_id, note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, clinicId, patientId, providerId, chairId, typeId, kind, start, end, opts.source === "fmd_booking" ? "confirmed" : "booked",
      opts.source ?? "clinic", opts.bookingRequestId ?? null, typeof input.note === "string" ? input.note.trim().slice(0, 300) : "", a.user.id, now, now,
    );
    event(id, a.user.id, null, opts.source === "fmd_booking" ? "confirmed" : "booked");
    // published slots that this appointment now covers are no longer bookable on FMD Main
    if (providerId) run("DELETE FROM slots WHERE dentist_id = ? AND clinic_id = ? AND starts_at < ? AND ends_at > ? AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE b.slot_id = slots.id)", providerId, clinicId, end, start);
    audit(a.user.id, `appointment.${kind}_created`, "appointment", id);
  });
  return id;
}

export function rescheduleAppointment(a: Auth, clinicId: string, id: string, startsAt: unknown) {
  requireClinic(a, clinicId, "appointments.write");
  const ap = one<Appt>("SELECT * FROM appointments WHERE id = ? AND clinic_id = ?", id, clinicId);
  if (!ap) throw notFound("Appointment not found.");
  if (!ACTIVE.includes(ap.status)) throw new HttpError(409, "not_active", "Only upcoming appointments can be moved.");
  const start = Number(startsAt);
  if (!Number.isFinite(start)) throw bad("Choose a new time.");
  const end = start + (ap.ends_at - ap.starts_at);
  if (ap.kind === "visit" && !withinHours(clinicId, start, end)) throw new HttpError(409, "outside_hours", "That time is outside working hours.");
  const clash = conflicts(clinicId, { start, end, chairId: ap.chair_id, providerId: ap.provider_dentist_id, ignoreId: id });
  if (clash) throw new HttpError(409, "conflict", clash);
  tx(() => {
    run("UPDATE appointments SET starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?", start, end, Date.now(), id);
    if (ap.booking_request_id) run("UPDATE booking_requests SET starts_at = ?, updated_at = ? WHERE id = ?", start, Date.now(), ap.booking_request_id);
    event(id, a.user.id, ap.status, ap.status, `Moved to ${new Date(start).toISOString()}`);
    audit(a.user.id, "appointment.rescheduled", "appointment", id);
  });
}

/** Status change with timestamped history; FMD-linked visits are mirrored so the patient sees it. */
export function setAppointmentStatus(a: Auth, clinicId: string, id: string, to: string, note = "") {
  requireClinic(a, clinicId, "appointments.write");
  return tx(() => {
    const ap = one<Appt>("SELECT * FROM appointments WHERE id = ? AND clinic_id = ?", id, clinicId);
    if (!ap) throw notFound("Appointment not found.");
    if (!(TRANSITIONS[ap.status] ?? []).includes(to)) throw new HttpError(409, "invalid_transition", `Can't change a ${ap.status} appointment to ${to}.`);
    if (to === "cancelled" && note.trim().length < 3) throw bad("Add a cancellation reason.");
    run("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?", to, Date.now(), id);
    event(id, a.user.id, ap.status, to, note);
    if (to === "completed" && ap.patient_id) run("UPDATE clinic_patients SET last_visit_at = ? WHERE id = ?", ap.starts_at, ap.patient_id);
    if (ap.booking_request_id) {
      const mirror = to === "completed" ? "completed" : to === "no_show" ? "no_show" : to === "cancelled" ? "cancelled_by_clinic" : null;
      const b = one<{ status: string }>("SELECT status FROM booking_requests WHERE id = ?", ap.booking_request_id);
      if (mirror && b?.status === "confirmed") clinicUpdateBooking(a, ap.booking_request_id, mirror, note || "Updated by the clinic");
    }
    audit(a.user.id, `appointment.${to}`, "appointment", id);
  });
}

export function appointmentHistory(a: Auth, clinicId: string, id: string) {
  requireClinic(a, clinicId, "appointments.read");
  if (!one("SELECT 1 FROM appointments WHERE id = ? AND clinic_id = ?", id, clinicId)) throw notFound("Appointment not found.");
  return all("SELECT e.from_status, e.to_status, e.note, e.at, u.name AS actor FROM appointment_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.appointment_id = ? ORDER BY e.at", id);
}

/* ---------------- FMD booking requests (Main → Clinic OS) ---------------- */

/** Find the clinic's patient record for an FMD user, or create one linked to that user. */
function patientForUser(a: Auth, clinicId: string, userId: string) {
  const existing = one<{ id: string }>("SELECT id FROM clinic_patients WHERE clinic_id = ? AND user_id = ? AND merged_into IS NULL", clinicId, userId);
  if (existing) return existing.id;
  const u = one<{ name: string; email: string | null; phone: string | null }>("SELECT name, email, phone FROM users WHERE id = ?", userId)!;
  const id = randomUUID();
  run(
    "INSERT INTO clinic_patients (id, clinic_id, user_id, full_name, phone, email, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, clinicId, userId, u.name, u.phone ?? "", u.email ?? "", a.user.id, Date.now(), Date.now(),
  );
  return id;
}

export function confirmFmdRequest(a: Auth, clinicId: string, bookingId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "appointments.write");
  return tx(() => {
    const b = one<{ id: string; clinic_id: string; user_id: string; dentist_id: string; starts_at: number | null; status: string }>("SELECT * FROM booking_requests WHERE id = ?", bookingId);
    if (!b || b.clinic_id !== clinicId) throw notFound("Request not found.");
    if (b.status !== "requested") throw new HttpError(409, "decided", "This request has already been handled.");
    const start = b.starts_at ?? Number(input.startsAt);
    if (!Number.isFinite(start)) throw bad("Choose the time you're offering the patient.");
    const patientId = patientForUser(a, clinicId, b.user_id);
    run("UPDATE booking_requests SET starts_at = ? WHERE id = ?", start, bookingId);
    const apptId = createAppointment(
      a,
      clinicId,
      { kind: "visit", patientId, typeId: input.typeId, providerId: b.dentist_id, chairId: input.chairId, startsAt: start, note: "Requested via FMD" },
      { source: "fmd_booking", bookingRequestId: bookingId },
    );
    clinicUpdateBooking(a, bookingId, "confirmed", b.starts_at ? "" : "Time proposed by the clinic");
    return { appointmentId: apptId, patientId };
  });
}

export function declineFmdRequest(a: Auth, clinicId: string, bookingId: string, reason: unknown) {
  requireClinic(a, clinicId, "appointments.write");
  const b = one<{ clinic_id: string }>("SELECT clinic_id FROM booking_requests WHERE id = ?", bookingId);
  if (!b || b.clinic_id !== clinicId) throw notFound("Request not found.");
  return clinicUpdateBooking(a, bookingId, "declined", typeof reason === "string" ? reason : "");
}

/* ---------------- waitlist ---------------- */

export function waitlist(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "appointments.read");
  return all("SELECT w.id, w.preference, w.created_at, p.full_name AS patient, p.id AS patient_id FROM waitlist w JOIN clinic_patients p ON p.id = w.patient_id WHERE w.clinic_id = ? AND w.status = 'waiting' ORDER BY w.created_at", clinicId);
}
export function addToWaitlist(a: Auth, clinicId: string, patientId: unknown, preference: unknown) {
  requireClinic(a, clinicId, "appointments.write");
  if (typeof patientId !== "string" || !one("SELECT 1 FROM clinic_patients WHERE id = ? AND clinic_id = ?", patientId, clinicId)) throw bad("Choose a patient.");
  run("INSERT INTO waitlist (id, clinic_id, patient_id, preference, created_at) VALUES (?, ?, ?, ?, ?)", randomUUID(), clinicId, patientId, typeof preference === "string" ? preference.slice(0, 200) : "", Date.now());
  return waitlist(a, clinicId);
}
export function removeFromWaitlist(a: Auth, clinicId: string, id: string, booked: boolean) {
  requireClinic(a, clinicId, "appointments.write");
  run("UPDATE waitlist SET status = ? WHERE id = ? AND clinic_id = ?", booked ? "booked" : "removed", id, clinicId);
  return waitlist(a, clinicId);
}

/* ---------------- publish availability to FMD Main ---------------- */

/**
 * Generates bookable 30-minute slots for the next N days from working hours minus booked time,
 * and marks the clinic as having a live schedule (MAIN-26). Only for activated workspaces.
 */
export function publishAvailability(a: Auth, clinicId: string, days = 14, now = Date.now()) {
  requireClinic(a, clinicId, "settings.manage");
  requireActive(clinicId);
  const providers = all<{ id: string }>("SELECT dentist_id AS id FROM dentist_clinics WHERE clinic_id = ?", clinicId);
  if (!providers.length) throw new HttpError(409, "no_providers", "Link at least one dentist profile to this clinic before publishing availability.");
  const hours = all<{ weekday: number; opens: string; closes: string }>("SELECT weekday, opens, closes FROM clinic_hours WHERE clinic_id = ?", clinicId);
  let created = 0;
  tx(() => {
    run("DELETE FROM slots WHERE clinic_id = ? AND starts_at > ? AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE b.slot_id = slots.id)", clinicId, now);
    for (let d = 0; d < Math.min(days, 31); d++) {
      const day = istDayStart(now) + d * 86400_000;
      for (const h of hours.filter((x) => x.weekday === istWeekday(day))) {
        for (let t = day + hhmmToMs(h.opens); t + 30 * 60_000 <= day + hhmmToMs(h.closes); t += 30 * 60_000) {
          if (t <= now) continue;
          for (const p of providers) {
            if (conflicts(clinicId, { start: t, end: t + 30 * 60_000, chairId: null, providerId: p.id })) continue;
            if (one("SELECT 1 FROM slots WHERE dentist_id = ? AND starts_at = ?", p.id, t)) continue;
            run("INSERT INTO slots (id, clinic_id, dentist_id, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), clinicId, p.id, t, t + 30 * 60_000, now);
            created++;
          }
        }
      }
    }
    run("UPDATE clinic_booking_policies SET live_schedule = 1, schedule_source = 'clinic_os' WHERE clinic_id = ?", clinicId);
    audit(a.user.id, "clinic.availability_published", "clinic", clinicId, { slots: created });
  });
  return { slots: created };
}

export function unpublishAvailability(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "settings.manage");
  tx(() => {
    run("DELETE FROM slots WHERE clinic_id = ? AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE b.slot_id = slots.id)", clinicId);
    run("UPDATE clinic_booking_policies SET live_schedule = 0, schedule_source = 'none' WHERE clinic_id = ?", clinicId);
    audit(a.user.id, "clinic.availability_unpublished", "clinic", clinicId);
  });
}
