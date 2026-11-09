/**
 * FMD Clinic sample data for the preview. Every function is async and shaped like the future API, so screens switch to
 * the real backend by changing this module only. Appointments are generated for whatever date is asked, so the demo
 * never looks stale; approvals and ticks live in memory and reset on reload.
 */
import { FMD_SOURCES, hash, pick, visitorsFor, type Source } from "./people.ts";

export type ApptStatus = "booked" | "unconfirmed" | "confirmed" | "checked_in" | "completed" | "no_show" | "cancelled";

export type Appointment = {
  id: string;
  branchId: string;
  patientName: string;
  /** ISO time with the IST offset */
  start: string;
  minutes: number;
  type: string;
  dentist: string;
  chair: string;
  status: ApptStatus;
  viaFmd: boolean;
  /* captured at source (reports spec); optional until every booking path records them */
  /** how the patient first came to the clinic */
  source?: Source;
  referredBy?: string;
  /** days between booking and the visit */
  bookedDaysAhead?: number;
  /** the reminder reached the patient (same-day bookings count as delivered) */
  reminderDelivered?: boolean;
  /** the patient's first visit (or, for a no-show, their first booking) */
  newPatient?: boolean;
  /** why a no-show or cancelled visit was missed, picked from a list at the desk */
  missed?: { reason: string; rebooked: boolean; cancel?: { by: "patient" | "clinic"; noticeHours: number } };
};

export type AiTask = {
  id: string;
  title: string;
  detail: string;
  source: string;
  needsApproval: boolean;
  status: "proposed" | "approved" | "skipped" | "done";
  actionLabel: string;
  preview?: { recipients: string[]; message: string } | { lines: [string, string][]; total: string };
};

export type FollowUp = {
  id: string;
  kind: "follow_up" | "staff_task";
  title: string;
  note: string;
  due: "overdue" | "today" | "upcoming";
  fromAi: boolean;
  done: boolean;
};

export type Notice = { id: string; text: string; at: string; read: boolean; href: string };
export type Branch = { id: string; name: string; area: string };
export type Clinic = { id: string; name: string; city: string; branches: Branch[] };

export type ClinicHome = {
  date: string;
  isToday: boolean;
  generatedAt: string;
  counts: {
    total: number;
    checkedIn: number;
    completed: number;
    noShow: number;
    /** unconfirmed on this date, still to come */
    unconfirmed: number;
    /** unconfirmed on the following day */
    unconfirmedNextDay: number;
    recallDue: number;
  };
  attention: { unsignedNotes: number; overdueFollowUps: number };
  /** "9:30" style IST time of the first appointment, or null */
  firstAt: string | null;
  tasks: AiTask[];
  next: Appointment[];
  followUps: FollowUp[];
};

/* ---------------- the demo clinic ---------------- */

const CLINIC: Clinic = {
  id: "smile-studio",
  name: "Smile Studio Dental",
  city: "Bengaluru",
  branches: [
    { id: "main", name: "Main branch", area: "Indiranagar" },
    { id: "kora", name: "Koramangala", area: "Koramangala" },
  ],
};

/** What each treatment costs; every visit is paid in full on the day. */
export const FEES: Record<string, number> = {
  "Scaling & polishing": 1800, Filling: 2500, "Check-up": 500, "Crown preparation": 9000, "Root canal, visit 2": 6500,
  Consultation: 500, "Extraction, 38": 3500, "Braces review": 1500, Whitening: 8000, "Kids' check-up": 600,
};

type Slot = [time: string, minutes: number, patient: string, type: string, dentist: string, chair: string, flags?: { noShow?: true; unconfirmed?: true; viaFmd?: true }];

