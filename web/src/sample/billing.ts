/**
 * Plans, membership, checkout and payments (plan parts 8.1, 8.2, PDR §4.1, §8.1, §10, §14): sample data until the
 * backend and a payment gateway (Razorpay, PayU or similar) are chosen. Proposed API:
 *   GET  /plans · GET /me/membership · PATCH /me/membership {auto_renew} · POST /me/membership/cancel
 *   POST /checkout {plan_id} header Idempotency-Key → {payment_id, gateway_order}
 *   POST /payments/webhook (from the gateway, signed) → the only thing that marks a payment paid or failed
 *   GET  /payments/{id} · GET /me/payments · GET /me/invoices/{id}/pdf
 * Rules: price, GST, renewal, limits and refund terms are shown before paying. A payment is paid only when the
 * gateway confirms it, never because the browser came back from the gateway. The same key never charges twice.
 * FMD Main membership is separate from any Clinic OS subscription. Limits are shown before they're reached.
 */
import { demoPdf } from "./files.ts";
import { read, write } from "./store.ts";

export type PlanId = "patient" | "dentist" | "student" | "company";
export type Plan = { id: PlanId; name: string; yearly: number; features: string[]; limits: string[] };

/** PDR §14 prices. GST at 18% is the demo's assumption, to be confirmed by FMD's accountant. */
export const GST_RATE = 0.18;
export const GRACE_DAYS = 14;
export const REFUND_TERMS = "Cancel within 7 days of your first payment for a full refund. After that, cancelling stops the next renewal and your membership runs to its end date. (Demo terms.)";
export const PLANS: Plan[] = [
  { id: "patient", name: "Patient", yearly: 0, features: ["FMD AI", "Find and book dentists", "Records vault (100 MB)", "FMD Edge requests"], limits: ["No payment needed"] },
  { id: "dentist", name: "Dentist", yearly: 550, features: ["Verified public profile", "Posts in Explore", "Post jobs", "Everything patients get"], limits: ["One profile per registration"] },
  { id: "student", name: "Dental student", yearly: 400, features: ["FMD Scholar included", "Doubts, viva practice, seminars and research help", "Everything patients get"], limits: ["Scholar: 200 questions and 10 presentations a month (demo limits)", "Student ID checked first"] },
  { id: "company", name: "Dental company", yearly: 2000, features: ["Company page", "Post jobs", "Clearly labelled promotions"], limits: ["Company checked by FMD first"] },
];
/** Tentative (PDR §8.1): what it buys and how often is still to be decided, so it can't be bought yet. */
export const SCHOLAR_EXTRA = { price: 350, note: "Extra Scholar use once the included limit runs out. Price and details are tentative." };

export const priceOf = (p: Plan) => {
  const gst = Math.round(p.yearly * GST_RATE);
  return { base: p.yearly, gst, total: p.yearly + gst };
};

export type Payment = {
  id: string;
  plan: PlanId;
  amount: number;
  gst: number;
  /** pending until the gateway's signed notification arrives */
  status: "pending" | "paid" | "failed";
  created_at: string;
  settled_at: string | null;
  invoice: string | null;
  key: string;
  outcome: "success" | "failure";
};
export type Membership = { plan: PlanId; started: string; renews_at: string; auto_renew: boolean; cancelled_at: string | null };
export type MembershipView = (Membership & { status: "active" | "grace" | "expired" | "cancelled"; grace_until: string | null }) | null;

type State = { membership: Membership | null; payments: Payment[] };
const key = (userId: string) => `fmd-demo:billing:${userId}`;
const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
/** demo: the gateway's notification arrives this long after paying */
export const WEBHOOK_MS = 3000;

/** Settles demo payments once the "gateway" has told us, and starts the membership a paid one buys. */
function advance(s: State, now: number): State {
  let membership = s.membership;
  const payments = s.payments.map((p) => {
    if (p.status !== "pending" || now - Date.parse(p.created_at) < WEBHOOK_MS) return p;
    const settled = iso(Date.parse(p.created_at) + WEBHOOK_MS);
    if (p.outcome === "failure") return { ...p, status: "failed" as const, settled_at: settled };
    const start = membership && membership.plan === p.plan && Date.parse(membership.renews_at) > now ? Date.parse(membership.renews_at) : Date.parse(settled);
    membership = { plan: p.plan, started: membership?.plan === p.plan ? membership.started : settled, renews_at: iso(start + 365 * day), auto_renew: membership?.plan === p.plan && !membership.cancelled_at ? membership.auto_renew : true, cancelled_at: null }; // a new or switched plan starts renewing
    return { ...p, status: "paid" as const, settled_at: settled, invoice: `FMD-INV-${p.id.slice(-6).toUpperCase()}` };
  });
  return { membership, payments };
}

