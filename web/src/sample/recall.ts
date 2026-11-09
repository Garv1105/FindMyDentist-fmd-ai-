/**
 * Recalls (6-month check), from the patient roster so they agree with the patient-base report: regulars (still coming)
 * fall due every 6 months from their first visit and mostly come back; patients with a last visit fall due 6 months
 * after it and, since nothing is booked after a last visit, stay open (due, overdue, contacted or opted out).
 */
import { CHAIRS } from "./clinic.ts";
import { hash, roster, type Person } from "./people.ts";

export const CHANNELS = ["WhatsApp", "SMS", "Phone call"] as const;
export type RecallStatus = "due" | "overdue" | "contacted" | "completed" | "opted_out";
export type Recall = {
  id: string;
  branchId: string;
  name: string;
  due: string;
  status: RecallStatus;
  channel?: (typeof CHANNELS)[number];
  attempts: number;
  /** completed: contacted before booking (counts towards conversion) */
  viaContact: boolean;
};

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.toISOString().slice(0, 8)}${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Every recall falling due between `from` and `to` (inclusive), as of `today`. */
export function recallsBetween(branchId: string, from: string, to: string, today: string): Recall[] {
  const ids = branchId === "all" ? Object.keys(CHAIRS) : [branchId];
  const out: Recall[] = [];
  for (const b of ids)
    for (const p of roster(b, today)) for (const due of duesOf(p, from, to)) out.push(recallOf(p, due, today));
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

function duesOf(p: Person, from: string, to: string): string[] {
  if (p.last !== null) {
    const due = addMonths(p.last, 6);
    return due >= from && due <= to ? [due] : [];
  }
  const out: string[] = [];
  for (let k = 1; k < 40; k++) {
    const due = addMonths(p.first, 6 * k);
    if (due > to) break;
    if (due >= from) out.push(due);
  }
  return out;
}

function recallOf(p: Person, due: string, today: string): Recall {
  const h = (t: string) => hash(`${p.id}-${due}-${t}`);
  const base = { id: `${p.id}-${due}`, branchId: p.branchId, name: p.name, due, attempts: 0, viaContact: false };
  const channel = CHANNELS[h("ch") % CHANNELS.length];
  if (h("opt") % 100 < 5) return { ...base, status: "opted_out" };
  if (due > today) return { ...base, status: "due" };
  // regulars come back; the attended visit counts if it is within 30 days of the due date
  if (p.last === null && addDays(due, 30) <= today && h("done") % 100 < 85) {
    const viaContact = h("vc") % 100 < 70;
    return { ...base, status: "completed", viaContact, ...(viaContact ? { channel, attempts: 1 + (h("att") % 2) } : {}) };
  }
  if (h("con") % 100 < 45) return { ...base, status: "contacted", channel, attempts: 1 + (h("att") % 3) };
  return { ...base, status: "overdue" };
}

/** Days from the due date to `today` (overdue only). */
export const daysOverdue = (r: Recall, today: string) => Math.round((Date.parse(today) - Date.parse(r.due)) / 86_400_000);
