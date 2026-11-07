import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "../db.ts";
import type { Auth } from "../auth.ts";
import { bad, HttpError, notFound } from "../http.ts";
import { requireClinic } from "./workspace.ts";
import { istDayStart } from "./calendar.ts";

/**
 * Clinic billing (PRD §6.5). These are the clinic's own treatment ledgers: they are never FMD revenue
 * and never flow into FMD's accounting (COM-07, ACC-20). Amounts are integer paise.
 */

type Invoice = {
  id: string;
  clinic_id: string;
  patient_id: string;
  number: string;
  status: "draft" | "issued" | "partially_paid" | "paid" | "void";
  total_paise: number;
  void_reason: string;
  created_at: number;
  issued_at: number | null;
};
type ItemIn = { description?: string; qty?: number; unitInr?: number; discountInr?: number };
export const PAY_MODES = ["cash", "upi", "card", "bank", "other"] as const;

async function items(invoiceId: string) {
  return await all<{ id: string; description: string; qty: number; unit_paise: number; discount_paise: number }>("SELECT * FROM invoice_items WHERE invoice_id = ?", invoiceId);
}
async function paidPaise(invoiceId: string) {
  const r = (await one<{ paid: number; refunded: number }>(
    "SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount_paise END), 0) AS paid, COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount_paise END), 0) AS refunded FROM clinic_payments WHERE invoice_id = ?",
    invoiceId,
  ))!;
  return { paid: r.paid, refunded: r.refunded, net: r.paid - r.refunded };
}

async function ownInvoice(clinicId: string, id: string) {
  const i = await one<Invoice>("SELECT * FROM invoices WHERE id = ? AND clinic_id = ?", id, clinicId);
  if (!i) throw notFound("Invoice not found.");
  return i;
}

export async function invoiceView(a: Auth, clinicId: string, id: string) {
  await requireClinic(a, clinicId, "billing.read");
  const i = await ownInvoice(clinicId, id);
  const p = await paidPaise(id);
  const patient = (await one<{ full_name: string }>("SELECT full_name FROM clinic_patients WHERE id = ?", i.patient_id))!;
  return {
    id: i.id,
    number: i.number,
    status: i.status,
    patientId: i.patient_id,
    patient: patient.full_name,
    items: (await items(id)).map((x) => ({ ...x, lineInr: (x.qty * x.unit_paise - x.discount_paise) / 100 })),
    totalInr: i.total_paise / 100,
    paidInr: p.net / 100,
    balanceInr: i.status === "void" ? 0 : (i.total_paise - p.net) / 100,
    voidReason: i.void_reason,
    issuedAt: i.issued_at,
    payments: (await all<{ kind: string; amount_paise: number; mode: string; reference: string; reason: string; recorded_at: number; by: string }>(
      "SELECT p.kind, p.amount_paise, p.mode, p.reference, p.reason, p.recorded_at, u.name AS by FROM clinic_payments p JOIN users u ON u.id = p.recorded_by WHERE p.invoice_id = ? ORDER BY p.recorded_at",
      id,
    )).map((x) => ({ ...x, amountInr: x.amount_paise / 100 })),
  };
}

