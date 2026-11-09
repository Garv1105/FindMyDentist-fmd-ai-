/**
 * FMD AI companion tools (plan part 4.2, PDR §4.3): sample data until the backend has it. Proposed API:
 *   GET/PUT /me/budgets/{id}                        GET/PUT /me/insurance-checklist
 *   POST /assistant/tools/report-summary {record_id} → ReportSummary (labelled AI, with its limits)
 *   GET/POST/PATCH/DELETE /me/reminders             GET/PUT/DELETE /me/dental-history
 * Rules: estimates are never quotes; FMD can't confirm insurance cover; summaries never replace the dentist;
 * reminders are the person's own and imply no monitoring; dental history is kept only after they opt in.
 */
import { read, write } from "./store.ts";

const key = (what: string, userId: string) => `fmd-demo:${what}:${userId}`;
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

/* ---------------- treatment budget worksheet ---------------- */

export type BudgetLine = { id: string; label: string; amount: number; qty: number };
export type Budget = { lines: BudgetLine[]; discount: number; insurance: number; source: string | null };
export const EMPTY_BUDGET: Budget = { lines: [], discount: 0, insurance: 0, source: null };

export function totals(b: Budget) {
  const subtotal = b.lines.reduce((n, l) => n + Math.max(0, l.amount) * Math.max(1, l.qty), 0);
  const discount = Math.min(Math.max(0, b.discount), subtotal);
  const insurance = Math.min(Math.max(0, b.insurance), subtotal - discount);
  return { subtotal, discount, insurance, you: subtotal - discount - insurance };
}

export async function getBudget(userId: string): Promise<Budget> {
  return read<Budget>(key("budget", userId)) ?? EMPTY_BUDGET;
}
export async function saveBudget(userId: string, b: Budget) {
  if (b.lines.some((l) => !l.label.trim() || !(l.amount >= 0) || !(l.qty >= 1))) throw new Error("Each line needs a name, an amount of ₹0 or more, and a quantity of at least 1.");
  write(key("budget", userId), b);
}
export const newLine = (label = "", amount = 0): BudgetLine => ({ id: newId("l"), label, amount, qty: 1 });

/** A spreadsheet-friendly copy, with the estimate label in it. */
export function budgetCsv(b: Budget) {
  const t = totals(b);
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  return [
    "Item,Quantity,Amount (INR),Line total (INR)",
    ...b.lines.map((l) => [esc(l.label), l.qty, l.amount, l.amount * l.qty].join(",")),
    `Subtotal,,,${t.subtotal}`,
    `Discount,,,-${t.discount}`,
    `Expected from insurance,,,-${t.insurance}`,
    `You may pay,,,${t.you}`,
    esc("Estimate, not a quote. Your dentist and insurer confirm the actual amounts."),
  ].join("\n");
}

/* ---------------- insurance explainer ---------------- */

/** What a dental claim usually needs. General guidance: the insurer's own list always wins. */
export const CLAIM_CHECKLIST = [
  "Your policy number and the insured person's ID",
  "The claim form from your insurer, filled in and signed",
  "The clinic's itemised invoice and payment receipts",
  "The dentist's treatment notes or a treatment summary",
  "X-rays or reports, if the insurer asks for them",
  "Your bank details for the payout (a cancelled cheque, if asked)",
];
export const POLICY_TERMS: [string, string][] = [
  ["Waiting period", "Time after buying the policy before certain treatments are covered."],
  ["Sub-limit", "The most the policy pays for one kind of treatment, like dental, even if the total cover is higher."],
  ["Co-pay", "The share of each bill you always pay yourself, often a percentage."],
  ["Exclusions", "What the policy never pays for. Cosmetic dental work is often excluded."],
  ["Cashless vs reimbursement", "Cashless: the insurer pays a network clinic directly. Reimbursement: you pay, then claim."],
];
export async function getChecklist(userId: string): Promise<boolean[]> {
  return read<boolean[]>(key("claim-checklist", userId)) ?? CLAIM_CHECKLIST.map(() => false);
}
export async function saveChecklist(userId: string, ticks: boolean[]) {
  write(key("claim-checklist", userId), ticks);
}

/* ---------------- report summaries ---------------- */

export type ReportSummary = { points: string[]; questions: string[]; limits: string };

/** Plain-language summaries of the demo clinic's documents (their text is known). Anything else can't be read in the
 *  demo, and says so rather than guessing. */
