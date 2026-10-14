import { randomBytes, randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import type { Auth } from "./auth.ts";
import { bad, forbidden, HttpError, notFound } from "./http.ts";
import { sniffMime, storage } from "./adapters/storage.ts";

export const AREAS = {
  account: "Account & sign-in",
  booking: "Appointments & booking",
  records: "Dental records",
  assistant: "FMD AI",
  concierge: "FMD Edge",
  membership: "Membership & payments",
  content: "Explore & content",
  other: "Something else",
} as const;
type Area = keyof typeof AREAS;
const SEVERITIES = ["low", "normal", "high", "critical"] as const;

const isStaff = (a: Auth) => a.roles.some((r) => r === "fmd_ops" || r === "super_admin");
const ATTACH_MAX = 5 * 1024 * 1024;
const REOPEN_DAYS = 14;

type TicketRow = {
  id: string;
  reference: string;
  user_id: string;
  area: Area;
  severity: (typeof SEVERITIES)[number];
  impact: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";
  assignee_id: string | null;
  resolution: string;
  reopened: number;
  first_response_at: number | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
};

function newRef() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "SR-" + Array.from(randomBytes(6), (x) => A[x % A.length]).join("");
}

export function openTicket(a: Auth, input: Record<string, unknown>) {
  const area = typeof input.area === "string" && input.area in AREAS ? (input.area as Area) : null;
  if (!area) throw bad("Choose what it's about.");
  const severity = SEVERITIES.includes(input.severity as never) ? (input.severity as TicketRow["severity"]) : "normal";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (subject.length < 4 || subject.length > 120) throw bad("Subject must be 4–120 characters.");
  if (body.length < 10 || body.length > 4000) throw bad("Describe the problem in 10–4,000 characters.");
  const open = one<{ n: number }>("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND status IN ('open','in_progress','waiting_on_user')", a.user.id)!.n;
  if (open >= 10) throw new HttpError(429, "too_many", "You have several open requests. We'll respond to those first.");
  const id = randomUUID();
  const now = Date.now();
  tx(() => {
    run(
      "INSERT INTO tickets (id, reference, user_id, area, severity, impact, subject, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
      id, newRef(), a.user.id, area, severity, typeof input.impact === "string" ? input.impact.trim().slice(0, 200) : "", subject, now, now,
    );
    run("INSERT INTO ticket_messages (id, ticket_id, author_id, from_staff, body, created_at) VALUES (?, ?, ?, 0, ?, ?)", randomUUID(), id, a.user.id, body, now);
    audit(a.user.id, "ticket.opened", "ticket", id, { area, severity });
  });
  return ticketDetail(a, id);
}

/** Requester sees their own; staff see all. Internal notes are never returned to requesters. */
function access(a: Auth, id: string) {
  const t = one<TicketRow>("SELECT * FROM tickets WHERE id = ?", id);
  if (!t) throw notFound("Request not found.");
  if (t.user_id !== a.user.id && !isStaff(a)) throw notFound("Request not found.");
  return t;
}

export function ticketDetail(a: Auth, id: string) {
  const t = access(a, id);
  const staff = isStaff(a);
  if (staff && t.user_id !== a.user.id) audit(a.user.id, "ticket.viewed", "ticket", id);
  return {
    id: t.id,
    reference: t.reference,
    area: t.area,
    areaLabel: AREAS[t.area],
    severity: t.severity,
    impact: t.impact,
    subject: t.subject,
    status: t.status,
    resolution: t.resolution,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    canReopen: t.user_id === a.user.id && (t.status === "resolved" || t.status === "closed") && (t.resolved_at ?? 0) > Date.now() - REOPEN_DAYS * 86400_000,
    messages: all<{ body: string; from_staff: number; internal: number; created_at: number; author: string }>(
      `SELECT m.body, m.from_staff, m.internal, m.created_at, u.name AS author FROM ticket_messages m JOIN users u ON u.id = m.author_id
       WHERE m.ticket_id = ? ${staff ? "" : "AND m.internal = 0"} ORDER BY m.created_at`,
      id,
    ).map((m) => ({ body: m.body, fromStaff: m.from_staff === 1, internal: m.internal === 1, at: m.created_at, author: m.from_staff ? "FMD Support" : m.author.split(" ")[0] })),
    attachments: all<{ id: string; mime: string; size_bytes: number }>("SELECT id, mime, size_bytes FROM ticket_attachments WHERE ticket_id = ?", id),
  };
}

export function myTickets(a: Auth) {
  return all<TicketRow>("SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC", a.user.id).map((t) => ({
    id: t.id,
    reference: t.reference,
    subject: t.subject,
    areaLabel: AREAS[t.area],
    status: t.status,
    updatedAt: t.updated_at,
  }));
}

export function reply(a: Auth, id: string, input: Record<string, unknown>) {
  const t = access(a, id);
  const staff = isStaff(a) && t.user_id !== a.user.id;
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length < 2 || body.length > 4000) throw bad("Message must be 2–4,000 characters.");
  const internal = staff && input.internal === true;
  if (!staff && (t.status === "resolved" || t.status === "closed")) throw new HttpError(409, "closed", "This request is closed. Reopen it to add a message.");
  const now = Date.now();
  tx(() => {
    run("INSERT INTO ticket_messages (id, ticket_id, author_id, from_staff, internal, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", randomUUID(), id, a.user.id, staff ? 1 : 0, internal ? 1 : 0, body, now);
    if (staff && !internal && !t.first_response_at) run("UPDATE tickets SET first_response_at = ? WHERE id = ?", now, id);
    // a requester reply moves "waiting on you" back to the team
    const next = !staff && t.status === "waiting_on_user" ? "in_progress" : t.status;
    run("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?", next, now, id);
  });
  return ticketDetail(a, id);
}