export async function createInvoice(a: Auth, clinicId: string, input: Record<string, unknown>) {
  await requireClinic(a, clinicId, "billing.write");
  const patientId = typeof input.patientId === "string" ? input.patientId : "";
  if (!await one("SELECT 1 FROM clinic_patients WHERE id = ? AND clinic_id = ? AND merged_into IS NULL", patientId, clinicId)) throw bad("Choose a patient.");
  let lines: ItemIn[] = Array.isArray(input.items) ? (input.items as ItemIn[]) : [];
  const planId = typeof input.planId === "string" ? input.planId : null;
  if (planId) {
    const pl = await one<{ patient_id: string }>("SELECT patient_id FROM treatment_plans WHERE id = ? AND clinic_id = ?", planId, clinicId);
    if (!pl || pl.patient_id !== patientId) throw bad("That plan belongs to another patient.");
    lines = (await all<{ procedure: string; tooth: string; qty: number; unit_paise: number; discount_paise: number }>("SELECT * FROM plan_items WHERE plan_id = ?", planId)).map((x) => ({
      description: x.tooth ? `${x.procedure} (tooth ${x.tooth})` : x.procedure,
      qty: x.qty,
      unitInr: x.unit_paise / 100,
      discountInr: x.discount_paise / 100,
    }));
  }
  if (!lines.length) throw bad("Add at least one line.");
  const id = randomUUID();
  await tx(async () => {
    let total = 0;
    await run("INSERT INTO invoices (id, clinic_id, patient_id, number, status, plan_id, created_by, created_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)", id, clinicId, patientId, `DRAFT-${id.slice(0, 8)}`, planId, a.user.id, Date.now());
    for (const l of lines) {
      const qty = Number(l.qty ?? 1);
      const unit = Math.round(Number(l.unitInr) * 100);
      const disc = Math.round(Number(l.discountInr ?? 0) * 100);
      if (!l.description?.trim() || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(unit) || unit < 0 || disc < 0 || disc > qty * unit)
        throw bad("Each line needs a description, quantity, price and a discount no larger than the line.");
      await run("INSERT INTO invoice_items (id, invoice_id, description, qty, unit_paise, discount_paise) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), id, l.description.trim().slice(0, 160), qty, unit, disc);
      total += qty * unit - disc;
    }
    await run("UPDATE invoices SET total_paise = ? WHERE id = ?", total, id);
    await audit(a.user.id, "invoice.drafted", "invoice", id);
  });
  return await invoiceView(a, clinicId, id);
}

/** Issue: gives the next sequential number for this clinic and year; totals are then frozen. */
export async function issueInvoice(a: Auth, clinicId: string, id: string) {
  await requireClinic(a, clinicId, "billing.write");
  await tx(async () => {
    const i = await ownInvoice(clinicId, id);
    if (i.status !== "draft") throw new HttpError(409, "issued", "Already issued.");
    const year = new Date(Date.now() + 5.5 * 3600_000).getUTCFullYear();
    const n = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM invoices WHERE clinic_id = ? AND number LIKE ?", clinicId, `INV-${year}-%`))!.n + 1;
    await run("UPDATE invoices SET number = ?, status = 'issued', issued_at = ? WHERE id = ?", `INV-${year}-${String(n).padStart(4, "0")}`, Date.now(), id);
    await audit(a.user.id, "invoice.issued", "invoice", id);
  });
  return await invoiceView(a, clinicId, id);
}

async function recompute(id: string) {
  const i = (await one<Invoice>("SELECT * FROM invoices WHERE id = ?", id))!;
  if (i.status === "void" || i.status === "draft") return;
  const net = (await paidPaise(id)).net;
  await run("UPDATE invoices SET status = ? WHERE id = ?", net <= 0 ? "issued" : net >= i.total_paise ? "paid" : "partially_paid", id);
}

const paise = (v: unknown) => {
  const p = Math.round(Number(v) * 100);
  if (!Number.isFinite(p) || p <= 0) throw bad("Enter an amount greater than zero.");
  return p;
};

/** Idempotent: the same key twice records one payment (double-click, retry). */
export async function recordPayment(a: Auth, clinicId: string, id: string, input: Record<string, unknown>) {
  await requireClinic(a, clinicId, "billing.write");
  const key = typeof input.idempotencyKey === "string" && input.idempotencyKey.length >= 8 ? input.idempotencyKey : null;
  if (!key) throw bad("Missing request key.");
  if (await one("SELECT 1 FROM clinic_payments WHERE clinic_id = ? AND idempotency_key = ?", clinicId, key)) return await invoiceView(a, clinicId, id);
  const mode = PAY_MODES.includes(input.mode as never) ? (input.mode as string) : null;
  if (!mode) throw bad("Choose a payment mode.");
  const amount = paise(input.amountInr);
  await tx(async () => {
    const i = await ownInvoice(clinicId, id);
    if (i.status === "draft" || i.status === "void") throw new HttpError(409, "not_payable", "Issue the invoice before recording payments.");
    if (amount > i.total_paise - (await paidPaise(id)).net) throw new HttpError(409, "overpayment", "That's more than the balance due.");
    await run(
      "INSERT INTO clinic_payments (id, clinic_id, invoice_id, kind, amount_paise, mode, reference, recorded_by, recorded_at, idempotency_key) VALUES (?, ?, ?, 'payment', ?, ?, ?, ?, ?, ?)",
      randomUUID(), clinicId, id, amount, mode, typeof input.reference === "string" ? input.reference.trim().slice(0, 80) : "", a.user.id, Date.now(), key,
    );
    await recompute(id);
    await audit(a.user.id, "payment.recorded", "invoice", id, { amount, mode });
  });
  return await invoiceView(a, clinicId, id);
}

/** Refunds are recorded here; moving money happens outside FMD and needs human authorisation (§7.4). */
export async function recordRefund(a: Auth, clinicId: string, id: string, input: Record<string, unknown>) {
  await requireClinic(a, clinicId, "billing.refund");
  const key = typeof input.idempotencyKey === "string" && input.idempotencyKey.length >= 8 ? input.idempotencyKey : null;
  if (!key) throw bad("Missing request key.");
  if (await one("SELECT 1 FROM clinic_payments WHERE clinic_id = ? AND idempotency_key = ?", clinicId, key)) return await invoiceView(a, clinicId, id);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5) throw bad("Give the refund reason.");
  const mode = PAY_MODES.includes(input.mode as never) ? (input.mode as string) : null;
  if (!mode) throw bad("Choose how the refund was paid.");
  const amount = paise(input.amountInr);
  await tx(async () => {
    await ownInvoice(clinicId, id);
    if (amount > (await paidPaise(id)).net) throw new HttpError(409, "over_refund", "You can't refund more than has been paid.");
    await run(
      "INSERT INTO clinic_payments (id, clinic_id, invoice_id, kind, amount_paise, mode, reference, reason, recorded_by, recorded_at, idempotency_key) VALUES (?, ?, ?, 'refund', ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(), clinicId, id, amount, mode, typeof input.reference === "string" ? input.reference.trim().slice(0, 80) : "", reason, a.user.id, Date.now(), key,
    );
    await recompute(id);
    await audit(a.user.id, "refund.recorded", "invoice", id, { amount, reason });
  });
  return await invoiceView(a, clinicId, id);
}

