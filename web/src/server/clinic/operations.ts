import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "../db.ts";
import type { Auth } from "../auth.ts";
import { bad, HttpError, notFound } from "../http.ts";
import { can, requireClinic } from "./workspace.ts";
import { istDayStart } from "./calendar.ts";

/* ================= inventory & procurement (PRD §6.6) ================= */

export function inventory(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "inventory.read");
  const items = all<{ id: string; name: string; unit: string; reorder_level: number; supplier: string; tracks_expiry: number; stock: number }>(
    "SELECT i.*, COALESCE((SELECT SUM(qty_delta) FROM stock_movements m WHERE m.item_id = i.id), 0) AS stock FROM inventory_items i WHERE i.clinic_id = ? ORDER BY i.name",
    clinicId,
  );
  return { items: items.map((i) => ({ ...i, low: i.stock <= i.reorder_level })), alerts: inventoryAlerts(clinicId) };
}

/** Low stock (≤ reorder level) and batches expiring within 30 days that still have stock. */
export function inventoryAlerts(clinicId: string, now = Date.now()) {
  const low = all<{ id: string; name: string; stock: number; reorder_level: number; unit: string }>(
    "SELECT i.id, i.name, i.unit, i.reorder_level, COALESCE((SELECT SUM(qty_delta) FROM stock_movements m WHERE m.item_id = i.id), 0) AS stock FROM inventory_items i WHERE i.clinic_id = ?",
    clinicId,
  ).filter((i) => i.stock <= i.reorder_level);
  const soon = new Date(now + 30 * 86400_000).toISOString().slice(0, 10);
  const expiring = all<{ item: string; batch: string; expires_on: string; remaining: number }>(
    `SELECT i.name AS item, m.batch, MAX(m.expires_on) AS expires_on, SUM(m.qty_delta) AS remaining FROM stock_movements m JOIN inventory_items i ON i.id = m.item_id
     WHERE i.clinic_id = ? AND m.batch != '' GROUP BY m.item_id, m.batch HAVING remaining > 0 AND expires_on != '' AND expires_on <= ?`,
    clinicId, soon,
  );
  return { low, expiring };
}

export function addItem(a: Auth, clinicId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "inventory.write");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const unit = typeof input.unit === "string" ? input.unit.trim() : "";
  if (name.length < 2 || unit.length < 1) throw bad("Items need a name and a unit (e.g. box, ml, pcs).");
  const id = randomUUID();
  run(
    "INSERT INTO inventory_items (id, clinic_id, name, unit, reorder_level, supplier, tracks_expiry, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, clinicId, name.slice(0, 80), unit.slice(0, 20), Math.max(0, Math.floor(Number(input.reorderLevel) || 0)), typeof input.supplier === "string" ? input.supplier.trim().slice(0, 80) : "", input.tracksExpiry === true ? 1 : 0, Date.now(),
  );
  return id;
}

/** Stock is the sum of movements — never overwritten; adjustments require a note (CLN-30). */
export function moveStock(a: Auth, clinicId: string, itemId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "inventory.write");
  const item = one<{ tracks_expiry: number }>("SELECT tracks_expiry FROM inventory_items WHERE id = ? AND clinic_id = ?", itemId, clinicId);
  if (!item) throw notFound("Item not found.");
  const reason = ["received", "used", "adjustment", "expired", "returned"].includes(input.reason as string) ? (input.reason as string) : null;
  if (!reason) throw bad("Choose why the stock changed.");
  const qty = Math.trunc(Number(input.qty));
  if (!Number.isFinite(qty) || qty === 0) throw bad("Enter a quantity.");
  const delta = reason === "received" ? Math.abs(qty) : reason === "adjustment" ? qty : -Math.abs(qty);
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (reason === "adjustment" && note.length < 3) throw bad("Explain the adjustment.");
  const batch = typeof input.batch === "string" ? input.batch.trim().slice(0, 40) : "";
  const expires = typeof input.expiresOn === "string" ? input.expiresOn : "";
  if (reason === "received" && item.tracks_expiry && (!batch || !/^\d{4}-\d{2}-\d{2}$/.test(expires))) throw bad("This item tracks expiry: enter the batch and expiry date.");
  const stock = one<{ s: number }>("SELECT COALESCE(SUM(qty_delta), 0) AS s FROM stock_movements WHERE item_id = ?", itemId)!.s;
  if (stock + delta < 0) throw new HttpError(409, "negative_stock", `Only ${stock} in stock.`);
  run(
    "INSERT INTO stock_movements (id, item_id, qty_delta, reason, batch, expires_on, note, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), itemId, delta, reason, batch, expires, note.slice(0, 200), a.user.id, Date.now(),
  );
  return inventory(a, clinicId);
}