/** One day's plan per branch (Monday to Saturday). Flags decide the few slots that don't go to plan. */
const PLAN: Record<string, Slot[]> = {
  main: [
    ["09:30", 30, "Rohan Gupta", "Scaling & polishing", "Dr. Iyer", "Chair 1"],
    ["09:45", 30, "Anita Desai", "Filling", "Dr. Rao", "Chair 2"],
    ["10:00", 20, "Suresh Babu", "Check-up", "Dr. Iyer", "Chair 1", { noShow: true }],
    ["10:15", 45, "Lakshmi Narayan", "Crown preparation", "Dr. Rao", "Chair 2"],
    ["10:30", 30, "Priya Sharma", "Scaling & polishing", "Dr. Iyer", "Chair 1"],
    ["11:00", 60, "Arjun Mehta", "Root canal, visit 2", "Dr. Rao", "Chair 2", { unconfirmed: true }],
    ["11:45", 20, "Neha Kulkarni", "Consultation", "Dr. Iyer", "Chair 1"],
    ["12:00", 45, "Vikram Patel", "Extraction, 38", "Dr. Rao", "Chair 2"],
    ["14:00", 30, "Sana Qureshi", "Braces review", "Dr. Iyer", "Chair 1", { viaFmd: true }],
    ["14:45", 30, "Rahul Verma", "Filling", "Dr. Rao", "Chair 2", { unconfirmed: true }],
    ["15:30", 60, "Divya Pillai", "Whitening", "Dr. Iyer", "Chair 1"],
    ["16:30", 20, "Imran Khan", "Check-up", "Dr. Rao", "Chair 2"],
    ["17:15", 30, "Pooja Reddy", "Scaling & polishing", "Dr. Iyer", "Chair 1", { viaFmd: true }],
    ["18:00", 20, "Kiran Rao", "Consultation", "Dr. Rao", "Chair 2", { unconfirmed: true }],
  ],
  kora: [
    ["10:00", 20, "Aditya Singh", "Kids' check-up", "Dr. Menon", "Chair 1"],
    ["11:00", 45, "Farah Sheikh", "Filling", "Dr. Menon", "Chair 1", { viaFmd: true }],
    ["12:00", 30, "Gopal Krishnan", "Scaling & polishing", "Dr. Menon", "Chair 1", { noShow: true }],
    ["15:00", 20, "Meghna Bose", "Consultation", "Dr. Menon", "Chair 1", { unconfirmed: true }],
    ["16:00", 30, "Nikhil Jain", "Braces review", "Dr. Menon", "Chair 1"],
    ["17:00", 20, "Ritu Agarwal", "Check-up", "Dr. Menon", "Chair 1"],
  ],
};

/** Who works which chair, per branch. Chair 3 at the main branch is the hygienist's, free for bookings. */
export const CHAIRS: Record<string, { chair: string; dentist: string }[]> = {
  main: [
    { chair: "Chair 1", dentist: "Dr. Iyer" },
    { chair: "Chair 2", dentist: "Dr. Rao" },
    { chair: "Chair 3", dentist: "Meera (hygienist)" },
  ],
  kora: [{ chair: "Chair 1", dentist: "Dr. Menon" }],
};

/** Opening hours: 9–7 with a lunch break, Saturdays 9–1, Sundays closed. */
export const HOURS = { open: "09:00", close: "19:00", lunch: ["13:00", "14:00"] as const, saturdayClose: "13:00" };

/** The bookable stretches of a day as [from, to] times; none on Sundays. */
export function openWindows(date: string): [string, string][] {
  const wd = weekday(date);
  if (wd === 0) return [];
  if (wd === 6) return [[HOURS.open, HOURS.saturdayClose]];
  return [
    [HOURS.open, HOURS.lunch[0]],
    [HOURS.lunch[1], HOURS.close],
  ];
}

/**
 * Past days are fuller than the plan: these extra visits fill the dentists' gaps and the hygienist's chair. A few drop
 * out each day, and Tuesday–Thursday early afternoons stay quiet, as they do in most clinics.
 */
