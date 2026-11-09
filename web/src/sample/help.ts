/**
 * Help centre and support tickets (plan part 9.2, PDR §10, Annex H): sample data until the backend has it.
 * Proposed API:
 *   GET  /help/articles?q&topic · GET /help/articles/{slug}
 *   POST /support/tickets {topic, subject, body, context, attachment_id?} · GET /me/tickets · GET /support/tickets/{id}
 *   POST /support/tickets/{id}/messages {text} · POST /support/tickets/{id}/reopen
 * Rules: support never needs your health details; screenshots are optional and you're asked to hide personal
 * information first. Tickets show their status, every reply, and can be reopened.
 */
import { read, write } from "./store.ts";

export const TOPICS = { account: "Account and sign-in", booking: "Booking and appointments", records: "Records and sharing", payments: "Payments and membership", ai: "FMD AI", privacy: "Privacy and data" } as const;
export type Topic = keyof typeof TOPICS;

export type Article = { slug: string; topic: Topic; title: string; body: string[] };
export const ARTICLES: Article[] = [
  { slug: "reset-password", topic: "account", title: "I forgot my password", body: ["On the log-in page, choose “Forgot password?”. Enter your mobile number or verified email, and we'll send a code.", "After you set a new password, you're signed out on every device, to keep your account safe."] },
  { slug: "two-step", topic: "account", title: "What is two-step verification?", body: ["When it's on, logging in with your password also needs a code we text you. Turn it on in Account.", "Lost your phone? Contact support and we'll help you back in."] },
  { slug: "change-booking", topic: "booking", title: "How do I change or cancel an appointment?", body: ["Open My appointments, choose the visit, then “Change time” or “Cancel appointment”.", "It's free to change or cancel up to 4 hours before. After that the clinic may charge (demo terms)."] },
  { slug: "clinic-confirm", topic: "booking", title: "Why does it say “the clinic will confirm a time”?", body: ["Some clinics haven't connected their calendar to FMD. You choose a day and part of the day, and the clinic sets an exact time, usually within a day."] },
  { slug: "share-records", topic: "records", title: "How do I share records with a new dentist?", body: ["In Records, choose Share, pick the dentist or clinic, tick the records and how long they can see them.", "You can stop sharing at any time, and each record's history shows who opened it."] },
  { slug: "upload-limits", topic: "records", title: "Which files can I upload?", body: ["PDF, JPG, PNG or WebP, up to 20 MB each, and 100 MB in total.", "Taking a photo of a printed report works too."] },
  { slug: "payment-failed", topic: "payments", title: "My payment failed but money left my account", body: ["A failed payment never completes. If your bank shows a charge, it's reversed automatically within 5–7 working days.", "If it isn't, contact support with the payment reference from Payments and receipts."] },
  { slug: "membership-cancel", topic: "payments", title: "How do I cancel my membership?", body: ["In Membership, choose “Cancel membership”. Within 7 days of your first payment you get a full refund; after that it runs to its end date (demo terms)."] },
  { slug: "ai-not-diagnosis", topic: "ai", title: "Can FMD AI tell me what's wrong?", body: ["No. FMD AI explains dental topics in plain words and helps you find the right care, but only a dentist can examine you and diagnose.", "For swelling spreading to your eye or neck, trouble breathing or swallowing, or heavy bleeding, call 112."] },
  { slug: "ai-history", topic: "ai", title: "Are my FMD AI chats saved?", body: ["Only if you turn on “Save my FMD AI conversations” in Privacy and data. You can delete any chat, or all of them."] },
  { slug: "download-data", topic: "privacy", title: "How do I get a copy of my data?", body: ["In Privacy and data, choose “Prepare my data”. When it's ready you can download it for 7 days."] },
  { slug: "delete-account", topic: "privacy", title: "How do I delete my account?", body: ["In Privacy and data, choose “Delete my account”. We explain what's deleted and what the law makes us keep, then confirm with a code."] },
];

export function searchArticles(q: string, topic?: string) {
  const t = q.trim().toLowerCase();
  return ARTICLES.filter((a) => (!topic || a.topic === topic) && (!t || `${a.title} ${a.body.join(" ")}`.toLowerCase().includes(t)));
}

/* ---------------- tickets ---------------- */