export function stockHistory(a: Auth, clinicId: string, itemId: string) {
  requireClinic(a, clinicId, "inventory.read");
  if (!one("SELECT 1 FROM inventory_items WHERE id = ? AND clinic_id = ?", itemId, clinicId)) throw notFound("Item not found.");
  return all("SELECT m.qty_delta, m.reason, m.batch, m.expires_on, m.note, m.recorded_at, u.name AS by FROM stock_movements m JOIN users u ON u.id = m.recorded_by WHERE m.item_id = ? ORDER BY m.recorded_at DESC", itemId);
}

type PoLine = { itemId: string; name: string; qty: number };

/** Draft (staff or AI) → approved (owner) → sent → received (stock in). Nothing is sent automatically. */
export function draftPurchaseOrder(a: Auth, clinicId: string, input: Record<string, unknown>, opts: { aiDrafted?: boolean } = {}) {
  requireClinic(a, clinicId, opts.aiDrafted ? "ai.use" : "inventory.write");
  const lines = (Array.isArray(input.lines) ? input.lines : []) as PoLine[];
  if (!lines.length) throw bad("Add at least one item.");
  for (const l of lines) {
    const it = one<{ name: string }>("SELECT name FROM inventory_items WHERE id = ? AND clinic_id = ?", l.itemId, clinicId);
    if (!it || !Number.isInteger(l.qty) || l.qty < 1) throw bad("Each line needs a clinic item and a positive quantity.");
    l.name = it.name;
  }
  const supplier = typeof input.supplier === "string" && input.supplier.trim() ? input.supplier.trim().slice(0, 80) : "Supplier to be chosen";
  const id = randomUUID();
  run(
    "INSERT INTO purchase_orders (id, clinic_id, supplier, lines, status, ai_drafted, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)",
    id, clinicId, supplier, JSON.stringify(lines.map((l) => ({ itemId: l.itemId, name: l.name, qty: l.qty }))), opts.aiDrafted ? 1 : 0, a.user.id, Date.now(), Date.now(),
  );
  audit(a.user.id, opts.aiDrafted ? "po.ai_drafted" : "po.drafted", "purchase_order", id);
  return id;
}

const PO_NEXT: Record<string, string[]> = { draft: ["approved", "cancelled"], approved: ["sent", "cancelled"], sent: ["received", "cancelled"] };

export function updatePurchaseOrder(a: Auth, clinicId: string, id: string, to: string) {
  const po = one<{ status: string; lines: string }>("SELECT status, lines FROM purchase_orders WHERE id = ? AND clinic_id = ?", id, clinicId);
  requireClinic(a, clinicId, to === "approved" ? "inventory.approve" : "inventory.write");
  if (!po) throw notFound("Purchase order not found.");
  if (!(PO_NEXT[po.status] ?? []).includes(to)) throw new HttpError(409, "invalid_transition", `Can't move a ${po.status} order to ${to}.`);
  tx(() => {
    run("UPDATE purchase_orders SET status = ?, approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END, updated_at = ? WHERE id = ?", to, to, a.user.id, Date.now(), id);
    if (to === "received")
      for (const l of JSON.parse(po.lines) as PoLine[])
        run("INSERT INTO stock_movements (id, item_id, qty_delta, reason, note, recorded_by, recorded_at) VALUES (?, ?, ?, 'received', ?, ?, ?)", randomUUID(), l.itemId, l.qty, `PO ${id.slice(0, 8)}`, a.user.id, Date.now());
    audit(a.user.id, `po.${to}`, "purchase_order", id);
  });
}

