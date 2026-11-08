/**
 * FMD Clinic patients sample data (PRD 6.3): the list with search, filters and duplicate warnings, and each patient's
 * record. Signed notes are never edited: changes are appended as amendments with a reason.
 */
import { onReset, requireClinic } from "./clinic.ts";

export type Tone = "ok" | "warn" | "bad" | "accent" | "muted";
export type Flag = "recall" | "balance" | "in_treatment" | "consent_missing";

export type PatientSummary = {
  id: string;
  pid: string;
  name: string;
  initials: string;
  sex: "F" | "M";
  age: number;
  phone: string;
  dob: string;
  guardian?: string;
  lastVisit?: { date: string; what: string };
  next?: { label: string; tone?: Tone };
  treatment?: { label: string; tone: Tone };
  balanceInr: number;
  consent: { label: string; tone: Tone };
  flags: Flag[];
};

export type Note = { id: string; date: string; by: string; text: string; signed: true; amendments: { date: string; by: string; reason: string; text: string }[] };
export type Plan = { id: string; version: number; status: "accepted" | "proposed"; date: string; lines: { what: string; tooth?: string; qty: number; feeInr: number }[]; discountInr: number; discountNote?: string; signedBy?: string };
export type ToothState = "filled" | "crown" | "treatment" | "missing";

export type PatientDetail = PatientSummary & {
  since: string;
  email?: string;
  language: string;
  address: string;
  referredBy: string;
  alerts: string[];
  consents: { label: string; ok: boolean }[];
  timeline: { date: string; kind: "visit" | "message" | "payment" | "plan" | "upcoming"; title: string; detail: string }[];
  teeth: Record<string, ToothState>;
  toothHistory: Record<string, { date: string; what: string; by: string }[]>;
  notes: Note[];
  plans: Plan[];
  files: { name: string; kind: string; date: string }[];
  payments: { date: string; amountInr: number; mode: string; ref: string }[];
};

const initials = (name: string) => name.replace(/^Dr\. /, "").split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join("");