export type Ticket = {
  id: string;
  topic: Topic;
  subject: string;
  context: string | null;
  attachment: string | null;
  status: "open" | "in_progress" | "resolved" | "reopened";
  created_at: string;
  messages: { from: "you" | "support"; text: string; at: string }[];
};
export const TICKET_STATUS: Record<Ticket["status"], string> = { open: "Received", in_progress: "We're on it", resolved: "Resolved", reopened: "Reopened" };

const key = (userId: string) => `fmd-demo:tickets:${userId}`;
const iso = (t: number) => new Date(t).toISOString();
/** demo: support replies this long after a ticket is raised or reopened */
export const REPLY_MS = 15_000;

export function checkTicket(t: { topic: string; subject: string; body: string; attachment: { type: string; size: number } | null }): string | null {
  if (!(t.topic in TOPICS)) return "Choose what it's about.";
  if (t.subject.trim().length < 4) return "Give it a short title.";
  if (t.body.trim().length < 10) return "Describe what happened in a sentence or two.";
  if (t.attachment && (!t.attachment.type.startsWith("image/") || t.attachment.size > 5 * 1024 * 1024)) return "Attach a screenshot (an image under 5 MB).";
  return null;
}

/** Moves demo tickets along: support picks it up, replies, then resolves it. */
function advance(t: Ticket, now: number): Ticket {
  const last = Date.parse(t.messages.filter((m) => m.from === "you").at(-1)!.at);
  if ((t.status === "open" || t.status === "reopened") && now - last >= REPLY_MS)
    return { ...t, status: "in_progress", messages: [...t.messages, { from: "support", text: "Thanks for writing in. I'm looking into this now and will update you here.", at: iso(last + REPLY_MS) }] };
  if (t.status === "in_progress" && now - last >= 2 * REPLY_MS)
    return { ...t, status: "resolved", messages: [...t.messages, { from: "support", text: "This should be sorted now. If it isn't, reopen this ticket and tell us what you see.", at: iso(last + 2 * REPLY_MS) }] };
  return t;
}

export async function listTickets(userId: string, now = Date.now()): Promise<Ticket[]> {
  const all = (read<Ticket[]>(key(userId)) ?? []).map((t) => advance(advance(t, now), now));
  write(key(userId), all);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function getTicket(userId: string, id: string, now = Date.now()) {
  return (await listTickets(userId, now)).find((t) => t.id === id) ?? null;
}

export async function raiseTicket(userId: string, t: { topic: string; subject: string; body: string; context: string | null; attachment: { name: string; type: string; size: number } | null }, now = Date.now()) {
  const bad = checkTicket(t);
  if (bad) throw new Error(bad);
  const ticket: Ticket = {
    id: `T-${now.toString(36).slice(-5).toUpperCase()}`,
    topic: t.topic as Topic,
    subject: t.subject.trim(),
    context: t.context,
    attachment: t.attachment?.name ?? null,
    status: "open",
    created_at: iso(now),
    messages: [{ from: "you", text: t.body.trim(), at: iso(now) }],
  };
  write(key(userId), [...(read<Ticket[]>(key(userId)) ?? []), ticket]);
  return ticket;
}

async function update(userId: string, id: string, fn: (t: Ticket) => Ticket, now: number) {
  const all = await listTickets(userId, now);
  const t = all.find((x) => x.id === id);
  if (!t) throw new Error("We couldn't find that ticket.");
  const next = fn(t);
  write(key(userId), all.map((x) => (x.id === id ? next : x)));
  return next;
}

export async function replyTicket(userId: string, id: string, text: string, now = Date.now()) {
  if (!text.trim()) throw new Error("Write a message first.");
  return update(userId, id, (t) => {
    if (t.status === "resolved") throw new Error("This ticket is resolved. Reopen it to write again.");
    return { ...t, messages: [...t.messages, { from: "you", text: text.trim(), at: iso(now) }] };
  }, now);
}

export async function reopenTicket(userId: string, id: string, why: string, now = Date.now()) {
  if (!why.trim()) throw new Error("Tell us what's still wrong.");
  return update(userId, id, (t) => ({ ...t, status: "reopened", messages: [...t.messages, { from: "you", text: why.trim(), at: iso(now) }] }), now);
}
