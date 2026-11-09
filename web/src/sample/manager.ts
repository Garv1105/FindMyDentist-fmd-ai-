/**
 * FMD Clinic AI manager sample data (roadmap C5): chat, the approval queue (the same AI tasks Home shows), history,
 * scheduled jobs and content drafts. The rule everywhere: FMD Manager drafts and prepares; anything that leaves the
 * clinic (a message, a post, a review reply) waits for a person to approve it. Nothing here is ever sent.
 */
import { getClinicHome, onReset, requireClinic, type AiTask } from "./clinic.ts";
import { metric } from "./reports.ts";

export type HistoryItem = { id: string; at: string; what: string; by: string; outcome: "approved" | "skipped" | "done" | "edited" };
export type Scheduled = { id: string; title: string; when: string; what: string; needsApproval: boolean; on: boolean };
export type Draft = { id: string; kind: "Instagram post" | "Google review reply" | "WhatsApp broadcast" | "Blog post"; title: string; body: string; status: "draft" | "approved" | "discarded" };
export type ChatMessage = { from: "you" | "ai"; text: string; at: string };

const SCHEDULED: Scheduled[] = [
  { id: "s-paysheet", title: "Daily payment sheet", when: "Every day, 8:30 am", what: "Totals yesterday's bills by payment mode and flags anything missing.", needsApproval: false, on: true },
  { id: "s-reminders", title: "Appointment reminders", when: "Every day, 6:00 pm", what: "Drafts WhatsApp reminders for tomorrow's unconfirmed patients.", needsApproval: true, on: true },
  { id: "s-recall", title: "Recall list", when: "Mondays, 9:00 am", what: "Lists patients whose 6-month check is due and drafts recall messages.", needsApproval: true, on: true },
  { id: "s-reviews", title: "Review replies", when: "When a new Google review arrives", what: "Drafts a polite reply; you edit and post it.", needsApproval: true, on: false },
  { id: "s-weekly", title: "Weekly summary", when: "Saturdays, 7:00 pm", what: "Totals only: visits, no-shows, revenue, new patients. No patient names.", needsApproval: false, on: true },
];

const DRAFTS: Draft[] = [
  {
    id: "d-insta",
    kind: "Instagram post",
    title: "Why 6-monthly cleanings matter",
    body: "Plaque hardens into tartar in weeks, and brushing can't remove it. A 20-minute scaling every six months keeps gums healthy and catches small problems early. Book on FMD or call us. #SmileStudio #Indiranagar",
    status: "draft",
  },
  {
    id: "d-review",
    kind: "Google review reply",
    title: "Reply to Rohan G. (5 ★)",
    body: "Thank you, Rohan! We're glad the cleaning was comfortable. See you at your next check-up. Team Smile Studio",
    status: "draft",
  },
  {
    id: "d-broadcast",
    kind: "WhatsApp broadcast",
    title: "Diwali hours",
    body: "Smile Studio Dental will be closed on 1 Nov for Diwali and open as usual from 2 Nov. Wishing you and your family a happy Diwali!",
    status: "draft",
  },
];

const HISTORY: HistoryItem[] = [
  { id: "h1", at: "Yesterday, 6:05 pm", what: "Sent 4 appointment reminders (WhatsApp)", by: "Approved by Kavya Menon", outcome: "approved" },
  { id: "h2", at: "Yesterday, 8:30 am", what: "Prepared the daily payment sheet", by: "Ran on schedule", outcome: "done" },
  { id: "h3", at: "8 Nov, 11:20 am", what: "Drafted a reply to a 3 ★ review", by: "Edited, then approved by Dr. Ananya Rao", outcome: "edited" },
  { id: "h4", at: "7 Nov, 9:00 am", what: "Recall messages to 6 patients", by: "Skipped by Dr. Ananya Rao", outcome: "skipped" },
];

/* in-memory changes, reset with the rest of the sample */
const scheduleOn = new Map<string, boolean>();
const draftState = new Map<string, Draft["status"]>();
const draftBody = new Map<string, string>();
const history: HistoryItem[] = [];
const chats: ChatMessage[] = [];
onReset.push(() => {
  scheduleOn.clear();
  draftState.clear();
  draftBody.clear();
  history.length = 0;
  chats.length = 0;
});

const nowLabel = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 16);