const SUMMARIES: Omit<PatientSummary, "initials">[] = [
  { id: "p-arjun", pid: "FMD-00412", name: "Arjun Mehta", sex: "M", age: 34, phone: "+91 98450 12345", dob: "1992-03-14", lastVisit: { date: "3 Nov", what: "Root canal, visit 1" }, next: { label: "Today 11:00" }, treatment: { label: "Root canal · 2 of 3", tone: "accent" }, balanceInr: 4500, consent: { label: "Complete", tone: "ok" }, flags: ["balance", "in_treatment"] },
  { id: "p-arjun-k", pid: "FMD-01177", name: "Arjun K. Mehta", sex: "M", age: 34, phone: "+91 98450 12345", dob: "1992-03-14", lastVisit: { date: "2 Sep", what: "Consultation" }, balanceInr: 0, consent: { label: "Complete", tone: "ok" }, flags: [] },
  { id: "p-priya", pid: "FMD-00388", name: "Priya Sharma", sex: "F", age: 29, phone: "+91 99860 44120", dob: "1997-07-22", lastVisit: { date: "Today", what: "Scaling" }, balanceInr: 0, consent: { label: "Complete", tone: "ok" }, flags: [] },
  { id: "p-ravi", pid: "FMD-00241", name: "Ravi Nair", sex: "M", age: 52, phone: "+91 90080 77812", dob: "1974-01-09", lastVisit: { date: "6 Nov", what: "Crown try-in" }, next: { label: "Follow-up overdue", tone: "bad" }, treatment: { label: "Crown · fitting", tone: "accent" }, balanceInr: 6000, consent: { label: "Complete", tone: "ok" }, flags: ["balance", "in_treatment"] },
  { id: "p-meera", pid: "FMD-00197", name: "Meera Joshi", sex: "F", age: 41, phone: "+91 98861 30045", dob: "1985-11-30", lastVisit: { date: "8 May", what: "Check-up" }, next: { label: "Recall due", tone: "warn" }, balanceInr: 0, consent: { label: "Marketing opt-in missing", tone: "warn" }, flags: ["recall", "consent_missing"] },
  { id: "p-sana", pid: "FMD-00655", name: "Sana Qureshi", sex: "F", age: 16, phone: "+91 97400 55120", dob: "2010-06-18", guardian: "Farhan Qureshi", lastVisit: { date: "13 Oct", what: "Braces adjustment" }, next: { label: "Today 14:00" }, treatment: { label: "Braces · month 7 of 18", tone: "accent" }, balanceInr: 1500, consent: { label: "Guardian signed", tone: "ok" }, flags: ["balance", "in_treatment"] },
  { id: "p-lakshmi", pid: "FMD-00301", name: "Lakshmi Narayan", sex: "F", age: 58, phone: "+91 94480 21901", dob: "1968-02-02", lastVisit: { date: "27 Oct", what: "Crown planning" }, next: { label: "Today 10:15" }, treatment: { label: "Crown · preparation", tone: "accent" }, balanceInr: 0, consent: { label: "Complete", tone: "ok" }, flags: ["in_treatment"] },
  { id: "p-vikram", pid: "FMD-00733", name: "Vikram Patel", sex: "M", age: 27, phone: "+91 99160 88234", dob: "1999-09-05", lastVisit: { date: "30 Oct", what: "Consultation" }, next: { label: "Today 12:00" }, balanceInr: 0, consent: { label: "Extraction consent pending", tone: "warn" }, flags: ["consent_missing"] },
  { id: "p-neha", pid: "FMD-00820", name: "Neha Kulkarni", sex: "F", age: 31, phone: "+91 99001 22334", dob: "1995-12-12", next: { label: "Today 11:45" }, balanceInr: 0, consent: { label: "Complete", tone: "ok" }, flags: [] },
  { id: "p-divya", pid: "FMD-00509", name: "Divya Pillai", sex: "F", age: 36, phone: "+91 98804 66710", dob: "1990-08-27", lastVisit: { date: "14 Apr", what: "Scaling" }, next: { label: "Today 15:30" }, balanceInr: 0, consent: { label: "Complete", tone: "ok" }, flags: ["recall"] },
  { id: "p-rohan", pid: "FMD-00266", name: "Rohan Gupta", sex: "M", age: 45, phone: "+91 90350 11873", dob: "1981-05-03", lastVisit: { date: "Today", what: "Scaling" }, balanceInr: 0, consent: { label: "Complete", tone: "ok" }, flags: [] },
];

