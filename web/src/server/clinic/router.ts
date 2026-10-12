import type { Auth } from "../auth.ts";
import { notFound } from "../http.ts";
import * as cal from "./calendar.ts";
import * as pat from "./patients.ts";
import * as bill from "./billing.ts";
import * as ops from "./operations.ts";
import * as ws from "./workspace.ts";

/**
 * Clinic OS API dispatch: one catch-all route maps "METHOD path" to a service call.
 * Authorisation is NOT done here — every service starts with requireClinic(), so a route can't
 * forget it. Responses are JSON unless a handler returns a Response (files, CSV).
 */
type Ctx = { a: Auth; clinicId: string; p: Record<string, string>; body: Record<string, unknown>; q: URLSearchParams };
type Handler = (c: Ctx) => unknown;

const num = (v: string | null, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

const ROUTES: [string, string, Handler][] = [
  // workspace & team
  ["GET", "", ({ a, clinicId }) => ws.workspace(a, clinicId)],
  ["GET", "members", ({ a, clinicId }) => ws.members(a, clinicId)],
  ["POST", "members/invite", ({ a, clinicId, body }) => ws.invite(a, clinicId, body)],
  ["POST", "members/:userId/roles", ({ a, clinicId, p, body }) => ws.setMemberRoles(a, clinicId, p.userId, body.roles)],
  ["POST", "invites/:id/revoke", ({ a, clinicId, p }) => ws.revokeInvite(a, clinicId, p.id)],
  ["GET", "settings", ({ a, clinicId }) => ws.settings(a, clinicId)],
  ["POST", "settings", ({ a, clinicId, body }) => ws.updateSettings(a, clinicId, body)],
  // calendar
  ["GET", "calendar", ({ a, clinicId, q }) => cal.calendar(a, clinicId, num(q.get("from"), Date.now()), num(q.get("days"), 1))],
  ["POST", "appointments", ({ a, clinicId, body }) => ({ id: cal.createAppointment(a, clinicId, body) })],
  ["POST", "appointments/:id/reschedule", ({ a, clinicId, p, body }) => cal.rescheduleAppointment(a, clinicId, p.id, body.startsAt)],
  ["POST", "appointments/:id/status", ({ a, clinicId, p, body }) => cal.setAppointmentStatus(a, clinicId, p.id, String(body.to), typeof body.note === "string" ? body.note : "")],
  ["GET", "appointments/:id/history", ({ a, clinicId, p }) => cal.appointmentHistory(a, clinicId, p.id)],
  ["POST", "fmd-requests/:id/confirm", ({ a, clinicId, p, body }) => cal.confirmFmdRequest(a, clinicId, p.id, body)],
  ["POST", "fmd-requests/:id/decline", ({ a, clinicId, p, body }) => cal.declineFmdRequest(a, clinicId, p.id, body.reason)],
  ["GET", "waitlist", ({ a, clinicId }) => cal.waitlist(a, clinicId)],
  ["POST", "waitlist", ({ a, clinicId, body }) => cal.addToWaitlist(a, clinicId, body.patientId, body.preference)],
  ["POST", "waitlist/:id/remove", ({ a, clinicId, p, body }) => cal.removeFromWaitlist(a, clinicId, p.id, body.booked === true)],
  ["POST", "availability/publish", ({ a, clinicId, body }) => cal.publishAvailability(a, clinicId, num(String(body.days ?? ""), 14))],
  ["POST", "availability/unpublish", ({ a, clinicId }) => cal.unpublishAvailability(a, clinicId)],
  // patients & clinical
  ["GET", "patients", ({ a, clinicId, q }) => pat.searchPatients(a, clinicId, q.get("q") ?? "")],
  ["POST", "patients", ({ a, clinicId, body }) => pat.createPatient(a, clinicId, body)],
  ["GET", "patients/:id", ({ a, clinicId, p }) => pat.patientDetail(a, clinicId, p.id)],
  ["POST", "patients/:id", ({ a, clinicId, p, body }) => pat.updatePatient(a, clinicId, p.id, body)],
  ["POST", "patients/:id/merge", ({ a, clinicId, p, body }) => pat.mergePatients(a, clinicId, p.id, String(body.duplicateId))],
  ["GET", "patients/:id/notes", ({ a, clinicId, p }) => pat.notes(a, clinicId, p.id)],
  ["POST", "patients/:id/notes", ({ a, clinicId, p, body }) => ({ id: pat.createNote(a, clinicId, p.id, body) })],
  ["POST", "notes/:id", ({ a, clinicId, p, body }) => pat.updateDraft(a, clinicId, p.id, body)],
  ["POST", "notes/:id/sign", ({ a, clinicId, p, body }) => pat.signNote(a, clinicId, p.id, body)],
  ["POST", "notes/:id/amend", ({ a, clinicId, p, body }) => ({ id: pat.amendNote(a, clinicId, p.id, body) })],
  ["GET", "patients/:id/chart", ({ a, clinicId, p }) => pat.chart(a, clinicId, p.id)],
  ["POST", "patients/:id/chart", ({ a, clinicId, p, body }) => pat.addChartEntry(a, clinicId, p.id, body)],
  ["GET", "patients/:id/plans", ({ a, clinicId, p }) => pat.plansFor(a, clinicId, p.id)],
  ["POST", "patients/:id/plans", ({ a, clinicId, p, body }) => pat.createPlan(a, clinicId, p.id, body)],
  ["POST", "plans/:id/status", ({ a, clinicId, p, body }) => pat.setPlanStatus(a, clinicId, p.id, String(body.to), typeof body.note === "string" ? body.note : "")],
  ["GET", "patients/:id/files", ({ a, clinicId, p }) => pat.filesFor(a, clinicId, p.id)],
  [
    "GET",
    "files/:id",
    ({ a, clinicId, p }) => {
      const f = pat.readFile(a, clinicId, p.id);
      return new Response(new Uint8Array(f.bytes), { headers: { "content-type": f.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } });
    },
  ],
  // billing
  ["GET", "invoices", ({ a, clinicId, q }) => bill.invoices(a, clinicId, { status: q.get("status") ?? undefined, patientId: q.get("patient") ?? undefined })],
  ["POST", "invoices", ({ a, clinicId, body }) => bill.createInvoice(a, clinicId, body)],
  ["GET", "invoices/:id", ({ a, clinicId, p }) => bill.invoiceView(a, clinicId, p.id)],
  ["POST", "invoices/:id/issue", ({ a, clinicId, p }) => bill.issueInvoice(a, clinicId, p.id)],
  ["POST", "invoices/:id/payments", ({ a, clinicId, p, body }) => bill.recordPayment(a, clinicId, p.id, body)],
  ["POST", "invoices/:id/refunds", ({ a, clinicId, p, body }) => bill.recordRefund(a, clinicId, p.id, body)],
  ["POST", "invoices/:id/void", ({ a, clinicId, p, body }) => bill.voidInvoice(a, clinicId, p.id, body.reason)],
  ["GET", "collections", ({ a, clinicId, q }) => bill.collectionSheet(a, clinicId, num(q.get("day"), Date.now()))],
  // inventory, tasks, reports
  ["GET", "inventory", ({ a, clinicId }) => ops.inventory(a, clinicId)],
  ["POST", "inventory", ({ a, clinicId, body }) => ({ id: ops.addItem(a, clinicId, body) })],
  ["POST", "inventory/:id/move", ({ a, clinicId, p, body }) => ops.moveStock(a, clinicId, p.id, body)],
  ["GET", "inventory/:id/history", ({ a, clinicId, p }) => ops.stockHistory(a, clinicId, p.id)],
  ["GET", "purchase-orders", ({ a, clinicId }) => ops.purchaseOrders(a, clinicId)],
  ["POST", "purchase-orders", ({ a, clinicId, body }) => ({ id: ops.draftPurchaseOrder(a, clinicId, body) })],
  ["POST", "purchase-orders/:id/status", ({ a, clinicId, p, body }) => ops.updatePurchaseOrder(a, clinicId, p.id, String(body.to))],
  ["GET", "tasks", ({ a, clinicId, q }) => ops.tasks(a, clinicId, { mine: q.get("mine") === "1", status: q.get("status") ?? undefined })],
  ["POST", "tasks", ({ a, clinicId, body }) => ({ id: ops.createTask(a, clinicId, body) })],
  ["POST", "tasks/:id/status", ({ a, clinicId, p, body }) => ops.updateTask(a, clinicId, p.id, body.status)],
  ["GET", "handovers", ({ a, clinicId }) => ops.handovers(a, clinicId)],
  ["POST", "handovers", ({ a, clinicId, body }) => ops.addHandover(a, clinicId, body.body)],
  ["GET", "dashboard", ({ a, clinicId }) => ops.dashboard(a, clinicId)],
  ["GET", "reports", ({ a, clinicId, q }) => ops.report(a, clinicId, num(q.get("from"), Date.now() - 30 * 86400_000), num(q.get("to"), Date.now()))],
  [
    "GET",
    "reports/export",
    ({ a, clinicId, q }) =>
      new Response(ops.reportCsv(a, clinicId, num(q.get("from"), Date.now() - 30 * 86400_000), num(q.get("to"), Date.now())), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clinic-report.csv"`, "cache-control": "no-store" },
      }),
  ],
];

const extra: [string, string, Handler][] = [];
/** Lets other modules (the AI manager) add routes without editing this table. */
export function registerClinicRoutes(routes: [string, string, Handler][]) {
  extra.push(...routes);
}

export async function dispatch(method: string, segments: string[], c: Omit<Ctx, "p">) {
  for (const [m, pattern, h] of [...ROUTES, ...extra]) {
    if (m !== method) continue;
    const parts = pattern ? pattern.split("/") : [];
    if (parts.length !== segments.length) continue;
    const p: Record<string, string> = {};
    if (parts.every((part, i) => (part.startsWith(":") ? ((p[part.slice(1)] = decodeURIComponent(segments[i])), true) : part === segments[i]))) {
      const out = await h({ ...c, p });
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    }
  }
  throw notFound("Unknown clinic endpoint.");
}

export function uploadPatientFile(a: Auth, clinicId: string, patientId: string, bytes: Uint8Array, title: unknown) {
  return { id: pat.addFile(a, clinicId, patientId, bytes, title) };
}
