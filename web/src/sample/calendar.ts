/**
 * FMD Clinic Calendar sample data: the day as an agenda (with free gaps you can book), the same day by dentist, status
 * changes and bookings. Built on clinic.ts's appointment generator, so Home and Calendar always agree.
 */
import {
  added, CHAIRS, dayAppointments, HOURS, istDate, openWindows, requireClinic, statusOverride, waitlistOffered, weekday,
  type Appointment, type ApptStatus,
} from "./clinic.ts";

export type FreeSlot = { kind: "free"; branchId: string; chair: string; dentist: string; start: string; minutes: number };
export type AgendaItem = { kind: "appt"; appt: Appointment; isNow: boolean } | FreeSlot;
export type Part = { name: "Morning" | "Afternoon" | "Evening"; items: AgendaItem[] };

const MIN = 60_000;
const at = (date: string, hm: string) => Date.parse(`${date}T${hm}:00+05:30`);
const iso = (ms: number) => new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 16) + ":00+05:30";
const hmOf = (start: string) => start.slice(11, 16);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const startOf = (i: AgendaItem) => (i.kind === "appt" ? i.appt.start : i.start);
const live = (a: Appointment) => a.status !== "cancelled";
const span = (a: Appointment) => [Date.parse(a.start), Date.parse(a.start) + a.minutes * MIN] as const;

/** Bookable gaps of 30 minutes or more in one chair: opening hours minus lunch, bookings and (today) the past. */
export function freeGaps(branchId: string, date: string, now: Date, appts: Appointment[]): FreeSlot[] {
  if (weekday(date) === 0 || date < istDate(now)) return [];
  const floor = date === istDate(now) ? Math.ceil(now.getTime() / (15 * MIN)) * 15 * MIN : 0; // next quarter hour
  const windows = openWindows(date).map(([from, to]) => [at(date, from), at(date, to)]);
  return (CHAIRS[branchId] ?? []).flatMap(({ chair, dentist }) => {
    const busy = appts.filter((a) => a.chair === chair && live(a)).map(span).sort((x, y) => x[0] - y[0]);
    const out: FreeSlot[] = [];
    for (const [ws, we] of windows) {
      let cursor = Math.max(ws, floor);
      for (const [bs, be] of [...busy, [we, we] as const]) {
        const end = Math.min(bs, we);
        if (end - cursor >= 30 * MIN) out.push({ kind: "free", branchId, chair, dentist, start: iso(cursor), minutes: (end - cursor) / MIN });
        cursor = Math.max(cursor, be);
        if (cursor >= we) break;
      }
    }
    return out;
  });
}

function dayItems(branchId: string, date: string, now: Date): AgendaItem[] {
  const ids = branchId === "all" ? Object.keys(CHAIRS) : [branchId];
  return ids
    .flatMap((b) => {
      const appts = dayAppointments(b, date, now);
      const t = now.getTime();
      return [
        ...appts.filter(live).map((appt): AgendaItem => ({ kind: "appt", appt, isNow: span(appt)[0] <= t && t < span(appt)[1] })),
        ...freeGaps(b, date, now, appts),
      ];
    })
    .sort((a, b) => startOf(a).localeCompare(startOf(b)));
}

export async function getWeekStrip(clinicId: string, opts: { from: string; days: number; branchId: string; now?: Date }) {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const ids = opts.branchId === "all" ? Object.keys(CHAIRS) : [opts.branchId];
  return Array.from({ length: opts.days }, (_, i) => {
    const date = addDays(opts.from, i);
    return { date, closed: weekday(date) === 0, booked: ids.flatMap((b) => dayAppointments(b, date, now)).filter(live).length };
  });
}

export async function getAgenda(clinicId: string, opts: { date: string; branchId: string; dentist?: string; status?: ApptStatus | "free"; now?: Date }) {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const all = dayItems(opts.branchId, opts.date, now);
  const appts = all.flatMap((i) => (i.kind === "appt" ? [i.appt] : []));
  const shown = all.filter((i) => {
    if (opts.dentist && (i.kind === "appt" ? i.appt.dentist : i.dentist) !== opts.dentist) return false;
    if (opts.status === "free") return i.kind === "free";
    if (opts.status) return i.kind === "appt" && i.appt.status === opts.status;
    return true;
  });
  const partOf = (i: AgendaItem) => {
    const hm = hmOf(startOf(i));
    return hm < "12:00" ? "Morning" : hm < "17:00" ? "Afternoon" : "Evening";
  };
  const parts: Part[] = (["Morning", "Afternoon", "Evening"] as const).map((name) => ({ name, items: shown.filter((i) => partOf(i) === name) }));
  return {
    parts,
    glance: {
      booked: appts.length,
      free: all.filter((i) => i.kind === "free").length,
      unconfirmed: appts.filter((a) => a.status === "unconfirmed").length,
      noShow: appts.filter((a) => a.status === "no_show").length,
    },
  };
}

export async function getByDentist(clinicId: string, opts: { date: string; branchId: string; now?: Date }) {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const ids = opts.branchId === "all" ? Object.keys(CHAIRS) : [opts.branchId];
  return ids.flatMap((b) => {
    const items = dayItems(b, opts.date, now);
    return CHAIRS[b].map(({ chair, dentist }) => ({
      branchId: b,
      chair,
      dentist,
      slots: items.filter((i) => (i.kind === "appt" ? i.appt.chair : i.chair) === chair),
    }));
  });
}