const ARJUN: Omit<PatientDetail, keyof PatientSummary> = {
  since: "2023",
  email: "arjun.m@gmail.com",
  language: "English, Hindi",
  address: "HAL 2nd Stage, Indiranagar",
  referredBy: "FMD Main booking",
  alerts: ["Allergy: penicillin", "Condition: type 2 diabetes (on metformin)"],
  consents: [
    { label: "Treatment · RCT signed 3 Nov", ok: true },
    { label: "Data use", ok: true },
    { label: "WhatsApp reminders", ok: true },
    { label: "Marketing", ok: false },
  ],
  timeline: [
    { date: "Today · 11:00", kind: "upcoming", title: "Root canal, visit 2 · tooth 36", detail: "Dr. Rao · Chair 2" },
    { date: "4 Nov · WhatsApp", kind: "message", title: "Reminder sent: post-op care", detail: "Template \"After root canal\" · delivered, read" },
    { date: "3 Nov · visit", kind: "visit", title: "Root canal, visit 1 · tooth 36", detail: "Access opening, working length 21 mm. Note signed by Dr. Rao · X-ray attached" },
    { date: "3 Nov · billing", kind: "payment", title: "Payment ₹6,000 · UPI", detail: "Receipt R-2311-041" },
    { date: "28 Oct · plan", kind: "plan", title: "Treatment plan accepted · ₹13,500", detail: "Root canal 36 + crown, signed by the patient" },
    { date: "28 Oct · visit", kind: "visit", title: "Consultation · pain lower left", detail: "X-ray taken: deep decay in 36 reaching the nerve" },
  ],
  teeth: { "16": "filled", "26": "filled", "28": "missing", "46": "crown", "48": "missing", "36": "treatment" },
  toothHistory: {
    "36": [
      { date: "3 Nov", what: "Root canal started (visit 1 of 3)", by: "Dr. Rao" },
      { date: "28 Oct", what: "Deep decay, distal-occlusal", by: "Dr. Rao" },
      { date: "2023", what: "Filling, occlusal", by: "Dr. Iyer" },
    ],
    "46": [{ date: "2024", what: "Zirconia crown", by: "Dr. Rao" }],
    "16": [{ date: "2023", what: "Composite filling, mesial", by: "Dr. Iyer" }],
    "26": [{ date: "2023", what: "Composite filling, occlusal", by: "Dr. Iyer" }],
  },
  notes: [
    {
      id: "n-arjun-1",
      date: "3 Nov",
      by: "Dr. Rao",
      text: "Tooth 36: access opening under local anaesthetic, canals located (MB, ML, D). Working length 21 mm. Calcium hydroxide dressing, temporary seal.",
      signed: true,
      amendments: [{ date: "4 Nov", by: "Dr. Rao", reason: "Typo", text: "Working length corrected to 21.5 mm (ML canal)." }],
    },
    { id: "n-arjun-2", date: "28 Oct", by: "Dr. Rao", text: "Pain lower left for 1 week, worse with cold. X-ray: deep decay 36 reaching the nerve. Plan: root canal and crown, discussed with the patient.", signed: true, amendments: [] },
  ],
  plans: [
    {
      id: "pl-arjun",
      version: 2,
      status: "accepted",
      date: "28 Oct",
      lines: [
        { what: "Root canal treatment, molar", tooth: "36", qty: 1, feeInr: 9000 },
        { what: "Zirconia crown", tooth: "36", qty: 1, feeInr: 6000 },
      ],
      discountInr: 1500,
      discountNote: "Returning patient",
      signedBy: "Arjun Mehta",
    },
  ],
  files: [
    { name: "X-ray 36, before", kind: "X-ray", date: "28 Oct" },
    { name: "X-ray 36, working length", kind: "X-ray", date: "3 Nov" },
    { name: "Treatment plan v2 (signed)", kind: "PDF", date: "28 Oct" },
    { name: "Consent: root canal", kind: "PDF", date: "3 Nov" },
    { name: "Intraoral photo, lower left", kind: "Photo", date: "28 Oct" },
    { name: "Medical history form", kind: "PDF", date: "2023" },
  ],
  payments: [
    { date: "3 Nov", amountInr: 6000, mode: "UPI", ref: "R-2311-041" },
    { date: "28 Oct", amountInr: 3000, mode: "Card", ref: "R-2310-288" },
  ],
};

/** The lighter record every other patient gets. */
const basic = (s: PatientSummary): Omit<PatientDetail, keyof PatientSummary> => ({
  since: "2024",
  language: "English",
  address: "Bengaluru",
  referredBy: "Walk-in",
  alerts: [],
  consents: [
    { label: "Data use", ok: true },
    { label: "Reminders", ok: true },
    { label: "Marketing", ok: !s.flags.includes("consent_missing") },
  ],
  timeline: [
    ...(s.next && !s.next.tone ? [{ date: s.next.label, kind: "upcoming" as const, title: "Upcoming appointment", detail: "Booked at the front desk" }] : []),
    ...(s.lastVisit ? [{ date: `${s.lastVisit.date} · visit`, kind: "visit" as const, title: s.lastVisit.what, detail: "Note signed" }] : []),
  ],
  teeth: {},
  toothHistory: {},
  notes: [],
  plans: [],
  files: [],
  payments: [],
});

