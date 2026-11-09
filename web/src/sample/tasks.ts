/**
 * FMD Clinic tasks sample data (roadmap C4): staff tasks, the opening and closing checklists, and shift handover
 * notes. Follow-ups stay in clinic.ts (Home shows them too). In memory; resets on reload.
 */
import { onReset, requireClinic } from "./clinic.ts";

export type Task = { id: string; title: string; assignee: string; due: "overdue" | "today" | "this week"; done: boolean; fromAi?: boolean };
export type Handover = { id: string; at: string; by: string; text: string };

const TASKS: Task[] = [
  { id: "k-lab", title: "Chase the lab: Lakshmi Narayan's crown (due Thursday)", assignee: "Kavya Menon", due: "today", done: false },
  { id: "k-xray", title: "Calibrate the X-ray sensor", assignee: "Meera (hygienist)", due: "this week", done: false },
  { id: "k-consent", title: "Get Vikram Patel's extraction consent signed before 12:00", assignee: "Kavya Menon", due: "today", done: false, fromAi: true },
  { id: "k-stock", title: "Order gloves (medium) from the usual supplier", assignee: "Kavya Menon", due: "overdue", done: false },
  { id: "k-notes", title: "Sign 2 clinical notes from yesterday", assignee: "Dr. Karthik Iyer", due: "today", done: false },
  { id: "k-review", title: "Reply to the 3 ★ review (draft ready in AI manager)", assignee: "Dr. Ananya Rao", due: "this week", done: false, fromAi: true },
];

export const CHECKLISTS: Record<"opening" | "closing", string[]> = {
  opening: ["Autoclave cycle run and logged", "Chairs and suction checked", "Today's unconfirmed patients called", "Cash float counted", "Emergency kit and oxygen checked"],
  closing: ["Cash counted and the collection sheet signed off", "All completed visits billed", "Instruments in the autoclave", "Tomorrow's first patients confirmed", "Compressor and suction switched off"],
};

const HANDOVERS: Handover[] = [
  { id: "ho-1", at: "Yesterday, 7:05 pm", by: "Kavya Menon", text: "Arjun Mehta asked to move his root canal to after 5 pm if anything opens up. The card machine needed a restart twice." },
  { id: "ho-2", at: "Yesterday, 1:10 pm", by: "Meera (hygienist)", text: "Chair 3 suction is weak; the technician comes Wednesday morning." },
];

const done = new Map<string, boolean>();
const added: Task[] = [];
const ticks = new Map<string, Set<string>>(); // `${date}|${list}` → ticked items
const notes: Handover[] = [];
onReset.push(() => {
  done.clear();
  added.length = 0;
  ticks.clear();
  notes.length = 0;
});

export async function getTasks(clinicId: string, date: string) {
  requireClinic(clinicId);
  return {
    tasks: [...added, ...TASKS].map((t) => ({ ...t, done: done.get(t.id) ?? t.done })),
    checklists: (["opening", "closing"] as const).map((list) => ({ list, items: CHECKLISTS[list].map((item) => ({ item, ticked: ticks.get(`${date}|${list}`)?.has(item) ?? false })) })),
    handovers: [...notes, ...HANDOVERS],
  };
}

export async function toggleTask(clinicId: string, id: string) {
  requireClinic(clinicId);
  const t = [...added, ...TASKS].find((x) => x.id === id);
  if (!t) throw new Error("Task not found");
  done.set(id, !(done.get(id) ?? t.done));
}

export async function addTask(clinicId: string, input: { title: string; assignee: string; due: Task["due"] }) {
  requireClinic(clinicId);
  if (!input.title.trim()) throw new Error("Say what needs doing");
  const t: Task = { id: `k-new-${added.length + 1}`, title: input.title.trim(), assignee: input.assignee, due: input.due, done: false };
  added.unshift(t);
  return t;
}

export async function tick(clinicId: string, date: string, list: "opening" | "closing", item: string) {
  requireClinic(clinicId);
  if (!CHECKLISTS[list].includes(item)) throw new Error("Not on the checklist");
  const key = `${date}|${list}`;
  const set = ticks.get(key) ?? new Set<string>();
  if (set.has(item)) set.delete(item);
  else set.add(item);
  ticks.set(key, set);
}

export async function addHandover(clinicId: string, text: string, by: string) {
  requireClinic(clinicId);
  if (!text.trim()) throw new Error("Write the handover note first");
  const at = `Today, ${new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 16)}`;
  notes.unshift({ id: `ho-new-${notes.length + 1}`, at, by, text: text.trim() });
}