export function purchaseOrders(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "inventory.read");
  return all<{ id: string; supplier: string; lines: string; status: string; ai_drafted: number; created_at: number }>(
    "SELECT id, supplier, lines, status, ai_drafted, created_at FROM purchase_orders WHERE clinic_id = ? ORDER BY created_at DESC",
    clinicId,
  ).map((p) => ({ ...p, lines: JSON.parse(p.lines) as PoLine[], aiDrafted: p.ai_drafted === 1 }));
}

/* ================= staff tasks & handovers (PRD §6.7) ================= */

export function tasks(a: Auth, clinicId: string, f: { mine?: boolean; status?: string } = {}) {
  requireClinic(a, clinicId, "tasks.use");
  return all<{ id: string; title: string; detail: string; assignee_id: string | null; assignee: string | null; due_at: number | null; priority: string; status: string; source: string; source_ref: string; created_at: number }>(
    `SELECT t.*, u.name AS assignee FROM clinic_tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.clinic_id = ?
     ${f.mine ? "AND t.assignee_id = ?" : ""} ${f.status ? "AND t.status = ?" : "AND t.status = 'open'"}
     ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, COALESCE(t.due_at, 9e15)`,
    clinicId,
    ...([f.mine ? a.user.id : null, f.status ?? null].filter(Boolean) as string[]),
  ).map((t) => ({ ...t, overdue: t.status === "open" && !!t.due_at && t.due_at < Date.now() }));
}

/** Tasks from the AI manager carry their source so staff can review where they came from (CLN-35). */
export function createTask(a: Auth, clinicId: string, input: Record<string, unknown>, opts: { source?: "manual" | "ai" | "system"; sourceRef?: string } = {}) {
  requireClinic(a, clinicId, "tasks.use");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 3) throw bad("Give the task a title.");
  const assignee = typeof input.assigneeId === "string" && input.assigneeId ? input.assigneeId : null;
  if (assignee && !one("SELECT 1 FROM user_roles WHERE user_id = ? AND org_id = ? AND role LIKE 'clinic_%'", assignee, clinicId)) throw bad("Assign to a member of this clinic.");
  const due = input.dueAt === undefined || input.dueAt === null || input.dueAt === "" ? null : Number(input.dueAt);
  if (due !== null && !Number.isFinite(due)) throw bad("Invalid due date.");
  const id = randomUUID();
  run(
    "INSERT INTO clinic_tasks (id, clinic_id, title, detail, assignee_id, due_at, priority, source, source_ref, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, clinicId, title.slice(0, 160), typeof input.detail === "string" ? input.detail.slice(0, 1000) : "", assignee, due,
    ["low", "normal", "high"].includes(input.priority as string) ? (input.priority as string) : "normal", opts.source ?? "manual", opts.sourceRef ?? "", a.user.id, Date.now(),
  );
  return id;
}

export function updateTask(a: Auth, clinicId: string, id: string, status: unknown) {
  requireClinic(a, clinicId, "tasks.use");
  if (status !== "done" && status !== "cancelled" && status !== "open") throw bad("Unknown status.");
  if (!one("SELECT 1 FROM clinic_tasks WHERE id = ? AND clinic_id = ?", id, clinicId)) throw notFound("Task not found.");
  run("UPDATE clinic_tasks SET status = ?, completed_at = CASE WHEN ? = 'done' THEN ? ELSE NULL END WHERE id = ?", status, status, Date.now(), id);
}

export function handovers(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "tasks.use");
  return all("SELECT h.body, h.created_at, u.name AS author FROM handovers h JOIN users u ON u.id = h.author_id WHERE h.clinic_id = ? ORDER BY h.created_at DESC LIMIT 30", clinicId);
}
export function addHandover(a: Auth, clinicId: string, body: unknown) {
  requireClinic(a, clinicId, "tasks.use");
  const b = typeof body === "string" ? body.trim() : "";
  if (b.length < 5) throw bad("Write the handover note.");
  run("INSERT INTO handovers (id, clinic_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)", randomUUID(), clinicId, a.user.id, b.slice(0, 2000), Date.now());
  return handovers(a, clinicId);
}