export function attach(a: Auth, id: string, bytes: Uint8Array) {
  access(a, id);
  if (bytes.byteLength > ATTACH_MAX) throw new HttpError(413, "too_large", "Attachments must be 5 MB or smaller.");
  const mime = sniffMime(bytes);
  if (!mime || mime === "application/dicom") throw new HttpError(415, "unsupported_type", "Attach a screenshot (JPEG, PNG, WebP) or a PDF.");
  if ((one<{ n: number }>("SELECT COUNT(*) AS n FROM ticket_attachments WHERE ticket_id = ?", id)?.n ?? 0) >= 5) throw bad("Up to 5 attachments per request.");
  const key = storage.put(bytes);
  run("INSERT INTO ticket_attachments (id, ticket_id, storage_key, mime, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), id, key, mime, bytes.byteLength, Date.now());
  audit(a.user.id, "ticket.attachment_added", "ticket", id);
  return ticketDetail(a, id);
}

export function readAttachment(a: Auth, ticketId: string, attachmentId: string) {
  access(a, ticketId);
  const f = one<{ storage_key: string; mime: string }>("SELECT storage_key, mime FROM ticket_attachments WHERE id = ? AND ticket_id = ?", attachmentId, ticketId);
  if (!f) throw notFound("Attachment not found.");
  audit(a.user.id, "ticket.attachment_viewed", "ticket", ticketId);
  return { bytes: storage.get(f.storage_key), mime: f.mime };
}

export function reopen(a: Auth, id: string) {
  const t = access(a, id);
  if (!ticketDetail(a, id).canReopen) throw new HttpError(409, "not_reopenable", `Requests can be reopened within ${REOPEN_DAYS} days of resolution. Please open a new one.`);
  run("UPDATE tickets SET status = 'open', reopened = reopened + 1, updated_at = ? WHERE id = ?", Date.now(), t.id);
  audit(a.user.id, "ticket.reopened", "ticket", id);
  return ticketDetail(a, id);
}

/* ---------------- staff ---------------- */

export function queue(a: Auth, f: { status?: string } = {}) {
  if (!isStaff(a)) throw forbidden();
  const rows = all<TicketRow & { requester: string; assignee: string | null }>(
    `SELECT t.*, u.name AS requester, s.name AS assignee FROM tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users s ON s.id = t.assignee_id
     ORDER BY CASE t.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.created_at`,
  );
  const open = rows.filter((t) => !["resolved", "closed"].includes(t.status));
  const responded = rows.filter((t) => t.first_response_at).map((t) => t.first_response_at! - t.created_at).sort((x, y) => x - y);
  const resolved = rows.filter((t) => t.resolved_at);
  return {
    items: rows
      .filter((t) => (f.status ? (f.status === "open" ? !["resolved", "closed"].includes(t.status) : t.status === f.status) : true))
      .map((t) => ({
        id: t.id,
        reference: t.reference,
        subject: t.subject,
        areaLabel: AREAS[t.area],
        severity: t.severity,
        status: t.status,
        requester: t.requester.split(" ")[0],
        assignee: t.assignee,
        createdAt: t.created_at,
      })),
    metrics: {
      open: open.length,
      medianFirstResponseHours: responded.length ? Math.round((responded[Math.floor((responded.length - 1) / 2)] / 3600_000) * 10) / 10 : null,
      reopenRate: resolved.length ? Math.round((rows.filter((t) => t.reopened > 0).length / resolved.length) * 100) : null,
    },
  };
}

const STAFF_STATUS = ["open", "in_progress", "waiting_on_user", "resolved", "closed"] as const;

export function staffUpdate(a: Auth, id: string, input: Record<string, unknown>) {
  if (!isStaff(a)) throw forbidden();
  const t = access(a, id);
  const now = Date.now();
  if (input.assignToMe === true) run("UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?", a.user.id, now, id);
  if (typeof input.severity === "string" && SEVERITIES.includes(input.severity as never)) run("UPDATE tickets SET severity = ?, updated_at = ? WHERE id = ?", input.severity, now, id);
  if (typeof input.status === "string") {
    if (!STAFF_STATUS.includes(input.status as never)) throw bad("Unknown status.");
    const resolution = typeof input.resolution === "string" ? input.resolution.trim() : "";
    if ((input.status === "resolved" || input.status === "closed") && resolution.length < 5) throw bad("Write a resolution summary for the requester.");
    run(
      "UPDATE tickets SET status = ?, resolution = CASE WHEN ? != '' THEN ? ELSE resolution END, resolved_at = CASE WHEN ? IN ('resolved','closed') THEN ? ELSE resolved_at END, updated_at = ? WHERE id = ?",
      input.status, resolution, resolution, input.status, now, now, id,
    );
  }
  audit(a.user.id, "ticket.updated", "ticket", t.id, { status: input.status, severity: input.severity });
  return ticketDetail(a, id);
}
