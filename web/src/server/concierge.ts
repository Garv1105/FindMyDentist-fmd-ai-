import { randomBytes, randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { requireRole, type Auth } from "./auth.ts";
import { bad, HttpError, notFound } from "./http.ts";

/* ---------------- configuration (OD-03: commercial terms undecided) ---------------- */

/** Everything a patient is told about scope comes from config, never hard-coded promises. */
export function conciergeConfig() {
  const areas = (process.env.FMD_CONCIERGE_AREAS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    serviceAreas: areas, // empty = not yet published
    responseCommitment: null as string | null, // no published response time until OD-03 is decided
    staffed24x7: false,
    fees: "Any fees are explained and agreed with you before anything is arranged.",
  };
}

/** Internal follow-up target only (not shown to patients). */
const FIRST_CONTACT_HOURS = Number(process.env.FMD_CONCIERGE_FIRST_CONTACT_HOURS ?? 24);
const CONSENT_VERSION = "concierge-contact-2026-10";

export const NEEDS = [
  "Finding the right specialist",
  "Second opinion on a treatment plan",
  "Planning a complex treatment",
  "Care for a family member",
  "Something else",
] as const;
export const TIMINGS = ["This week", "Next 2 weeks", "Flexible"] as const;
export const CONTACT_METHODS = ["phone", "whatsapp", "email"] as const;

/* ---------------- state machine (PRD §5) ---------------- */

export const STATUSES = [
  "new",
  "contact_attempted",
  "contacted",
  "needs_clarification",
  "coordinating",
  "awaiting_patient",
  "confirmed",
  "closed",
  "cancelled",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  contact_attempted: "Contact attempted",
  contacted: "Contacted",
  needs_clarification: "Needs clarification",
  coordinating: "Coordinating",
  awaiting_patient: "Awaiting patient",
  confirmed: "Confirmed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const T: Record<Status, Status[]> = {
  new: ["contact_attempted", "contacted", "cancelled"],
  contact_attempted: ["contact_attempted", "contacted", "cancelled", "closed"],
  contacted: ["needs_clarification", "coordinating", "awaiting_patient", "cancelled", "closed"],
  needs_clarification: ["contacted", "coordinating", "awaiting_patient", "cancelled", "closed"],
  coordinating: ["needs_clarification", "awaiting_patient", "cancelled", "closed"],
  awaiting_patient: ["confirmed", "coordinating", "needs_clarification", "cancelled", "closed"],
  confirmed: ["closed"],
  closed: [],
  cancelled: [],
};
export const allowedNext = (s: Status) => T[s];
const TERMINAL: Status[] = ["closed", "cancelled"];

/* ---------------- patient side ---------------- */

type Enquiry = {
  id: string;
  reference: string;
  user_id: string | null;
  name: string;
  contact_method: (typeof CONTACT_METHODS)[number];
  contact_value: string;
  need: string;
  area: string;
  timing: string;
  notes: string;
  status: Status;
  priority: "normal" | "high";
  assignee_id: string | null;
  next_action: string;
  next_action_due: number;
  first_contact_at: number | null;
  outcome: string;
  created_at: number;
  updated_at: number;
};

const pick = <T extends string>(v: unknown, opts: readonly T[], field: string): T => {
  if (typeof v === "string" && (opts as readonly string[]).includes(v)) return v as T;
  throw bad(`Choose ${field}.`);
};
const text = (v: unknown, field: string, min: number, max: number, optional = false) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && optional) return "";
  if (s.length < min || s.length > max) throw bad(`${field} must be ${min}–${max} characters.`);
  return s;
};

function contactValue(method: string, raw: unknown) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (method === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw bad("Enter a valid email address.");
    return s.toLowerCase();
  }
  const d = s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(d)) throw bad("Enter a valid 10-digit Indian mobile number.");
  return `+91${d}`;
}

/** Unambiguous, non-sequential reference (no 0/O/1/I). */
function newReference() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(6);
  return "CQ-" + Array.from(b, (x) => A[x % A.length]).join("");
}