/* ================= dashboard & reports (PRD §6.2, §6.8) ================= */

export const RECALL_MONTHS = 6; // default; clinics configure their own recall rules via the AI manager settings

/** Patients due for recall: last completed visit older than N months and nothing upcoming. */
export function recallDue(clinicId: string, months = RECALL_MONTHS, now = Date.now()) {
  return all<{ id: string; full_name: string; phone: string; last_visit_at: number; consent_comms: number }>(
    `SELECT p.id, p.full_name, p.phone, p.last_visit_at, p.consent_comms FROM clinic_patients p
     WHERE p.clinic_id = ? AND p.merged_into IS NULL AND p.last_visit_at IS NOT NULL AND p.last_visit_at < ?
       AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.starts_at > ? AND a.status IN ('booked','confirmed'))
     ORDER BY p.last_visit_at`,
    clinicId, now - months * 30 * 86400_000, now,
  );
}

export function dashboard(a: Auth, clinicId: string, now = Date.now()) {
  requireClinic(a, clinicId, "tasks.use");
  const day = istDayStart(now);
  const today = all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM appointments WHERE clinic_id = ? AND kind = 'visit' AND starts_at >= ? AND starts_at < ? GROUP BY status", clinicId, day, day + 86400_000);
  const count = (s: string) => today.find((t) => t.status === s)?.n ?? 0;
  const out: Record<string, unknown> = {
    today: {
      total: today.reduce((s, t) => s + t.n, 0),
      booked: count("booked"),
      confirmed: count("confirmed"),
      checkedIn: count("checked_in"),
      completed: count("completed"),
      cancelled: count("cancelled"),
      noShow: count("no_show"),
    },
    pendingFmdRequests: one<{ n: number }>("SELECT COUNT(*) AS n FROM booking_requests WHERE clinic_id = ? AND status = 'requested'", clinicId)!.n,
    unconfirmedUpcoming: one<{ n: number }>("SELECT COUNT(*) AS n FROM appointments WHERE clinic_id = ? AND status = 'booked' AND kind = 'visit' AND starts_at > ?", clinicId, now)!.n,
    recallDue: recallDue(clinicId, RECALL_MONTHS, now).length,
    openTasks: one<{ n: number }>("SELECT COUNT(*) AS n FROM clinic_tasks WHERE clinic_id = ? AND status = 'open'", clinicId)!.n,
  };
  if (can(a, clinicId, "clinical.read"))
    out.incompleteNotes = one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM appointments a WHERE a.clinic_id = ? AND a.status = 'completed' AND a.starts_at > ?
       AND NOT EXISTS (SELECT 1 FROM clinical_notes n WHERE n.appointment_id = a.id AND n.status = 'signed')`,
      clinicId, now - 14 * 86400_000,
    )!.n;
  if (can(a, clinicId, "billing.read")) {
    const r = one<{ c: number; o: number }>(
      `SELECT (SELECT COALESCE(SUM(CASE WHEN kind='payment' THEN amount_paise ELSE -amount_paise END), 0) FROM clinic_payments WHERE clinic_id = ? AND recorded_at >= ?) AS c,
              (SELECT COALESCE(SUM(i.total_paise - COALESCE((SELECT SUM(CASE WHEN kind='payment' THEN amount_paise ELSE -amount_paise END) FROM clinic_payments p WHERE p.invoice_id = i.id), 0)), 0)
                 FROM invoices i WHERE i.clinic_id = ? AND i.status IN ('issued','partially_paid')) AS o`,
      clinicId, day, clinicId,
    )!;
    out.collectionsTodayInr = r.c / 100;
    out.outstandingInr = r.o / 100;
  }
  if (can(a, clinicId, "inventory.read")) {
    const al = inventoryAlerts(clinicId, now);
    out.inventoryAlerts = al.low.length + al.expiring.length;
  }
  return out;
}

/** Operational report with stated definitions (CLN-36..40). Range is [from, to) in IST days. */
export function report(a: Auth, clinicId: string, from: number, to: number) {
  requireClinic(a, clinicId, "reports.read");
  const f = istDayStart(from);
  const t = istDayStart(to) + 86400_000;
  if (t - f > 366 * 86400_000) throw bad("Reports cover up to one year.");
  const appts = all<{ status: string; starts_at: number; ends_at: number }>("SELECT status, starts_at, ends_at FROM appointments WHERE clinic_id = ? AND kind = 'visit' AND starts_at >= ? AND starts_at < ?", clinicId, f, t);
  const scheduled = appts.filter((x) => x.status !== "cancelled").length;
  const cancelled = appts.filter((x) => x.status === "cancelled").length;
  const noShow = appts.filter((x) => x.status === "no_show").length;
  const bookedMinutes = appts.filter((x) => ["booked", "confirmed", "checked_in", "completed"].includes(x.status)).reduce((s, x) => s + (x.ends_at - x.starts_at) / 60_000, 0);
  const hours = all<{ weekday: number; opens: string; closes: string }>("SELECT weekday, opens, closes FROM clinic_hours WHERE clinic_id = ?", clinicId);
  const chairs = Math.max(1, one<{ n: number }>("SELECT COUNT(*) AS n FROM chairs WHERE clinic_id = ? AND active = 1", clinicId)!.n);
  let openMinutes = 0;
  for (let d = f; d < t; d += 86400_000) {
    const wd = new Date(d + 5.5 * 3600_000).getUTCDay();
    for (const h of hours.filter((x) => x.weekday === wd)) openMinutes += (Number(h.closes.slice(0, 2)) * 60 + Number(h.closes.slice(3))) - (Number(h.opens.slice(0, 2)) * 60 + Number(h.opens.slice(3)));
  }
  const pay = all<{ kind: string; amount_paise: number }>("SELECT kind, amount_paise FROM clinic_payments WHERE clinic_id = ? AND recorded_at >= ? AND recorded_at < ?", clinicId, f, t);
  const mix = all<{ description: string; n: number }>(
    "SELECT ii.description, SUM(ii.qty) AS n FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.clinic_id = ? AND i.status != 'void' AND i.issued_at >= ? AND i.issued_at < ? GROUP BY ii.description ORDER BY n DESC LIMIT 10",
    clinicId, f, t,
  );
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
  return {
    range: { from: f, to: t },
    utilisationPct: pct(bookedMinutes, openMinutes * chairs),
    cancellationRatePct: pct(cancelled, appts.length),
    noShowRatePct: pct(noShow, scheduled),
    appointments: appts.length,
    collectionsInr: pay.reduce((s, p) => s + (p.kind === "payment" ? p.amount_paise : -p.amount_paise), 0) / 100,
    procedureMix: mix,
    recallDueNow: recallDue(clinicId).length,
    definitions: {
      utilisationPct: "Booked visit minutes ÷ (opening minutes × active chairs) in the range.",
      cancellationRatePct: "Cancelled visits ÷ all visits scheduled in the range.",
      noShowRatePct: "No-shows ÷ visits not cancelled.",
      collectionsInr: "Payments minus refunds recorded in the range. Not an audited figure.",
      recallDueNow: `Patients whose last completed visit was over ${RECALL_MONTHS} months ago with nothing booked.`,
    },
  };
}

export function reportCsv(a: Auth, clinicId: string, from: number, to: number) {
  const r = report(a, clinicId, from, to);
  audit(a.user.id, "report.exported", "clinic", clinicId, { from, to });
  const rows = [
    ["metric", "value", "definition"],
    ["utilisation_pct", r.utilisationPct ?? "", r.definitions.utilisationPct],
    ["cancellation_rate_pct", r.cancellationRatePct ?? "", r.definitions.cancellationRatePct],
    ["no_show_rate_pct", r.noShowRatePct ?? "", r.definitions.noShowRatePct],
    ["appointments", r.appointments, ""],
    ["collections_inr", r.collectionsInr, r.definitions.collectionsInr],
    ...r.procedureMix.map((m) => [`procedure:${m.description}`, m.n, "Quantity on issued invoices"]),
  ];
  return rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
