import { randomUUID } from "node:crypto";
import { all, one, run } from "../../db.ts";
import type { Auth } from "../../auth.ts";
import { messaging } from "../../adapters/messaging.ts";
import { createPost } from "../../content.ts";
import { istDayStart } from "../calendar.ts";
import { collectionSheet } from "../billing.ts";
import { createTask, draftPurchaseOrder, inventoryAlerts, recallDue } from "../operations.ts";
import type { Permission } from "../workspace.ts";

/**
 * Typed, permission-checked tools — the only way the AI manager touches clinic data (PRD §7.5).
 * Risk tiers map to the autonomy matrix (§7.4):
 *   read      → may run automatically
 *   internal  → drafts/tasks inside FMD; may run automatically, staff are notified
 *   external  → patient communication; always previewed and approved
 *   publish   → FMD Main content; approval + moderation
 *   financial / appointment_change / clinical → never executed by the AI in this release
 */
export type Risk = "read" | "internal" | "external" | "publish";
export type ToolCtx = { a: Auth; clinicId: string; taskId: string };
export type Tool = {
  name: string;
  label: string;
  risk: Risk;
  permission: Permission;
  validate: (input: Record<string, unknown>) => Record<string, unknown>;
  /** What will happen, shown on the approval card before anything external runs. */
  preview?: (c: ToolCtx, input: Record<string, unknown>) => unknown;
  run: (c: ToolCtx, input: Record<string, unknown>, prior: Record<string, unknown>) => unknown;
  /** Re-reads system state after execution; success is never assumed from the call alone (§7.3 Verify). */
  verify?: (c: ToolCtx, output: unknown) => boolean;
};

const days = (v: unknown, d: number, max: number) => Math.max(1, Math.min(max, Number.isInteger(v) ? (v as number) : d));
const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