export function submitEnquiry(input: Record<string, unknown>, auth: Auth | null) {
  if (input.consent !== true) throw bad("Please agree to be contacted about this request.");
  const method = pick(input.contactMethod, CONTACT_METHODS, "how we should contact you");
  const e = {
    name: text(input.name ?? auth?.user.name, "Name", 2, 80),
    contact_method: method,
    contact_value: contactValue(method, input.contactValue),
    need: pick(input.need, NEEDS, "what you need help with"),
    area: text(input.area, "Area", 2, 80),
    timing: pick(input.timing, TIMINGS, "a preferred timing"),
    notes: text(input.notes, "Notes", 0, 1000, true),
  };
  const now = Date.now();
  // abuse guard: at most 3 open requests per contact in 24h
  const recent = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM concierge_enquiries WHERE contact_value = ? AND created_at > ? AND status NOT IN ('closed','cancelled')",
    e.contact_value,
    now - 24 * 3600_000,
  )!.n;
  if (recent >= 3) throw new HttpError(429, "rate_limited", "You already have open requests. Our team will be in touch about those first.");

  const id = randomUUID();
  const reference = newReference();
  tx(() => {
    run(
      `INSERT INTO concierge_enquiries (id, reference, user_id, name, contact_method, contact_value, need, area, timing, notes, consent_version, next_action_due, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, reference, auth?.user.id ?? null, e.name, e.contact_method, e.contact_value, e.need, e.area, e.timing, e.notes, CONSENT_VERSION,
      now + FIRST_CONTACT_HOURS * 3600_000, now, now,
    );
    event(id, auth?.user.id ?? null, { kind: "created", to_status: "new" });
    audit(auth?.user.id ?? null, "concierge.submitted", "concierge_enquiry", id);
  });
  return { reference, status: "new" as Status, statusLabel: STATUS_LABEL.new };
}

/** A patient's own requests: status only, never internal notes. */
export function myEnquiries(a: Auth) {
  return all<Pick<Enquiry, "reference" | "need" | "status" | "created_at" | "updated_at">>(
    "SELECT reference, need, status, created_at, updated_at FROM concierge_enquiries WHERE user_id = ? ORDER BY created_at DESC",
    a.user.id,
  ).map((r) => ({ reference: r.reference, need: r.need, status: r.status, statusLabel: STATUS_LABEL[r.status], createdAt: r.created_at, updatedAt: r.updated_at }));
}

/* ---------------- coordinator side ---------------- */

const requireOps = (a: Auth) => requireRole(a, "fmd_ops", "super_admin");

function event(
  enquiryId: string,
  actorId: string | null,
  e: { kind: string; from_status?: Status; to_status?: Status; channel?: string; result?: string; body?: string },
) {
  run(
    "INSERT INTO concierge_events (id, enquiry_id, at, actor_id, kind, from_status, to_status, channel, result, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), enquiryId, Date.now(), actorId, e.kind, e.from_status ?? null, e.to_status ?? null, e.channel ?? null, e.result ?? null, e.body ?? "",
  );
}

const isOverdue = (e: Pick<Enquiry, "status" | "next_action_due">, now = Date.now()) => !TERMINAL.includes(e.status) && e.next_action_due < now;

export function listQueue(a: Auth, f: { status?: string; overdue?: boolean; mine?: boolean } = {}) {
  requireOps(a);
  const now = Date.now();
  const rows = all<Enquiry & { assignee_name: string | null }>(
    `SELECT e.*, u.name AS assignee_name FROM concierge_enquiries e LEFT JOIN users u ON u.id = e.assignee_id ORDER BY e.next_action_due ASC`,
  );
  const items = rows
    .filter((r) => (!f.status ? true : f.status === "open" ? !TERMINAL.includes(r.status) : r.status === f.status))
    .filter((r) => (f.overdue ? isOverdue(r, now) : true))
    .filter((r) => (f.mine ? r.assignee_id === a.user.id : true))
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      name: r.name,
      need: r.need,
      area: r.area,
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      priority: r.priority,
      assignee: r.assignee_name,
      nextAction: r.next_action,
      nextActionDue: r.next_action_due,
      overdue: isOverdue(r, now),
      createdAt: r.created_at,
    }));
  // overdue and high priority first
  items.sort((x, y) => Number(y.overdue) - Number(x.overdue) || Number(y.priority === "high") - Number(x.priority === "high") || x.nextActionDue - y.nextActionDue);
  return { items, metrics: metrics(rows, now) };
}

/** Operational report (CON-11). Definitions are stated so numbers aren't misread. */
function metrics(rows: Enquiry[], now: number) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const r of rows) byStatus[r.status]++;
  const firstContact = rows.filter((r) => r.first_contact_at).map((r) => r.first_contact_at! - r.created_at).sort((a, b) => a - b);
  const median = firstContact.length ? firstContact[Math.floor((firstContact.length - 1) / 2)] : null;
  return {
    total: rows.length,
    open: rows.filter((r) => !TERMINAL.includes(r.status)).length,
    overdue: rows.filter((r) => isOverdue(r, now)).length,
    byStatus,
    medianFirstContactHours: median === null ? null : Math.round((median / 3600_000) * 10) / 10,
    definitions: {
      overdue: "Open request whose next action is past its due time.",
      medianFirstContactHours: "Median hours from submission to the first successful contact, across requests contacted so far.",
    },
  };
}

export function enquiryDetail(a: Auth, id: string) {
  requireOps(a);
  const e = one<Enquiry>("SELECT * FROM concierge_enquiries WHERE id = ?", id);
  if (!e) throw notFound("Request not found.");
  audit(a.user.id, "concierge.viewed", "concierge_enquiry", id); // access to contact details is logged
  const events = all<{ at: number; kind: string; from_status: Status | null; to_status: Status | null; channel: string | null; result: string | null; body: string; actor: string | null }>(
    "SELECT ev.at, ev.kind, ev.from_status, ev.to_status, ev.channel, ev.result, ev.body, u.name AS actor FROM concierge_events ev LEFT JOIN users u ON u.id = ev.actor_id WHERE ev.enquiry_id = ? ORDER BY ev.at ASC",
    id,
  );
  const coordinators = all<{ id: string; name: string }>(
    "SELECT DISTINCT u.id, u.name FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role IN ('fmd_ops','super_admin') AND u.status = 'active' ORDER BY u.name",
  );
  return {
    enquiry: { ...e, statusLabel: STATUS_LABEL[e.status], overdue: isOverdue(e), allowedNext: allowedNext(e.status).map((s) => ({ status: s, label: STATUS_LABEL[s] })) },
    events,
    coordinators,
  };
}

/** All coordinator actions go through here: one permission check, one transaction, one audit entry. */
export function act(a: Auth, id: string, input: Record<string, unknown>) {
  requireOps(a);
  const now = Date.now();
  return tx(() => {
    const e = one<Enquiry>("SELECT * FROM concierge_enquiries WHERE id = ?", id);
    if (!e) throw notFound("Request not found.");
    const type = input.type;
    const touch = (sql: string, ...p: (string | number | null)[]) => run(`UPDATE concierge_enquiries SET ${sql}, updated_at = ? WHERE id = ?`, ...p, now, id);

    if (TERMINAL.includes(e.status) && type !== "note") throw new HttpError(409, "closed", "This request is closed. Only notes can be added.");

    switch (type) {
      case "status": {
        const to = pick(input.to, STATUSES, "a status");
        if (!allowedNext(e.status).includes(to)) throw new HttpError(409, "invalid_transition", `Can't move from ${STATUS_LABEL[e.status]} to ${STATUS_LABEL[to]}.`);
        const note = text(input.note, "Note", 0, 2000, true);
        if (to === "confirmed") {
          // CON-06: nothing is final until the patient has agreed to it
          if (input.patientConfirmed !== true || note.length < 10) throw bad("Record what the patient confirmed (clinic, time, fees) and tick that they agreed.");
        }
        if ((to === "closed" || to === "cancelled") && note.length < 3) throw bad("Add the outcome or reason before closing.");
        if (to === "contacted" && !e.first_contact_at) touch("first_contact_at = ?", now);
        touch("status = ?", to);
        if (to === "closed" || to === "cancelled") touch("outcome = ?", note);
        event(id, a.user.id, { kind: "status", from_status: e.status, to_status: to, body: note });
        break;
      }
      case "attempt": {
        const channel = pick(input.channel, CONTACT_METHODS, "a channel");
        const result = pick(input.result, ["reached", "no_answer", "left_message", "wrong_number"] as const, "the result");
        const note = text(input.note, "Note", 0, 1000, true);
        event(id, a.user.id, { kind: "contact_attempt", channel, result, body: note });
        if (result === "reached") {
          if (!e.first_contact_at) touch("first_contact_at = ?", now);
          if (e.status === "new" || e.status === "contact_attempted") {
            touch("status = ?", "contacted");
            event(id, a.user.id, { kind: "status", from_status: e.status, to_status: "contacted" });
          }
        } else if (e.status === "new") {
          touch("status = ?", "contact_attempted");
          event(id, a.user.id, { kind: "status", from_status: "new", to_status: "contact_attempted" });
        }
        break;
      }
      case "note": {
        event(id, a.user.id, { kind: "note", body: text(input.note, "Note", 1, 2000) });
        touch("status = status");
        break;
      }
      case "assign": {
        const to = typeof input.assigneeId === "string" ? input.assigneeId : "";
        const ok = one("SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('fmd_ops','super_admin')", to);
        if (!ok) throw bad("Choose a coordinator.");
        touch("assignee_id = ?", to);
        event(id, a.user.id, { kind: "assigned", body: to === e.assignee_id ? "Re-confirmed" : e.assignee_id ? "Reassigned" : "Assigned", result: to });
        break;
      }
      case "next": {
        const action = text(input.nextAction, "Next action", 3, 200);
        const due = Number(input.dueAt);
        if (!Number.isFinite(due) || due < now - 60_000) throw bad("Choose a due time in the future.");
        touch("next_action = ?, next_action_due = ?", action, due);
        event(id, a.user.id, { kind: "next_action", body: action, result: String(due) });
        break;
      }
      case "priority": {
        const p = pick(input.priority, ["normal", "high"] as const, "a priority");
        touch("priority = ?", p);
        event(id, a.user.id, { kind: "priority", body: p });
        break;
      }
      default:
        throw bad("Unknown action.");
    }
    audit(a.user.id, `concierge.${String(type)}`, "concierge_enquiry", id);
  });
}