/* ---------------- in-memory changes ---------------- */

const amendments = new Map<string, Note["amendments"]>();
const extra: PatientSummary[] = [];
onReset.push(() => {
  amendments.clear();
  extra.length = 0;
});

const all = () => [...SUMMARIES.map((s) => ({ ...s, initials: initials(s.name) })), ...extra];
const digits = (s: string) => s.replace(/\D/g, "");

/* ---------------- API ---------------- */

export async function listPatients(clinicId: string, opts: { q?: string; filter?: Flag } = {}): Promise<PatientSummary[]> {
  requireClinic(clinicId);
  const q = opts.q?.trim().toLowerCase() ?? "";
  return all().filter((p) => {
    if (opts.filter && !p.flags.includes(opts.filter)) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.pid.toLowerCase().includes(q) || (digits(q) !== "" && digits(p.phone).includes(digits(q)));
  });
}

/** Pairs that look like the same person registered twice: same phone and date of birth. */
export async function findDuplicates(clinicId: string): Promise<[PatientSummary, PatientSummary][]> {
  requireClinic(clinicId);
  const list = all();
  return list.flatMap((a, i) => list.slice(i + 1).filter((b) => digits(a.phone) === digits(b.phone) && a.dob === b.dob).map((b) => [a, b] as [PatientSummary, PatientSummary]));
}

export async function getPatient(clinicId: string, id: string): Promise<PatientDetail | null> {
  requireClinic(clinicId);
  const s = all().find((p) => p.id === id);
  if (!s) return null;
  const rest = id === "p-arjun" ? ARJUN : basic(s);
  return { ...s, ...rest, notes: rest.notes.map((n) => ({ ...n, amendments: [...n.amendments, ...(amendments.get(n.id) ?? [])] })) };
}

/** Signed notes can't be edited: the change is added beneath the original, with who, when and why. */
export async function amendNote(clinicId: string, patientId: string, noteId: string, input: { text: string; reason: string; by: string }): Promise<Note> {
  const p = await getPatient(clinicId, patientId);
  const note = p?.notes.find((n) => n.id === noteId);
  if (!note) throw new Error("Note not found");
  if (!input.reason.trim()) throw new Error("Give a reason for the amendment");
  if (!input.text.trim()) throw new Error("Write the amendment");
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  amendments.set(noteId, [...(amendments.get(noteId) ?? []), { date: today, by: input.by, reason: input.reason.trim(), text: input.text.trim() }]);
  return { ...note, amendments: [...note.amendments, amendments.get(noteId)!.at(-1)!] };
}

export const planTotal = (plan: Plan) => plan.lines.reduce((n, l) => n + l.qty * l.feeInr, 0) - plan.discountInr;

export async function addPatient(clinicId: string, input: { name: string; phone: string; dob: string; sex: "F" | "M" }): Promise<PatientSummary> {
  requireClinic(clinicId);
  const name = input.name.trim();
  const d = digits(input.phone).replace(/^91(?=\d{10}$)/, "");
  if (!name) throw new Error("Enter the patient's name");
  if (d.length !== 10) throw new Error("Enter a 10-digit mobile number");
  const age = new Date().getFullYear() - Number(input.dob.slice(0, 4));
  const p: PatientSummary = {
    id: `p-new-${extra.length + 1}`,
    pid: `FMD-${String(1300 + extra.length).padStart(5, "0")}`,
    name,
    initials: initials(name),
    sex: input.sex,
    age: Number.isFinite(age) ? age : 0,
    phone: `+91 ${d.slice(0, 5)} ${d.slice(5)}`,
    dob: input.dob,
    balanceInr: 0,
    consent: { label: "To be signed", tone: "warn" },
    flags: ["consent_missing"],
  };
  extra.push(p);
  return p;
}
