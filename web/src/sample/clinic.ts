/**
 * FMD Clinic sample data for the preview. Every function is async and shaped like the future API, so screens switch to
 * the real backend by changing this module only. Appointments are generated for whatever date is asked, so the demo
 * never looks stale; approvals and ticks live in memory and reset on reload.
 */

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
  money: { collectedInr: number; outstandingInr: number; outstandingPatients: number };
  attention: { stockAlerts: number; unsignedNotes: number };
  lowStock: string | null;
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

const FEES: Record<string, number> = {
  "Scaling & polishing": 1800, Filling: 2500, "Check-up": 500, "Crown preparation": 9000, "Root canal, visit 2": 6500,
  Consultation: 500, "Extraction, 38": 3500, "Braces review": 1500, Whitening: 8000, "Kids' check-up": 600,
};

type Slot = [time: string, minutes: number, patient: string, type: string, dentist: string, chair: string, flags?: { noShow?: true; unconfirmed?: true; viaFmd?: true }];

/** One day's plan per branch (Monday to Saturday). Flags decide the few slots that don't go to plan. */
const PLAN: Record<string, Slot[]> = {
  main: [
    ["09:30", 30, "Rohan Gupta", "Scaling & polishing", "Dr. Iyer", "Chair 1"],
    ["09:30", 45, "Anita Desai", "Filling", "Dr. Rao", "Chair 2"],
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

/** Opening hours, the same every working day; Sundays are closed. */
export const HOURS = { open: "09:00", close: "19:00", lunch: ["13:00", "14:00"] as const };

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
      id: "t-po-composite",
      title: "Draft purchase order: composite A2 × 6",
      detail: "Dentsply via MedSupply Bengaluru · ₹8,640 estimated. Nothing is ordered until you approve.",
      source: "From: stock levels and last 30 days' use",
      needsApproval: true,
      status: "proposed",
      actionLabel: "Review order",
      preview: { lines: [["Composite A2, 4 g syringe × 6", "₹7,320"], ["GST 18%", "₹1,320"]], total: "₹8,640" },
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
    { id: "f-stock-count", kind: "staff_task", title: "Weekly stock count", note: "Front desk · due Friday", due: "upcoming", fromAi: false, done: false },
  ],
};

const BRANCH_EXTRAS: Record<string, { recallDue: number; stockAlerts: number; unsignedNotes: number; lowStock: string | null; outstandingInr: number; outstandingPatients: number }> = {
  main: { recallDue: 2, stockAlerts: 2, unsignedNotes: 2, lowStock: "composite A2", outstandingInr: 12000, outstandingPatients: 4 },
  kora: { recallDue: 4, stockAlerts: 0, unsignedNotes: 1, lowStock: null, outstandingInr: 3500, outstandingPatients: 1 },
};

const NOTICES: Omit<Notice, "read">[] = [
  { id: "n1", text: "Arjun Mehta hasn't confirmed today's 11:00 root canal", at: "08:30", href: "calendar?filter=unconfirmed" },
  { id: "n2", text: "Composite A2 is below its reorder level", at: "08:30", href: "inventory" },
  { id: "n3", text: "New booking via FMD: Sana Qureshi, 14:00 braces review", at: "08:05", href: "calendar" },
  { id: "n4", text: "FMD Manager finished yesterday's daily payment sheet", at: "08:30", href: "billing" },
];

/* ---------------- in-memory state ---------------- */

const taskState = new Map<string, AiTask["status"]>();
/** status changes made in the Calendar, by appointment id */
export const statusOverride = new Map<string, ApptStatus>();
/** appointments booked in the Calendar, by date */
export const added = new Map<string, Appointment[]>();
const followUpDone = new Map<string, boolean>();
let noticesRead = false;

/** Tests only: back to the untouched demo. */
export function resetSample() {
  taskState.clear();
  statusOverride.clear();
  added.clear();
  followUpDone.clear();
  noticesRead = false;
}

/* ---------------- helpers ---------------- */

const IST = 5.5 * 3600_000;
const istDate = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const hm = (time: string) => time.replace(/^0/, "");

function requireClinic(clinicId: string) {
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

/** One branch's appointments for a date: the day plan, statuses from the clock, then Calendar changes and bookings. */
export function dayAppointments(branchId: string, date: string, now: Date): Appointment[] {
  if (weekday(date) === 0) return []; // closed on Sundays
  const today = istDate(now);
  const planned = (PLAN[branchId] ?? []).map(([time, minutes, patientName, type, dentist, chair, flags = {}]) => {
    const start = `${date}T${time}:00+05:30`;
    const startMs = Date.parse(start);
    const endMs = startMs + minutes * 60_000;
    let status: ApptStatus;
    if (date < today) status = flags.noShow ? "no_show" : "completed";
    else if (date > today) status = FUTURE_UNCONFIRMED.has(`${branchId}-${time}`) ? "unconfirmed" : "confirmed";
    else if (endMs <= now.getTime()) status = flags.noShow ? "no_show" : "completed";
    else if (startMs <= now.getTime()) status = flags.noShow ? "no_show" : "checked_in";
    else status = flags.unconfirmed ? "unconfirmed" : flags.viaFmd ? "booked" : "confirmed";
    return { id: `${branchId}-${date}-${time}`, branchId, patientName, start, minutes, type, dentist, chair, status, viaFmd: Boolean(flags.viaFmd) };
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
  const appts = ids.flatMap((b) => dayAppointments(b, opts.date, now)).sort((a, b) => a.start.localeCompare(b.start));
  const nextDay = ids.flatMap((b) => dayAppointments(b, addDays(opts.date, 1), now));
  const count = (s: ApptStatus) => appts.filter((a) => a.status === s).length;
  const extras = ids.map((b) => BRANCH_EXTRAS[b]);
  const sum = (k: "recallDue" | "stockAlerts" | "unsignedNotes" | "outstandingInr" | "outstandingPatients") => extras.reduce((n, e) => n + e[k], 0);
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
    money: {
      collectedInr: appts.filter((a) => a.status === "completed").reduce((n, a) => n + (FEES[a.type] ?? 0), 0),
      outstandingInr: sum("outstandingInr"),
      outstandingPatients: sum("outstandingPatients"),
    },
    attention: { stockAlerts: sum("stockAlerts"), unsignedNotes: sum("unsignedNotes") },
    lowStock: extras.find((e) => e.lowStock)?.lowStock ?? null,
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
  if (h.lowStock) tail.push(`${h.lowStock} will run out in about 4 days at the current rate`);
  if (tail.length) parts.push(`${tail.join(", and ")}.`.replace(/^./, (c) => c.toUpperCase()));
  return parts.join(" ");
}