export type StatusAction = "confirm" | "check_in" | "complete" | "no_show" | "cancel";
const OPEN: ApptStatus[] = ["booked", "unconfirmed", "confirmed"];
const ALLOWED: Record<StatusAction, [from: ApptStatus[], to: ApptStatus]> = {
  confirm: [["booked", "unconfirmed"], "confirmed"],
  check_in: [OPEN, "checked_in"],
  complete: [["checked_in"], "completed"],
  no_show: [OPEN, "no_show"],
  cancel: [[...OPEN, "checked_in"], "cancelled"],
};

/** Move an appointment along its lifecycle (PRD 6.4); a step that doesn't fit its current status is refused. */
export async function setStatus(clinicId: string, apptId: string, action: StatusAction, now = new Date()): Promise<Appointment> {
  requireClinic(clinicId);
  const [branchId] = apptId.split("-");
  const date = apptId.slice(branchId.length + 1, branchId.length + 11);
  const appt = dayAppointments(branchId, date, now).find((a) => a.id === apptId);
  if (!appt) throw new Error("Appointment not found");
  const [from, to] = ALLOWED[action];
  if (!from.includes(appt.status)) throw new Error(`Can't ${action.replace("_", " ")} an appointment that is ${appt.status.replace("_", " ")}`);
  statusOverride.set(apptId, to);
  return { ...appt, status: to };
}

export type BookInput = { branchId: string; date: string; start: string; minutes: number; chair: string; patientName: string; type: string };
let seq = 0;

/** Why a slot can't be booked, or null when it can. */
function problem(i: BookInput, now: Date): string | null {
  if (weekday(i.date) === 0) return "The clinic is closed on Sundays.";
  const s = at(i.date, i.start), e = s + i.minutes * MIN;
  if (Number.isNaN(s)) return "Pick a valid time.";
  if (s < now.getTime()) return "That time has already passed.";
  if (s < at(i.date, HOURS.open) || e > at(i.date, HOURS.close)) return `Outside opening hours (${HOURS.open}–${HOURS.close}).`;
  if (weekday(i.date) === 6 && e > at(i.date, HOURS.saturdayClose)) return `Saturdays close at ${HOURS.saturdayClose}.`;
  if (s < at(i.date, HOURS.lunch[1]) && e > at(i.date, HOURS.lunch[0])) return "Overlaps the lunch break (13:00–14:00).";
  const clash = dayAppointments(i.branchId, i.date, now).find((a) => a.chair === i.chair && live(a) && s < span(a)[1] && e > span(a)[0]);
  return clash ? `Clashes with ${clash.patientName} at ${hmOf(clash.start)} in ${i.chair}.` : null;
}

export async function bookAppointment(clinicId: string, input: BookInput, now = new Date()) {
  requireClinic(clinicId);
  const chair = (CHAIRS[input.branchId] ?? []).find((c) => c.chair === input.chair);
  if (!chair) return { ok: false as const, reason: "Choose a chair.", suggestions: [] };
  const reason = problem(input, now);
  if (reason) {
    const want = at(input.date, input.start);
    const suggestions = Array.from({ length: 20 }, (_, k) => {
      const m = 9 * 60 + k * 30;
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    })
      .filter((start) => !problem({ ...input, start }, now))
      .sort((a, b) => Math.abs(at(input.date, a) - want) - Math.abs(at(input.date, b) - want))
      .slice(0, 3)
      .sort();
    return { ok: false as const, reason, suggestions };
  }
  const appt: Appointment = {
    id: `${input.branchId}-${input.date}-${input.start}-n${++seq}`,
    branchId: input.branchId,
    patientName: input.patientName,
    start: `${input.date}T${input.start}:00+05:30`,
    minutes: input.minutes,
    type: input.type,
    dentist: chair.dentist,
    chair: input.chair,
    status: "confirmed",
    viaFmd: false,
  };
  added.set(input.date, [...(added.get(input.date) ?? []), appt]);
  return { ok: true as const, appt };
}

const WAITLIST: Record<string, { id: string; name: string; wants: string; note: string }[]> = {
  main: [
    { id: "w-ritu", name: "Ritu Agarwal", wants: "Any morning", note: "Cleaning" },
    { id: "w-mohan", name: "Mohan Das", wants: "After 5 pm", note: "Consultation" },
    { id: "w-asha", name: "Asha Nair", wants: "Thursday", note: "Filling" },
  ],
  kora: [{ id: "w-tara", name: "Tara Iyengar", wants: "Saturday", note: "Kids' check-up" }],
};

export async function listWaitlist(clinicId: string, branchId: string) {
  requireClinic(clinicId);
  const ids = branchId === "all" ? Object.keys(WAITLIST) : [branchId];
  return ids.flatMap((b) => WAITLIST[b] ?? []).map((w) => ({ ...w, offered: waitlistOffered.has(w.id) }));
}

export async function offerSlot(clinicId: string, id: string) {
  requireClinic(clinicId);
  const w = Object.values(WAITLIST).flat().find((x) => x.id === id);
  if (!w) throw new Error("Not on the waitlist");
  waitlistOffered.add(id);
  return { ...w, offered: true };
}