export async function getManager(clinicId: string, opts: { branchId: string; date: string }) {
  requireClinic(clinicId);
  const home = await getClinicHome(clinicId, opts);
  return {
    queue: home.tasks,
    scheduled: SCHEDULED.map((s) => ({ ...s, on: scheduleOn.get(s.id) ?? s.on })),
    drafts: DRAFTS.map((d) => ({ ...d, status: draftState.get(d.id) ?? d.status, body: draftBody.get(d.id) ?? d.body })),
    history: [...history, ...HISTORY],
    chat: [...chats],
  };
}

/** Records an approval-queue decision in the history (the decision itself goes through clinic.ts decideAiTask). */
export function logDecision(task: AiTask, by: string) {
  if (task.status !== "approved" && task.status !== "skipped") return;
  history.unshift({ id: `h-${task.id}-${history.length}`, at: `Today, ${nowLabel()}`, what: task.title, by: `${task.status === "approved" ? "Approved" : "Skipped"} by ${by}`, outcome: task.status });
}

export async function toggleScheduled(clinicId: string, id: string) {
  requireClinic(clinicId);
  const s = SCHEDULED.find((x) => x.id === id);
  if (!s) throw new Error("Scheduled task not found");
  scheduleOn.set(id, !(scheduleOn.get(id) ?? s.on));
}

export async function setDraft(clinicId: string, id: string, change: { status?: Draft["status"]; body?: string }, by: string) {
  requireClinic(clinicId);
  const d = DRAFTS.find((x) => x.id === id);
  if (!d) throw new Error("Draft not found");
  if (change.body !== undefined) draftBody.set(id, change.body.trim());
  if (change.status) {
    draftState.set(id, change.status);
    if (change.status === "approved") history.unshift({ id: `h-${id}`, at: `Today, ${nowLabel()}`, what: `${d.kind}: ${d.title} (ready to post)`, by: `Approved by ${by}`, outcome: draftBody.has(id) ? "edited" : "approved" });
  }
}

/**
 * The chat answers from the clinic's own figures (the same METRICS the reports use), so it never invents a number.
 * shortcut: keyword matching over a few questions; the real assistant uses the AI adapter with these as tools.
 */
export async function ask(clinicId: string, question: string, opts: { branchId: string; today: string }): Promise<ChatMessage> {
  requireClinic(clinicId);
  const q = question.toLowerCase();
  const week = { from: shift(opts.today, -6), to: opts.today, branchId: opts.branchId };
  const month = { from: `${opts.today.slice(0, 8)}01`, to: opts.today, branchId: opts.branchId };
  let text: string;
  if (/no.?show/.test(q)) {
    const m = await metric(clinicId, "noShowRate", week);
    text = m.value === null ? "No visits were due in the last 7 days." : `In the last 7 days the no-show rate was ${m.value}% (${m.numerator} of ${m.denominator}). The No-shows report shows who and why.`;
  } else if (/revenue|collect|earn|money/.test(q)) {
    const m = await metric(clinicId, "netRevenue", month);
    text = `Net revenue this month so far is ₹${(m.value ?? 0).toLocaleString("en-IN")} (paid bills, after discounts, without GST).`;
  } else if (/new patient/.test(q)) {
    const m = await metric(clinicId, "newPatients", month);
    text = `${m.value ?? 0} new patients this month so far. New by source in Reports shows where they came from.`;
  } else if (/recall|overdue/.test(q)) {
    const m = await metric(clinicId, "recallOverdue", month);
    text = `${m.value ?? 0} recalls are overdue. I can draft recall messages; you approve them before anything is sent.`;
  } else if (/utili[sz]ation|busy|chair/.test(q)) {
    const m = await metric(clinicId, "chairUtilisation", week);
    text = m.value === null ? "No open hours in the last 7 days." : `Chairs were ${m.value}% used in the last 7 days.`;
  } else if (/remind|message|whatsapp|send/.test(q)) {
    text = "I can draft that. It will appear in the approval queue, and nothing is sent until someone approves it.";
  } else if (/diagnos|prescri|medicine|treat/.test(q)) {
    text = "I can't advise on diagnosis or treatment; that stays with your dentists. I can help with the schedule, reminders, recalls and reports.";
  } else {
    text = "I can answer questions about no-shows, revenue, new patients, recalls and chair use, and draft reminders or recall messages for your approval.";
  }
  const at = nowLabel();
  chats.push({ from: "you", text: question.trim(), at }, { from: "ai", text, at });
  return { from: "ai", text, at };
}

const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
