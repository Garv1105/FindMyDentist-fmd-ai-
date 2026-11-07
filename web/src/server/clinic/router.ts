import type { Auth } from "../auth.ts";
import { notFound } from "../http.ts";
import * as cal from "./calendar.ts";
import * as pat from "./patients.ts";
import * as bill from "./billing.ts";
import * as ops from "./operations.ts";
import * as ws from "./workspace.ts";

/**
 * Clinic OS API dispatch: one catch-all route maps "METHOD path" to a service call.
 * Authorisation is NOT done here - every service starts with requireClinic(), so a route can't
 * forget it. Responses are JSON unless a handler returns a Response (files, CSV).
 */
type Ctx = { a: Auth; clinicId: string; p: Record<string, string>; body: Record<string, unknown>; q: URLSearchParams };
type Handler = (c: Ctx) => unknown;

const num = (v: string | null, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

const ROUTES: [string, string, Handler][] = [
  // workspace & team
  ["GET", "", async ({ a, clinicId }) => await ws.workspace(a, clinicId)],
  // the team itself (invitations, roles) is managed in FastAPI: /api/v1/clinics/{apiClinicId}/...
  ["GET", "members", async ({ a, clinicId }) => await ws.members(a, clinicId)],
  ["GET", "settings", async ({ a, clinicId }) => await ws.settings(a, clinicId)],
  ["POST", "settings", async ({ a, clinicId, body }) => await ws.updateSettings(a, clinicId, body)],
  // calendar
  ["GET", "calendar", async ({ a, clinicId, q }) => await cal.calendar(a, clinicId, num(q.get("from"), Date.now()), num(q.get("days"), 1))],
  ["POST", "appointments", async ({ a, clinicId, body }) => ({ id: await cal.createAppointment(a, clinicId, body) })],
  ["POST", "appointments/:id/reschedule", async ({ a, clinicId, p, body }) => await cal.rescheduleAppointment(a, clinicId, p.id, body.startsAt)],
  ["POST", "appointments/:id/status", async ({ a, clinicId, p, body }) => await cal.setAppointmentStatus(a, clinicId, p.id, String(body.to), typeof body.note === "string" ? body.note : "")],
  ["GET", "appointments/:id/history", async ({ a, clinicId, p }) => await cal.appointmentHistory(a, clinicId, p.id)],
  ["POST", "fmd-requests/:id/confirm", async ({ a, clinicId, p, body }) => await cal.confirmFmdRequest(a, clinicId, p.id, body)],
  ["POST", "fmd-requests/:id/decline", async ({ a, clinicId, p, body }) => await cal.declineFmdRequest(a, clinicId, p.id, body.reason)],
  ["GET", "waitlist", async ({ a, clinicId }) => await cal.waitlist(a, clinicId)],
  ["POST", "waitlist", async ({ a, clinicId, body }) => await cal.addToWaitlist(a, clinicId, body.patientId, body.preference)],
  ["POST", "waitlist/:id/remove", async ({ a, clinicId, p, body }) => await cal.removeFromWaitlist(a, clinicId, p.id, body.booked === true)],
  ["POST", "availability/publish", async ({ a, clinicId, body }) => await cal.publishAvailability(a, clinicId, num(String(body.days ?? ""), 14))],
  ["POST", "availability/unpublish", async ({ a, clinicId }) => await cal.unpublishAvailability(a, clinicId)],
  // patients & clinical
  ["GET", "patients", async ({ a, clinicId, q }) => await pat.searchPatients(a, clinicId, q.get("q") ?? "")],
  ["POST", "patients", async ({ a, clinicId, body }) => await pat.createPatient(a, clinicId, body)],
  ["GET", "patients/:id", async ({ a, clinicId, p }) => await pat.patientDetail(a, clinicId, p.id)],
  ["POST", "patients/:id", async ({ a, clinicId, p, body }) => await pat.updatePatient(a, clinicId, p.id, body)],
  ["POST", "patients/:id/merge", async ({ a, clinicId, p, body }) => await pat.mergePatients(a, clinicId, p.id, String(body.duplicateId))],
  ["GET", "patients/:id/notes", async ({ a, clinicId, p }) => await pat.notes(a, clinicId, p.id)],
  ["POST", "patients/:id/notes", async ({ a, clinicId, p, body }) => ({ id: await pat.createNote(a, clinicId, p.id, body) })],
  ["POST", "notes/:id", async ({ a, clinicId, p, body }) => await pat.updateDraft(a, clinicId, p.id, body)],
  ["POST", "notes/:id/sign", async ({ a, clinicId, p, body }) => await pat.signNote(a, clinicId, p.id, body)],
  ["POST", "notes/:id/amend", async ({ a, clinicId, p, body }) => ({ id: await pat.amendNote(a, clinicId, p.id, body) })],
  ["GET", "patients/:id/chart", async ({ a, clinicId, p }) => await pat.chart(a, clinicId, p.id)],
  ["POST", "patients/:id/chart", async ({ a, clinicId, p, body }) => await pat.addChartEntry(a, clinicId, p.id, body)],
  ["GET", "patients/:id/plans", async ({ a, clinicId, p }) => await pat.plansFor(a, clinicId, p.id)],
  ["POST", "patients/:id/plans", async ({ a, clinicId, p, body }) => await pat.createPlan(a, clinicId, p.id, body)],
  ["POST", "plans/:id/status", async ({ a, clinicId, p, body }) => await pat.setPlanStatus(a, clinicId, p.id, String(body.to), typeof body.note === "string" ? body.note : "")],
  ["GET", "patients/:id/files", async ({ a, clinicId, p }) => await pat.filesFor(a, clinicId, p.id)],
  [
    "GET",
    "files/:id",
    async ({ a, clinicId, p }) => {
      const f = await pat.readFile(a, clinicId, p.id);
      return new Response(new Uint8Array(f.bytes), { headers: { "content-type": f.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } });
    },
  ],
  // billing
  ["GET", "invoices", async ({ a, clinicId, q }) => await bill.invoices(a, clinicId, { status: q.get("status") ?? undefined, patientId: q.get("patient") ?? undefined })],
  ["POST", "invoices", async ({ a, clinicId, body }) => await bill.createInvoice(a, clinicId, body)],
  ["GET", "invoices/:id", async ({ a, clinicId, p }) => await bill.invoiceView(a, clinicId, p.id)],
  ["POST", "invoices/:id/issue", async ({ a, clinicId, p }) => await bill.issueInvoice(a, clinicId, p.id)],
  ["POST", "invoices/:id/payments", async ({ a, clinicId, p, body }) => await bill.recordPayment(a, clinicId, p.id, body)],
  ["POST", "invoices/:id/refunds", async ({ a, clinicId, p, body }) => await bill.recordRefund(a, clinicId, p.id, body)],
  ["POST", "invoices/:id/void", async ({ a, clinicId, p, body }) => await bill.voidInvoice(a, clinicId, p.id, body.reason)],
  ["GET", "collections", async ({ a, clinicId, q }) => await bill.collectionSheet(a, clinicId, num(q.get("day"), Date.now()))],
  // inventory, tasks, reports
  ["GET", "inventory", async ({ a, clinicId }) => await ops.inventory(a, clinicId)],
  ["POST", "inventory", async ({ a, clinicId, body }) => ({ id: await ops.addItem(a, clinicId, body) })],
  ["POST", "inventory/:id/move", async ({ a, clinicId, p, body }) => await ops.moveStock(a, clinicId, p.id, body)],
  ["GET", "inventory/:id/history", async ({ a, clinicId, p }) => await ops.stockHistory(a, clinicId, p.id)],
  ["GET", "purchase-orders", async ({ a, clinicId }) => await ops.purchaseOrders(a, clinicId)],
  ["POST", "purchase-orders", async ({ a, clinicId, body }) => ({ id: await ops.draftPurchaseOrder(a, clinicId, body) })],
  ["POST", "purchase-orders/:id/status", async ({ a, clinicId, p, body }) => await ops.updatePurchaseOrder(a, clinicId, p.id, String(body.to))],
  ["GET", "tasks", async ({ a, clinicId, q }) => await ops.tasks(a, clinicId, { mine: q.get("mine") === "1", status: q.get("status") ?? undefined })],
  ["POST", "tasks", async ({ a, clinicId, body }) => ({ id: await ops.createTask(a, clinicId, body) })],
  ["POST", "tasks/:id/status", async ({ a, clinicId, p, body }) => await ops.updateTask(a, clinicId, p.id, body.status)],
  ["GET", "handovers", async ({ a, clinicId }) => await ops.handovers(a, clinicId)],
  ["POST", "handovers", async ({ a, clinicId, body }) => await ops.addHandover(a, clinicId, body.body)],
  ["GET", "dashboard", async ({ a, clinicId }) => await ops.dashboard(a, clinicId)],
  ["GET", "reports", async ({ a, clinicId, q }) => await ops.report(a, clinicId, num(q.get("from"), Date.now() - 30 * 86400_000), num(q.get("to"), Date.now()))],
  [
    "GET",
    "reports/export",
    async ({ a, clinicId, q }) =>
      new Response(await ops.reportCsv(a, clinicId, num(q.get("from"), Date.now() - 30 * 86400_000), num(q.get("to"), Date.now())), {
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

export async function uploadPatientFile(a: Auth, clinicId: string, patientId: string, bytes: Uint8Array, title: unknown) {
  return { id: await pat.addFile(a, clinicId, patientId, bytes, title) };
}