export async function voidInvoice(a: Auth, clinicId: string, id: string, reason: unknown) {
  await requireClinic(a, clinicId, "billing.refund");
  const r = typeof reason === "string" ? reason.trim() : "";
  if (r.length < 5) throw bad("Give the reason for voiding.");
  await tx(async () => {
    const i = await ownInvoice(clinicId, id);
    if (i.status === "void") throw new HttpError(409, "void", "Already void.");
    if ((await paidPaise(id)).net > 0) throw new HttpError(409, "has_payments", "Refund the payments before voiding this invoice.");
    await run("UPDATE invoices SET status = 'void', void_reason = ? WHERE id = ?", r, id);
    await audit(a.user.id, "invoice.voided", "invoice", id, { reason: r });
  });
  return await invoiceView(a, clinicId, id);
}

export async function invoices(a: Auth, clinicId: string, f: { status?: string; patientId?: string } = {}) {
  await requireClinic(a, clinicId, "billing.read");
  return await Promise.all((await all<{ id: string }>(
    `SELECT id FROM invoices WHERE clinic_id = ? ${f.status ? "AND status = ?" : ""} ${f.patientId ? "AND patient_id = ?" : ""} ORDER BY created_at DESC LIMIT 200`,
    clinicId,
    ...([f.status, f.patientId].filter(Boolean) as string[]),
  )).map(async (r) => await invoiceView(a, clinicId, r.id)));
}

/** Daily collection sheet (CLN-25): recorded transactions only, by mode, for one IST day. */
export async function collectionSheet(a: Auth, clinicId: string, day: number) {
  await requireClinic(a, clinicId, "billing.read");
  const from = istDayStart(day);
  const rows = await all<{ kind: string; amount_paise: number; mode: string; number: string; patient: string; recorded_at: number; reference: string }>(
    `SELECT p.kind, p.amount_paise, p.mode, i.number, c.full_name AS patient, p.recorded_at, p.reference FROM clinic_payments p
     JOIN invoices i ON i.id = p.invoice_id JOIN clinic_patients c ON c.id = i.patient_id
     WHERE p.clinic_id = ? AND p.recorded_at >= ? AND p.recorded_at < ? ORDER BY p.recorded_at`,
    clinicId, from, from + 86400_000,
  );
  const byMode = Object.fromEntries(PAY_MODES.map((m) => [m, 0])) as Record<string, number>;
  let collected = 0;
  let refunded = 0;
  for (const r of rows) {
    if (r.kind === "payment") {
      collected += r.amount_paise;
      byMode[r.mode] += r.amount_paise;
    } else {
      refunded += r.amount_paise;
      byMode[r.mode] -= r.amount_paise;
    }
  }
  const outstanding = (await one<{ o: number }>(
    `SELECT COALESCE(SUM(i.total_paise - COALESCE((SELECT SUM(CASE WHEN kind='payment' THEN amount_paise ELSE -amount_paise END) FROM clinic_payments p WHERE p.invoice_id = i.id), 0)), 0) AS o
     FROM invoices i WHERE i.clinic_id = ? AND i.status IN ('issued','partially_paid')`,
    clinicId,
  ))!.o;
  return {
    date: from,
    entries: rows.map((r) => ({ ...r, amountInr: r.amount_paise / 100 })),
    byModeInr: Object.fromEntries(Object.entries(byMode).map(([k, v]) => [k, v / 100])),
    collectedInr: collected / 100,
    refundedInr: refunded / 100,
    netInr: (collected - refunded) / 100,
    outstandingInr: outstanding / 100,
    note: "Based on payments recorded in FMD Clinic OS. Not an audited statement.",
  };
}
