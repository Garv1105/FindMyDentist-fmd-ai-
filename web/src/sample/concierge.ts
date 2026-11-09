/**
 * FMD Edge (Concierge) requests and their status (plan part 6.1, PDR §5, §15, §18): sample data until the backend has
 * it. The live homepage form posts to /api/concierge/enquiries, which emails the FMD team; the demo pages never do.
 * Proposed API:
 *   GET  /concierge/config → {areas, needs, timings, contact_methods, response_note}
 *   POST /concierge/enquiries → Enquiry (422 with checkEnquiry's messages)
 *   GET  /me/concierge/enquiries · GET /concierge/enquiries/{ref}
 *   POST /concierge/enquiries/{ref}/messages {text} · POST /concierge/enquiries/{ref}/cancel
 *   POST /concierge/enquiries/{ref}/proposals/{id}/respond {accept}
 * Rules: ask only for what coordination needs, not medical history. Nothing (clinic, fee, transport, plan) is final
 * until the person accepts it. FMD coordinates; dentists treat. No promise of a 24/7 service.
 */
import { CONCIERGE } from "../lib/concierge.ts";
import { read, write } from "./store.ts";

/** Where the demo pretends FMD Edge runs. The real list is an open decision (plan D4). */
export const AREAS = ["Bengaluru", "Mumbai", "Hyderabad"];
export const NEEDS = CONCIERGE.needs;
export const TIMINGS = CONCIERGE.timings;
export const METHODS = { phone: "Phone call", whatsapp: "WhatsApp", email: "Email" } as const;
export type Method = keyof typeof METHODS;
/** "by …" in a sentence: WhatsApp keeps its capitals */
export const BY: Record<Method, string> = { phone: "phone", whatsapp: "WhatsApp", email: "email" };
export const BEST_TIMES = ["Morning", "Afternoon", "Evening", "Any time"];

export type Status = "new" | "contact_attempted" | "contacted" | "needs_clarification" | "coordinating" | "awaiting_you" | "confirmed" | "closed" | "cancelled";
export const STATUS: Record<Status, string> = {
  new: "Received",
  contact_attempted: "We tried to reach you",
  contacted: "In touch",
  needs_clarification: "We need a detail from you",
  coordinating: "Arranging options",
  awaiting_you: "Waiting for your answer",
  confirmed: "Confirmed",
  closed: "Closed",
  cancelled: "Cancelled",
};

export type Proposal = { id: string; kind: "clinic" | "fee" | "transport" | "plan"; title: string; detail: string; status: "pending" | "accepted" | "declined"; responded_at: string | null };
export type Enquiry = {
  ref: string;
  created_at: string;
  need: string;
  area: string;
  timing: string;
  contact: { method: Method; value: string; best_time: string };
  notes: string | null;
  status: Status;
  events: { at: string; status: Status; by: "you" | "coordinator"; note?: string }[];
  messages: { at: string; from: "you" | "coordinator"; text: string }[];
  proposals: Proposal[];
};
export type Input = { need: string; area: string; timing: string; method: Method; value: string; best_time: string; notes: string; consent: boolean };

const key = (userId: string) => `fmd-demo:edge:${userId}`;
const iso = (t: number) => new Date(t).toISOString();
const COORD = "Asha, your FMD Edge coordinator";

/** The first problem with a request, or null. */
export function checkEnquiry(i: Input): string | null {
  if (!NEEDS.includes(i.need)) return "Choose what you need help with.";
  if (!i.area.trim()) return "Tell us your area or city.";
  if (!TIMINGS.includes(i.timing)) return "Choose when you'd like help.";
  if (i.method === "email" ? !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim()) : !/^(\+91)?[6-9]\d{9}$/.test(i.value.replace(/[\s-]/g, "")))
    return i.method === "email" ? "Enter an email address we can reach you on." : "Enter a 10-digit Indian mobile number.";
  if (i.notes.length > 500) return "Keep the note under 500 characters.";
  if (!i.consent) return "Agree to FMD Edge contacting you about this request.";
  return null;
}

/* ---------------- the demo coordinator ---------------- */

/** Demo pacing: each step of a coordinator's work, this long after the request. */
export const STEP_MS = 12_000;

/**
 * Moves a demo request along as time passes, the way a coordinator would: try to call, get in touch, arrange options,
 * then ask the person to choose. Stops at anything waiting for the person, and never decides for them.
 */