function load(userId: string, now: number) {
  const s = advance(read<State>(key(userId)) ?? { membership: null, payments: [] }, now);
  write(key(userId), s);
  return s;
}

export async function getMembership(userId: string, now = Date.now()): Promise<MembershipView> {
  const m = load(userId, now).membership;
  if (!m) return null;
  const end = Date.parse(m.renews_at);
  if (m.cancelled_at && end <= now) return { ...m, status: "expired", grace_until: null };
  if (m.cancelled_at) return { ...m, status: "cancelled", grace_until: null };
  if (end > now) return { ...m, status: "active", grace_until: null };
  const grace = end + GRACE_DAYS * day;
  return { ...m, status: grace > now ? "grace" : "expired", grace_until: iso(grace) };
}

export async function listPayments(userId: string, now = Date.now()) {
  return [...load(userId, now).payments].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Starts a payment. The demo stands in for the gateway: `outcome` is what the gateway will later report. The same
 * key returns the same payment, so a double tap or a retry after a timeout never charges twice.
 */
export async function checkout(userId: string, planId: PlanId, idempotencyKey: string, outcome: "success" | "failure", now = Date.now()): Promise<Payment> {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || !plan.yearly) throw new Error("That plan doesn't need a payment.");
  const s = load(userId, now);
  const same = s.payments.find((p) => p.key === idempotencyKey);
  if (same) return same;
  const { base, gst } = priceOf(plan);
  const p: Payment = { id: `pay-${now.toString(36)}`, plan: planId, amount: base, gst, status: "pending", created_at: iso(now), settled_at: null, invoice: null, key: idempotencyKey, outcome };
  write(key(userId), { ...s, payments: [...s.payments, p] });
  return p;
}

export async function getPayment(userId: string, id: string, now = Date.now()) {
  return load(userId, now).payments.find((p) => p.id === id) ?? null;
}

export async function setAutoRenew(userId: string, on: boolean, now = Date.now()) {
  const s = load(userId, now);
  if (!s.membership) throw new Error("You don't have a paid membership.");
  write(key(userId), { ...s, membership: { ...s.membership, auto_renew: on } });
}

/** Within 7 days of the first payment: refunded and ended now. Otherwise it runs to its end date. */
export async function cancelMembership(userId: string, now = Date.now()): Promise<{ refunded: boolean }> {
  const s = load(userId, now);
  if (!s.membership) throw new Error("You don't have a paid membership.");
  const first = s.payments.filter((p) => p.status === "paid").sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const refunded = !!first && now - Date.parse(first.settled_at!) < 7 * day && s.payments.filter((p) => p.status === "paid").length === 1;
  write(key(userId), {
    ...s,
    membership: { ...s.membership, auto_renew: false, cancelled_at: iso(now), ...(refunded ? { renews_at: iso(now) } : {}) },
  });
  return { refunded };
}

/** Usage against the plan's limits, for the meters (demo numbers, partway through the month). */
export function usage(plan: PlanId | null, now = Date.now()) {
  const d = new Date(now + 5.5 * 3_600_000);
  const resets = iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 5.5 * 3_600_000);
  if (plan === "student")
    return [
      { feature: "Scholar questions", used: 168, limit: 200, resets_at: resets },
      { feature: "Scholar presentations", used: 3, limit: 10, resets_at: resets },
    ];
  return [{ feature: "Records storage (MB)", used: 1, limit: 100, resets_at: null }];
}

export function receiptPdf(p: Payment, name: string): Blob {
  const plan = PLANS.find((x) => x.id === p.plan)!;
  return demoPdf(`Receipt ${p.invoice}`, [
    "FindMyDentist (demo) · GSTIN to be added",
    `Billed to: ${name}`,
    `Paid on: ${p.settled_at?.slice(0, 10)}`,
    "",
    `${plan.name} membership, 1 year: Rs. ${p.amount}`,
    `GST at 18%: Rs. ${p.gst}`,
    `Total paid: Rs. ${p.amount + p.gst}`,
    "",
    `Payment reference: ${p.id}`,
    "DEMO RECEIPT · no real payment was taken",
  ]);
}