const SUMMARIES: Record<string, ReportSummary> = {
  "rec-summary": {
    points: [
      "You went in with pain when chewing on the lower left, for about 2 weeks.",
      "The dentist found deep decay in one back tooth on the lower left (the first molar, numbered 36) that reaches the nerve.",
      "They advised a root canal treatment on that tooth, then a crown to protect it.",
    ],
    questions: ["How many visits will the root canal take?", "What happens if I wait?", "Do I need the crown straight away?"],
    limits: "This explains the words in the report. It isn't a second opinion and may miss things only an examination shows.",
  },
  "rec-plan": {
    points: ["Version 2 of the plan: root canal treatment on tooth 36, then a tooth-coloured (zirconia) crown.", "The estimate is ₹13,500 in total, and the dentist confirms the cost at each visit."],
    questions: ["Is the crown needed, or are there other options?", "What's included if something needs redoing?"],
    limits: "The plan is the clinic's estimate. Treatment and costs can change after examination.",
  },
};
export async function summarise(recordId: string): Promise<ReportSummary | null> {
  return SUMMARIES[recordId] ?? null;
}

/* ---------------- reminders ---------------- */

export type Reminder = { id: string; title: string; every: "day" | "days" | "once"; days: number; time: string; date: string | null; on: boolean };
export const TEMPLATES: Omit<Reminder, "id" | "on">[] = [
  { title: "Brush for 2 minutes", every: "day", days: 1, time: "21:30", date: null },
  { title: "Clean between teeth (floss or interdental brush)", every: "day", days: 1, time: "21:35", date: null },
  { title: "Change to the next aligner", every: "days", days: 14, time: "20:00", date: null },
  { title: "Soft food only after your treatment", every: "once", days: 0, time: "09:00", date: null },
  { title: "Book a check-up", every: "once", days: 0, time: "10:00", date: null },
];

export function checkReminder(r: Omit<Reminder, "id" | "on">, today: string): string | null {
  if (!r.title.trim()) return "Give the reminder a name.";
  if (!/^\d{2}:\d{2}$/.test(r.time)) return "Choose a time.";
  if (r.every === "days" && !(Number.isInteger(r.days) && r.days >= 2 && r.days <= 90)) return "Repeat every 2 to 90 days.";
  if (r.every === "once" && (!r.date || r.date < today)) return "Choose a date from today on.";
  return null;
}
export async function listReminders(userId: string): Promise<Reminder[]> {
  return read<Reminder[]>(key("reminders", userId)) ?? [];
}
export async function addReminder(userId: string, r: Omit<Reminder, "id" | "on">, today: string): Promise<Reminder[]> {
  const bad = checkReminder(r, today);
  if (bad) throw new Error(bad);
  const all = [...(await listReminders(userId)), { ...r, title: r.title.trim(), id: newId("r"), on: true }];
  write(key("reminders", userId), all);
  return all;
}
export async function updateReminder(userId: string, id: string, patch: Partial<Reminder>) {
  const all = (await listReminders(userId)).map((r) => (r.id === id ? { ...r, ...patch } : r));
  write(key("reminders", userId), all);
  return all;
}
export async function deleteReminder(userId: string, id: string) {
  const all = (await listReminders(userId)).filter((r) => r.id !== id);
  write(key("reminders", userId), all);
  return all;
}

/* ---------------- dental history ---------------- */

export type DentalHistory = {
  treatments: { id: string; what: string; when: string; where: string }[];
  allergies: string;
  medicines: string;
  conditions: string[];
  preferences: string;
};
export const CONDITIONS = ["Diabetes", "Heart condition", "High blood pressure", "Bleeding disorder or blood thinners", "Pregnancy", "Asthma"];
export const EMPTY_HISTORY: DentalHistory = { treatments: [], allergies: "", medicines: "", conditions: [], preferences: "" };

/** null until the person chooses to keep a history */
export async function getHistory(userId: string): Promise<DentalHistory | null> {
  return read<DentalHistory>(key("dental-history", userId));
}
export async function saveHistory(userId: string, h: DentalHistory) {
  if (h.treatments.some((t) => !t.what.trim())) throw new Error("Each past treatment needs a name.");
  write(key("dental-history", userId), h);
}
/** deleting is complete: nothing is kept */
export async function deleteHistory(userId: string) {
  write(key("dental-history", userId), null);
}
export const newTreatment = () => ({ id: newId("t"), what: "", when: "", where: "" });