const EXTRA: Record<string, [time: string, minutes: number, type: string, dentist: string, chair: string][]> = {
  main: [
    ["09:00", 30, "Check-up", "Dr. Iyer", "Chair 1"],
    ["11:00", 45, "Filling", "Dr. Iyer", "Chair 1"],
    ["12:15", 45, "Filling", "Dr. Iyer", "Chair 1"],
    ["14:30", 60, "Root canal, visit 2", "Dr. Iyer", "Chair 1"],
    ["16:30", 30, "Consultation", "Dr. Iyer", "Chair 1"],
    ["18:00", 45, "Filling", "Dr. Iyer", "Chair 1"],
    ["09:00", 45, "Consultation", "Dr. Rao", "Chair 2"],
    ["14:00", 45, "Filling", "Dr. Rao", "Chair 2"],
    ["15:30", 60, "Crown preparation", "Dr. Rao", "Chair 2"],
    ["17:00", 45, "Filling", "Dr. Rao", "Chair 2"],
    ["18:20", 30, "Check-up", "Dr. Rao", "Chair 2"],
    ["09:00", 45, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["10:00", 45, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["11:00", 30, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["12:00", 45, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["14:00", 30, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["15:00", 45, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["16:15", 45, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
    ["17:30", 45, "Scaling & polishing", "Meera (hygienist)", "Chair 3"],
  ],
  kora: [
    ["09:00", 45, "Filling", "Dr. Menon", "Chair 1"],
    ["10:30", 30, "Consultation", "Dr. Menon", "Chair 1"],
    ["14:00", 45, "Root canal, visit 2", "Dr. Menon", "Chair 1"],
    ["15:30", 30, "Kids' check-up", "Dr. Menon", "Chair 1"],
    ["17:30", 60, "Crown preparation", "Dr. Menon", "Chair 1"],
  ],
};
const MISS_REASONS = ["Forgot", "Unwell", "Work or travel", "Cost concern", "Transport", "Other", "No reason recorded"];
const CLINIC_REASONS = ["Dentist unavailable", "Equipment down", "Other"];

/** Days differ: some afternoon slots are empty midweek, and Saturdays are mornings only. */
const SKIP: Record<number, (time: string) => boolean> = {
  3: (t) => t === "14:45" || t === "16:30",
  4: (t) => t === "15:30" || t === "17:15",
  6: (t) => t >= "13:00",
};

/** On a future day, these slots are the unconfirmed ones (the rest are confirmed). */
const FUTURE_UNCONFIRMED = new Set(["main-11:00", "main-18:00", "kora-15:00"]);

const TASKS: Record<string, AiTask[]> = {
  main: [
    {
      id: "t-reminders",
      title: "Send confirmation reminders to 3 patients",
      detail: "WhatsApp, using your \"Appointment confirmation\" template. All 3 patients have opted in.",
      source: "From: today's calendar",
      needsApproval: true,
      status: "proposed",
      actionLabel: "Review & send",
      preview: {
        recipients: ["Arjun Mehta · 11:00", "Rahul Verma · 14:45", "Kiran Rao · 18:00"],
        message: "Hi {name}, this is Smile Studio Dental. Please reply YES to confirm your appointment today at {time}, or call us on 080 4123 5678 to change it.",
      },
    },
    {
      id: "t-recall",
      title: "Send recall messages to 2 patients",
      detail: "Their 6-month check is due and nothing is booked. WhatsApp, using your \"Recall\" template; both have opted in.",
      source: "From: visit history and your recall rule",
      needsApproval: true,
      status: "proposed",
      actionLabel: "Review & send",
      preview: {
        recipients: ["Meera Joshi · last visit 8 May", "Divya Pillai · last visit 14 Apr"],
        message: "Hi {name}, it's been 6 months since your last check-up at Smile Studio Dental. Reply with a day that suits you, or book on FMD.",
      },
    },
    {
      id: "t-paysheet",
      title: "Daily payment sheet for yesterday",
      detail: "₹41,200 collected across 12 payments; 1 entry is missing a payment mode.",
      source: "Generated 8:30 am · from billing",
      needsApproval: false,
      status: "done",
      actionLabel: "Open sheet",
    },
  ],
  kora: [
    {
      id: "t-kora-recall",
      title: "Recall list: 4 patients due this month",
      detail: "Patients whose 6-month check is due and who have nothing booked. Ready to call or message.",
      source: "From: visit history and your recall rule",
      needsApproval: false,
      status: "done",
      actionLabel: "Open list",
    },
  ],
};

const FOLLOW_UPS: Record<string, FollowUp[]> = {
  main: [
    { id: "f-ravi", kind: "follow_up", title: "Call Ravi Nair about crown fitting", note: "Crown ready since Friday", due: "overdue", fromAi: false, done: false },
    { id: "f-meera", kind: "follow_up", title: "Recall: Meera Joshi (6-month check)", note: "Suggested by FMD Manager", due: "today", fromAi: true, done: false },
    { id: "f-notes", kind: "staff_task", title: "Sign 2 clinical notes from yesterday", note: "Dr. Rao · due today", due: "today", fromAi: false, done: false },
    { id: "f-autoclave", kind: "staff_task", title: "Autoclave log for the evening shift", note: "Front desk · Kavya", due: "today", fromAi: false, done: false },
  ],
  kora: [
    { id: "f-xray", kind: "follow_up", title: "Send Farah Sheikh her X-ray report", note: "Requested at her last visit", due: "upcoming", fromAi: false, done: false },
    { id: "f-sterilisation-log", kind: "staff_task", title: "Weekly sterilisation log", note: "Front desk · due Friday", due: "upcoming", fromAi: false, done: false },
  ],
};

const BRANCH_EXTRAS: Record<string, { recallDue: number; unsignedNotes: number }> = {
  main: { recallDue: 2, unsignedNotes: 2 },
  kora: { recallDue: 4, unsignedNotes: 1 },
};

const NOTICES: Omit<Notice, "read">[] = [
  { id: "n1", text: "Arjun Mehta hasn't confirmed today's 11:00 root canal", at: "08:30", href: "calendar?filter=unconfirmed" },
  { id: "n2", text: "Meera Joshi and Divya Pillai are due for their 6-month check", at: "08:30", href: "patients" },
  { id: "n3", text: "New booking via FMD: Sana Qureshi, 14:00 braces review", at: "08:05", href: "calendar" },
  { id: "n4", text: "FMD Manager finished yesterday's daily payment sheet", at: "08:30", href: "billing" },
];

/* ---------------- in-memory state ---------------- */

const taskState = new Map<string, AiTask["status"]>();
/** status changes made in the Calendar, by appointment id */
export const statusOverride = new Map<string, ApptStatus>();
/** appointments booked in the Calendar, by date */
export const added = new Map<string, Appointment[]>();
/** waitlist entries already offered a slot */
export const waitlistOffered = new Set<string>();
const followUpDone = new Map<string, boolean>();
let noticesRead = false;

/** Other sample modules register how to clear their own in-memory changes. */
export const onReset: (() => void)[] = [];

/** Tests only: back to the untouched demo. */
export function resetSample() {
  onReset.forEach((fn) => fn());
  taskState.clear();
  statusOverride.clear();
  added.clear();
  waitlistOffered.clear();
  followUpDone.clear();
  noticesRead = false;
}

/* ---------------- helpers ---------------- */

const IST = 5.5 * 3600_000;
export const istDate = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const hm = (time: string) => time.replace(/^0/, "");

export function requireClinic(clinicId: string) {
  if (clinicId !== CLINIC.id) throw new Error("Clinic not found");
}

const branchesOf = (branchId: string) => (branchId === "all" ? CLINIC.branches.map((b) => b.id) : [branchId]);

/** A `?date=` value from the URL: a real calendar date, or `fallback`. */
export function cleanDate(raw: string | null, fallback: string) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const t = Date.parse(`${raw}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== raw ? fallback : raw; // rejects 2026-02-30
}

/** A `?branch=` value from the URL: one of the clinic's branches or "all", else its first branch. */
export const cleanBranch = (raw: string | null, clinic: Clinic) =>
  raw === "all" || clinic.branches.some((b) => b.id === raw) ? (raw as string) : clinic.branches[0].id;

/** A new patient's visit on a planned (today or future) day; past days know it from the roster. */
const plannedNew = (id: string) => hash(`${id}-new`) % 6 === 0;
/** An attended first visit: what "new patients" counts everywhere. */
export const isFirstVisit = (a: Appointment) => a.status === "completed" && Boolean(a.newPatient);

const pastCache = new Map<string, Appointment[]>();

/**
 * A finished day: the plan's slots plus the extras, filled with roster patients. Who misses a visit follows a simple
 * model: more often when the reminder didn't arrive, on Saturdays and evenings, when booked 14+ days ahead, for new
 * patients, and for a few patients who often miss. Stable for a date, so every report sees the same day.
 */
function pastDay(branchId: string, date: string, today: string): Appointment[] {
  const key = `${today}|${branchId}|${date}`;
  const hit = pastCache.get(key);
  if (hit) return hit;
  const wd = weekday(date);
  const skip = SKIP[wd] ?? (() => false);
  const slots = [
    ...(PLAN[branchId] ?? []).map(([time, minutes, , type, dentist, chair]) => ({ id: `${branchId}-${date}-${time}`, time, minutes, type, dentist, chair })),
    ...(EXTRA[branchId] ?? [])
      .map(([time, minutes, type, dentist, chair]) => ({ id: `${branchId}-${date}-${time}-c${chair.slice(-1)}`, time, minutes, type, dentist, chair }))
      .filter((s) => !(wd >= 2 && wd <= 4 && s.time >= "14:00" && s.time < "16:00") && hash(`${s.id}-x`) % 7 !== 0),
  ]
    .filter((s) => !skip(s.time))
    .sort((a, b) => a.time.localeCompare(b.time) || a.chair.localeCompare(b.chair));
  const visitors = visitorsFor(branchId, date, slots.map((s) => s.id), today);
  const out = slots.map((s, k): Appointment => {
    const v = visitors[k];
    const h = (tag: string) => hash(`${s.id}-${tag}`);
    const person = "person" in v ? v.person : null;
    const neverCame = "noShow" in v && v.noShow;
    const isNew = person ? person.first === date : neverCame;
    const source: Source = person?.source ?? (neverCame ? pick(["FMD Main search", "Google", "Phone", "Social"] as const, [4, 3, 2, 1], h("src")) : "Phone");
    const bookedDaysAhead = source === "Walk-in" ? 0 : pick([0, 1, 2, 4, 7, 10, 16, 21, 30], [8, 14, 12, 12, 12, 8, 14, 10, 10], h("lead"));
    const reminderDelivered = bookedDaysAhead === 0 || h("rem") % 100 >= 12;
    const base = {
      id: s.id,
      branchId,
      patientName: person ? person.name : (v as { name: string }).name,
      start: `${date}T${s.time}:00+05:30`,
      minutes: s.minutes,
      type: s.type,
      dentist: s.dentist,
      chair: s.chair,
      viaFmd: FMD_SOURCES.includes(source),
      source,
      bookedDaysAhead,
      reminderDelivered,
      newPatient: isNew,
      ...(person?.referredBy ? { referredBy: person.referredBy } : {}),
    };
    const missed = (cancel?: { by: "patient" | "clinic"; noticeHours: number }) => ({
      reason: cancel?.by === "clinic" ? CLINIC_REASONS[h("why") % CLINIC_REASONS.length] : pick(MISS_REASONS, [35, 18, 17, 8, 6, 4, 12], h("why")),
      // ponytail: a stable coin flip, not a look-ahead at the patient's next booking; the backend sets it from real data
      rebooked: h("rb") % 100 < 57,
      ...(cancel ? { cancel } : {}),
    });
    // a patient's first and last visits happened, by definition
    if (person && (person.first === date || person.last === date)) return { ...base, status: "completed" };
    if (neverCame) return { ...base, status: "no_show", missed: missed() };
    const flaky = person?.flaky ? 120 : 0;
    const r = h("st") % 1000;
    if (r < 15) return { ...base, status: "cancelled", missed: missed({ by: "clinic", noticeHours: 2 + (h("nh") % 48) }) };
    if (r < 45 + flaky) return { ...base, status: "cancelled", missed: missed({ by: "patient", noticeHours: 1 + (h("nh") % 23) }) };
    if (r < 85 + flaky) return { ...base, status: "cancelled", missed: missed({ by: "patient", noticeHours: 24 + (h("nh") % 72) }) };
    const p = 3 + (reminderDelivered ? 0 : 9) + (wd === 6 || s.time >= "17:00" ? 3 : 0) + (bookedDaysAhead >= 14 ? 3 : 0) + (person?.flaky ? 35 : 0);
    return h("ns") % 100 < p ? { ...base, status: "no_show", missed: missed() } : { ...base, status: "completed" };
  });
  pastCache.set(key, out);
  return out;
}

/** One branch's appointments for a date: finished days from the roster; today and later from the day plan and the clock. */
export function dayAppointments(branchId: string, date: string, now: Date): Appointment[] {
  if (weekday(date) === 0) return []; // closed on Sundays
  const today = istDate(now);
  const skip = SKIP[weekday(date)] ?? (() => false);
  const planned =
    date < today
      ? pastDay(branchId, date, today)
      : (PLAN[branchId] ?? []).filter(([time]) => !skip(time)).map(([time, minutes, patientName, type, dentist, chair, flags = {}]): Appointment => {
          const id = `${branchId}-${date}-${time}`;
          const start = `${date}T${time}:00+05:30`;
          const startMs = Date.parse(start);
          const endMs = startMs + minutes * 60_000;
          let status: ApptStatus;
          if (date > today) status = FUTURE_UNCONFIRMED.has(`${branchId}-${time}`) ? "unconfirmed" : "confirmed";
          else if (endMs <= now.getTime()) status = flags.noShow ? "no_show" : "completed";
          else if (startMs <= now.getTime()) status = flags.noShow ? "no_show" : "checked_in";
          else status = flags.unconfirmed ? "unconfirmed" : flags.viaFmd ? "booked" : "confirmed";
          const source: Source = flags.viaFmd ? "FMD Main search" : "Phone";
          return { id, branchId, patientName, start, minutes, type, dentist, chair, status, viaFmd: Boolean(flags.viaFmd), source, bookedDaysAhead: hash(id) % 15, reminderDelivered: true, newPatient: plannedNew(id) };
        });
  return [...planned, ...(added.get(date) ?? []).filter((a) => a.branchId === branchId)]
    .map((a) => ({ ...a, status: statusOverride.get(a.id) ?? a.status }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

const withTaskState = (t: AiTask): AiTask => ({ ...t, status: taskState.get(t.id) ?? t.status });
const withDone = (f: FollowUp): FollowUp => ({ ...f, done: followUpDone.get(f.id) ?? f.done });

/* ---------------- API ---------------- */

export async function getClinic(clinicId: string): Promise<Clinic | null> {
  return clinicId === CLINIC.id ? CLINIC : null;
}

export async function getClinicHome(clinicId: string, opts: { date: string; branchId: string; now?: Date }): Promise<ClinicHome> {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const ids = branchesOf(opts.branchId);
  // cancelled visits no longer count as appointments
  const appts = ids
    .flatMap((b) => dayAppointments(b, opts.date, now))
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => a.start.localeCompare(b.start));
  const nextDay = ids.flatMap((b) => dayAppointments(b, addDays(opts.date, 1), now));
  const count = (s: ApptStatus) => appts.filter((a) => a.status === s).length;
  const extras = ids.map((b) => BRANCH_EXTRAS[b]);
  const sum = (k: "recallDue" | "unsignedNotes") => extras.reduce((n, e) => n + e[k], 0);
  const finished = new Set<ApptStatus>(["completed", "no_show", "cancelled"]);

  return {
    date: opts.date,
    isToday: opts.date === istDate(now),
    generatedAt: `${opts.date}T08:30:00+05:30`,
    counts: {
      total: appts.length,
      checkedIn: count("checked_in"),
      completed: count("completed"),
      noShow: count("no_show"),
      unconfirmed: count("unconfirmed"),
      unconfirmedNextDay: nextDay.filter((a) => a.status === "unconfirmed").length,
      recallDue: sum("recallDue"),
    },
    attention: {
      unsignedNotes: sum("unsignedNotes"),
      overdueFollowUps: ids.flatMap((b) => FOLLOW_UPS[b] ?? []).map(withDone).filter((f) => f.due === "overdue" && !f.done).length,
    },
    firstAt: appts[0] ? hm(appts[0].start.slice(11, 16)) : null,
    // reminders are about today's unconfirmed patients: on any other day, or once none are left, there's nothing to send
    tasks: ids
      .flatMap((b) => TASKS[b] ?? [])
      .filter((t) => t.id !== "t-reminders" || (opts.date === istDate(now) && count("unconfirmed") > 0))
      .map(withTaskState),
    next: appts.filter((a) => !finished.has(a.status)).slice(0, 5),
    followUps: ids.flatMap((b) => FOLLOW_UPS[b] ?? []).map(withDone),
  };
}

export async function decideAiTask(clinicId: string, taskId: string, decision: "approve" | "skip" | "undo"): Promise<AiTask> {
  requireClinic(clinicId);
  const task = Object.values(TASKS).flat().find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  const current = taskState.get(taskId) ?? task.status;
  // approved and done are final; undo only brings back a skipped task
  if (current === "proposed" && decision !== "undo") taskState.set(taskId, decision === "approve" ? "approved" : "skipped");
  if (current === "skipped" && decision === "undo") taskState.set(taskId, "proposed");
  return withTaskState(task);
}

export async function toggleFollowUp(clinicId: string, id: string): Promise<FollowUp> {
  requireClinic(clinicId);
  const f = Object.values(FOLLOW_UPS).flat().find((x) => x.id === id);
  if (!f) throw new Error("Follow-up not found");
  followUpDone.set(id, !withDone(f).done);
  return withDone(f);
}

export async function listNotices(clinicId: string): Promise<Notice[]> {
  requireClinic(clinicId);
  return NOTICES.map((n) => ({ ...n, read: noticesRead }));
}

export async function markNoticesRead(clinicId: string): Promise<void> {
  requireClinic(clinicId);
  noticesRead = true;
}

/** The FMD Manager briefing, built from the figures so it can never disagree with the cards. */
export function briefingText(h: ClinicHome): string {
  const day = h.isToday ? "today" : "on this day";
  if (h.counts.total === 0) return `No appointments ${day}.`;
  const parts = [`You have ${h.counts.total} appointment${h.counts.total === 1 ? "" : "s"} ${day}, the first at ${h.firstAt}.`];
  const u = h.counts.unconfirmed;
  if (u > 0) parts.push(`${u} patient${u === 1 ? " hasn't" : "s haven't"} confirmed.`);
  const tail: string[] = [];
  if (h.counts.recallDue > 0) tail.push(`${h.counts.recallDue} patient${h.counts.recallDue === 1 ? " is" : "s are"} due for recall this week`);
  if (tail.length) parts.push(`${tail.join(", and ")}.`.replace(/^./, (c) => c.toUpperCase()));
  return parts.join(" ");
}