function advance(e: Enquiry, now: number): Enquiry {
  if (["confirmed", "closed", "cancelled", "awaiting_you"].includes(e.status)) return e;
  const since = now - Date.parse(e.created_at);
  const at = (n: number) => iso(Date.parse(e.created_at) + n * STEP_MS);
  const x = { ...e, events: [...e.events], messages: [...e.messages], proposals: [...e.proposals] };
  const to = (status: Status, n: number, note?: string) => {
    if (x.events.some((v) => v.status === status)) return;
    x.status = status;
    x.events.push({ at: at(n), status, by: "coordinator", ...(note ? { note } : {}) });
  };
  if (since >= STEP_MS) to("contact_attempted", 1, `We tried you by ${BY[e.contact.method]} and couldn't get through. We'll try again.`);
  if (since >= 2 * STEP_MS && !x.events.some((v) => v.status === "contacted")) {
    to("contacted", 2);
    x.messages.push({ at: at(2), from: "coordinator", text: `Hi, this is ${COORD.split(",")[0]} from FMD Edge. Thanks for your request about “${e.need}”. I'm looking at verified dentists in ${e.area} who can see you ${e.timing.toLowerCase()}.` });
  }
  if (since >= 3 * STEP_MS) to("coordinating", 3);
  if (since >= 4 * STEP_MS && !x.proposals.length) {
    x.proposals.push(
      { id: "pr-clinic", kind: "clinic", title: "Dr. Sneha Iyer, Demo Implant Centre, Jayanagar", detail: "Consultation on Thursday at 11:00 am. Verified implantologist, 14 years of experience.", status: "pending", responded_at: null },
      { id: "pr-fee", kind: "fee", title: "Consultation fee ₹800–₹1,000", detail: "Paid at the clinic. FMD Edge doesn't add a charge for this demo. Treatment costs are confirmed by the dentist.", status: "pending", responded_at: null },
    );
    to("awaiting_you", 4, "Two things to approve. Nothing is booked until you say yes.");
  }
  return x;
}

/* ---------------- requests ---------------- */

export async function listEnquiries(userId: string, now = Date.now()): Promise<Enquiry[]> {
  const all = (read<Enquiry[]>(key(userId)) ?? []).map((e) => advance(e, now));
  write(key(userId), all);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getEnquiry(userId: string, ref: string, now = Date.now()) {
  return (await listEnquiries(userId, now)).find((e) => e.ref === ref) ?? null;
}

async function update(userId: string, ref: string, fn: (e: Enquiry) => Enquiry, now: number) {
  const all = await listEnquiries(userId, now);
  const e = all.find((x) => x.ref === ref);
  if (!e) throw new Error("We couldn't find that request.");
  const next = fn(e);
  write(key(userId), all.map((x) => (x.ref === ref ? next : x)));
  return next;
}

export async function createEnquiry(userId: string, i: Input, now = Date.now()): Promise<Enquiry> {
  const bad = checkEnquiry(i);
  if (bad) throw new Error(bad);
  const ref = `EDGE-${now.toString(36).slice(-6).toUpperCase()}`;
  const e: Enquiry = {
    ref,
    created_at: iso(now),
    need: i.need,
    area: i.area.trim(),
    timing: i.timing,
    contact: { method: i.method, value: i.value.trim(), best_time: i.best_time },
    notes: i.notes.trim() || null,
    status: "new",
    events: [{ at: iso(now), status: "new", by: "you" }],
    messages: [],
    proposals: [],
  };
  write(key(userId), [...(read<Enquiry[]>(key(userId)) ?? []), e]);
  return e;
}

const open = (e: Enquiry) => !["confirmed", "closed", "cancelled"].includes(e.status);

export async function sendMessage(userId: string, ref: string, text: string, now = Date.now()) {
  const t = text.trim();
  if (!t) throw new Error("Write a message first.");
  return update(
    userId,
    ref,
    (e) => {
      if (!open(e)) throw new Error("This request is finished. Start a new one if you need more help.");
      return { ...e, messages: [...e.messages, { at: iso(now), from: "you", text: t.slice(0, 500) }] };
    },
    now,
  );
}

/** Accept or decline one proposal. Everything accepted: confirmed. Anything declined: the coordinator keeps looking. */
export async function respond(userId: string, ref: string, proposalId: string, accept: boolean, now = Date.now()) {
  return update(
    userId,
    ref,
    (e) => {
      if (e.status !== "awaiting_you") throw new Error("There's nothing to answer right now.");
      const proposals = e.proposals.map((p) => (p.id === proposalId && p.status === "pending" ? { ...p, status: accept ? ("accepted" as const) : ("declined" as const), responded_at: iso(now) } : p));
      const declined = proposals.some((p) => p.status === "declined");
      const allYes = proposals.every((p) => p.status === "accepted");
      if (declined)
        return {
          ...e,
          proposals,
          status: "coordinating",
          events: [...e.events, { at: iso(now), status: "coordinating", by: "you", note: "You said no to an option. Your coordinator will look again." }],
          messages: [...e.messages, { at: iso(now), from: "coordinator", text: "No problem. I'll look for other options and get back to you." }],
        };
      if (allYes)
        return {
          ...e,
          proposals,
          status: "confirmed",
          events: [...e.events, { at: iso(now), status: "confirmed", by: "you", note: "You approved everything. Your coordinator confirms the appointment with the clinic and sends you the details." }],
        };
      return { ...e, proposals };
    },
    now,
  );
}

export async function cancelEnquiry(userId: string, ref: string, now = Date.now()) {
  return update(
    userId,
    ref,
    (e) => {
      if (e.status === "cancelled") return e;
      if (!open(e)) throw new Error("This request is already finished.");
      return { ...e, status: "cancelled", events: [...e.events, { at: iso(now), status: "cancelled", by: "you" }] };
    },
    now,
  );
}