const TOOLS: Tool[] = [
  {
    name: "appointments.unconfirmed",
    label: "Find unconfirmed appointments",
    risk: "read",
    permission: "appointments.read",
    validate: (i) => ({ days: days(i.days, 2, 14) }),
    run: ({ clinicId }, i) => {
      const now = Date.now();
      const rows = all<{ id: string; starts_at: number; patient: string; patient_id: string; type: string | null }>(
        `SELECT a.id, a.starts_at, p.full_name AS patient, p.id AS patient_id, t.name AS type FROM appointments a JOIN clinic_patients p ON p.id = a.patient_id
         LEFT JOIN appointment_types t ON t.id = a.type_id WHERE a.clinic_id = ? AND a.status = 'booked' AND a.kind = 'visit' AND a.starts_at > ? AND a.starts_at < ? ORDER BY a.starts_at`,
        clinicId, now, now + (i.days as number) * 86400_000,
      );
      return { count: rows.length, appointments: rows.map((r) => ({ ...r, when: fmt(r.starts_at) })) };
    },
  },
  {
    name: "schedule.gaps",
    label: "Find free time in the schedule",
    risk: "read",
    permission: "appointments.read",
    validate: (i) => ({ days: days(i.days, 3, 14) }),
    run: ({ clinicId }, i) => {
      const out: { day: string; freeMinutes: number }[] = [];
      for (let d = 0; d < (i.days as number); d++) {
        const day = istDayStart(Date.now()) + d * 86400_000;
        const wd = new Date(day + 5.5 * 3600_000).getUTCDay();
        const open = all<{ opens: string; closes: string }>("SELECT opens, closes FROM clinic_hours WHERE clinic_id = ? AND weekday = ?", clinicId, wd).reduce(
          (s, h) => s + (Number(h.closes.slice(0, 2)) * 60 + Number(h.closes.slice(3))) - (Number(h.opens.slice(0, 2)) * 60 + Number(h.opens.slice(3))),
          0,
        );
        const booked = one<{ m: number }>(
          "SELECT COALESCE(SUM(ends_at - starts_at), 0) / 60000 AS m FROM appointments WHERE clinic_id = ? AND starts_at >= ? AND starts_at < ? AND status IN ('booked','confirmed','checked_in')",
          clinicId, day, day + 86400_000,
        )!.m;
        if (open) out.push({ day: new Date(day + 5.5 * 3600_000).toISOString().slice(0, 10), freeMinutes: Math.max(0, open - booked) });
      }
      return { days: out, note: "Free minutes per chair-day; assumes one chair." };
    },
  },
  {
    name: "recall.list",
    label: "List patients due for recall",
    risk: "read",
    permission: "patients.read",
    // 0 = use the clinic's configured recall rule
    validate: (i) => ({ months: Number.isInteger(i.months) ? Math.max(1, Math.min(24, i.months as number)) : 0 }),
    run: ({ clinicId }, i) => {
      const months = (i.months as number) || (one<{ recall_months: number }>("SELECT recall_months FROM ai_settings WHERE clinic_id = ?", clinicId)?.recall_months ?? 6);
      const rows = recallDue(clinicId, months);
      return {
        rule: `Last completed visit more than ${months} months ago, nothing booked (clinic-configured recall rule).`,
        count: rows.length,
        withConsent: rows.filter((r) => r.consent_comms === 1).length,
        patients: rows.map((r) => ({ id: r.id, name: r.full_name, lastVisit: fmt(r.last_visit_at), canMessage: r.consent_comms === 1 })),
      };
    },
  },
  {
    name: "messages.draft_recall",
    label: "Draft recall messages",
    risk: "internal",
    permission: "patients.read",
    validate: (i) => i,
    run: ({ clinicId, taskId }, _i, prior) => {
      const list = (prior["recall.list"] as { patients: { id: string; name: string; canMessage: boolean }[] } | undefined)?.patients ?? [];
      const clinic = one<{ name: string }>("SELECT name FROM clinics WHERE id = ?", clinicId)!.name;
      let drafted = 0;
      for (const p of list) {
        // templated, non-clinical wording; consent is checked again at send time
        const body = `Hello ${p.name.split(" ")[0]}, it's been a while since your last visit to ${clinic}. Would you like to book a routine check-up? Reply or call us to choose a time.`;
        run(
          "INSERT INTO outbound_messages (id, clinic_id, patient_id, channel, purpose, body, status, task_id, created_at) VALUES (?, ?, ?, 'sms', 'recall', ?, ?, ?, ?)",
          randomUUID(), clinicId, p.id, body, p.canMessage ? "draft" : "skipped_no_consent", taskId, Date.now(),
        );
        drafted += p.canMessage ? 1 : 0;
      }
      return { drafted, skippedNoConsent: list.length - drafted };
    },
    verify: ({ taskId }, out) => one<{ n: number }>("SELECT COUNT(*) AS n FROM outbound_messages WHERE task_id = ? AND status = 'draft'", taskId)!.n === (out as { drafted: number }).drafted,
  },
  {
    name: "messages.send",
    label: "Send drafted messages to patients",
    risk: "external",
    permission: "appointments.write",
    validate: (i) => i,
    preview: ({ taskId }) => {
      const msgs = all<{ body: string; name: string; phone: string }>(
        "SELECT m.body, p.full_name AS name, p.phone FROM outbound_messages m JOIN clinic_patients p ON p.id = m.patient_id WHERE m.task_id = ? AND m.status = 'draft'",
        taskId,
      );
      return {
        recipients: msgs.length,
        sample: msgs.slice(0, 3).map((m) => ({ to: `${m.name} (${m.phone ? m.phone.slice(0, 6) + "••••" : "no phone"})`, message: m.body })),
        channel: "SMS",
        provider: messaging.configured ? messaging.name : "No messaging provider configured — nothing will actually be delivered.",
      };
    },
    run: ({ clinicId, taskId }) => {
      const msgs = all<{ id: string; patient_id: string; channel: string; body: string; phone: string; email: string; consent_comms: number }>(
        "SELECT m.id, m.patient_id, m.channel, m.body, p.phone, p.email, p.consent_comms FROM outbound_messages m JOIN clinic_patients p ON p.id = m.patient_id WHERE m.task_id = ? AND m.clinic_id = ? AND m.status = 'draft'",
        taskId, clinicId,
      );
      const tally = { sent: 0, not_sent: 0, failed: 0, skipped_no_consent: 0, detail: "" };
      for (const m of msgs) {
        if (m.consent_comms !== 1) {
          run("UPDATE outbound_messages SET status = 'skipped_no_consent' WHERE id = ?", m.id);
          tally.skipped_no_consent++;
          continue;
        }
        const r = messaging.send({ phone: m.phone, email: m.email }, m.channel, m.body);
        run("UPDATE outbound_messages SET status = ?, status_detail = ?, sent_at = ? WHERE id = ?", r.status, r.detail, r.status === "sent" ? Date.now() : null, m.id);
        tally[r.status]++;
        tally.detail = r.detail;
      }
      return tally;
    },
    verify: ({ taskId }, out) => {
      const sent = one<{ n: number }>("SELECT COUNT(*) AS n FROM outbound_messages WHERE task_id = ? AND status = 'sent'", taskId)!.n;
      return sent === (out as { sent: number }).sent && sent > 0;
    },
  },
  {
    name: "payments.daily_sheet",
    label: "Prepare today's payment sheet",
    risk: "read",
    permission: "billing.read",
    validate: (i) => i,
    run: ({ a, clinicId }) => {
      const s = collectionSheet(a, clinicId, Date.now());
      return { collectedInr: s.collectedInr, refundedInr: s.refundedInr, netInr: s.netInr, byModeInr: s.byModeInr, outstandingInr: s.outstandingInr, entries: s.entries.length, note: s.note };
    },
  },
  {
    name: "billing.missing_entries",
    label: "Find completed visits without an invoice",
    risk: "read",
    permission: "billing.read",
    validate: (i) => ({ days: days(i.days, 7, 31) }),
    run: ({ clinicId }, i) => {
      const rows = all<{ id: string; starts_at: number; patient: string }>(
        `SELECT a.id, a.starts_at, p.full_name AS patient FROM appointments a JOIN clinic_patients p ON p.id = a.patient_id
         WHERE a.clinic_id = ? AND a.status = 'completed' AND a.starts_at > ?
           AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.patient_id = a.patient_id AND i.created_at >= a.starts_at - 86400000 AND i.status != 'void')`,
        clinicId, Date.now() - (i.days as number) * 86400_000,
      );
      return { count: rows.length, visits: rows.map((r) => ({ patient: r.patient, when: fmt(r.starts_at) })) };
    },
  },
  {
    name: "inventory.review",
    label: "Review stock and expiry",
    risk: "read",
    permission: "inventory.read",
    validate: (i) => i,
    run: ({ clinicId }) => {
      const al = inventoryAlerts(clinicId);
      return { low: al.low.map((x) => ({ id: x.id, name: x.name, stock: x.stock, reorderLevel: x.reorder_level, unit: x.unit })), expiring: al.expiring };
    },
  },
  {
    name: "purchase_order.draft",
    label: "Draft a purchase order for low stock",
    risk: "internal",
    permission: "inventory.read",
    validate: (i) => i,
    run: ({ a, clinicId }, _i, prior) => {
      const low = (prior["inventory.review"] as { low: { id: string; stock: number; reorderLevel: number }[] } | undefined)?.low ?? [];
      if (!low.length) return { drafted: false, reason: "Nothing is below its reorder level." };
      const lines = low.map((x) => ({ itemId: x.id, qty: Math.max(1, x.reorderLevel * 2 - x.stock) }));
      const id = draftPurchaseOrder(a, clinicId, { lines }, { aiDrafted: true });
      return { drafted: true, purchaseOrderId: id, lines: lines.length, note: "Draft only. The owner approves before anything is ordered." };
    },
    verify: ({ clinicId }, out) => {
      const o = out as { drafted: boolean; purchaseOrderId?: string };
      return !o.drafted || !!one("SELECT 1 FROM purchase_orders WHERE id = ? AND clinic_id = ? AND status = 'draft'", o.purchaseOrderId!, clinicId);
    },
  },
  {
    name: "tasks.create_followups",
    label: "Create follow-up tasks for staff",
    risk: "internal",
    permission: "tasks.use",
    validate: (i) => i,
    run: ({ a, clinicId, taskId }, _i, prior) => {
      const unconfirmed = (prior["appointments.unconfirmed"] as { appointments: { patient: string; when: string }[] } | undefined)?.appointments ?? [];
      const missing = (prior["billing.missing_entries"] as { visits: { patient: string; when: string }[] } | undefined)?.visits ?? [];
      const ids: string[] = [];
      for (const ap of unconfirmed) ids.push(createTask(a, clinicId, { title: `Confirm appointment: ${ap.patient}`, detail: `Booked for ${ap.when}. Call or message to confirm.`, priority: "normal" }, { source: "ai", sourceRef: taskId }));
      for (const v of missing) ids.push(createTask(a, clinicId, { title: `Invoice missing: ${v.patient}`, detail: `Completed visit on ${v.when} has no invoice.`, priority: "high" }, { source: "ai", sourceRef: taskId }));
      return { created: ids.length };
    },
    verify: ({ clinicId, taskId }, out) => one<{ n: number }>("SELECT COUNT(*) AS n FROM clinic_tasks WHERE clinic_id = ? AND source_ref = ?", clinicId, taskId)!.n === (out as { created: number }).created,
  },
  {
    name: "handover.summary",
    label: "Summarise the day for handover",
    risk: "read",
    permission: "tasks.use",
    validate: (i) => i,
    run: ({ clinicId }) => {
      const day = istDayStart(Date.now());
      const by = all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM appointments WHERE clinic_id = ? AND kind = 'visit' AND starts_at >= ? AND starts_at < ? GROUP BY status", clinicId, day, day + 86400_000);
      const open = one<{ n: number }>("SELECT COUNT(*) AS n FROM clinic_tasks WHERE clinic_id = ? AND status = 'open'", clinicId)!.n;
      const overdue = one<{ n: number }>("SELECT COUNT(*) AS n FROM clinic_tasks WHERE clinic_id = ? AND status = 'open' AND due_at < ?", clinicId, Date.now())!.n;
      return { appointmentsByStatus: Object.fromEntries(by.map((b) => [b.status, b.n])), openTasks: open, overdueTasks: overdue };
    },
  },
  {
    name: "content.submit",
    label: "Submit an educational post for FMD review",
    risk: "publish",
    permission: "ai.use",
    validate: (i) => {
      const topic = typeof i.topic === "string" ? i.topic : "Prevention";
      return { topic, title: String(i.title ?? ""), body: String(i.body ?? "") };
    },
    preview: (_c, i) => ({ title: i.title, body: i.body, topic: i.topic, note: "Goes to FMD moderation after your approval; it is not published directly." }),
    run: ({ a }, i) => createPost(a, { kind: "education", topic: i.topic, title: i.title, body: i.body }),
  },
];

export const toolByName = (n: string) => TOOLS.find((t) => t.name === n);
export const TOOL_CATALOG = TOOLS.map((t) => ({ name: t.name, label: t.label, risk: t.risk, permission: t.permission }));
