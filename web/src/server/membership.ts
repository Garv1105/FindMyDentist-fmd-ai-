import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { requireRole, type Auth } from "./auth.ts";
import { bad, HttpError, notFound } from "./http.ts";

/**
 * Plans, subscriptions and entitlements (PRD §2, §14, PLT-02).
 * Entitlements are computed on the server from subscription state; clients never decide access.
 */

type Plan = {
  code: string;
  product: "main_membership" | "clinic_os" | "scholar_upgrade";
  audience: string;
  name: string;
  price_paise: number;
  period: "year" | "month" | "one_time" | "none";
  features: string;
  usage_limits: string;
  pending_decision: string | null;
};
type Sub = { id: string; plan_code: string; status: string; starts_at: number | null; ends_at: number | null; source: string; created_at: number };

const GST_NOTE = "Prices exclude GST, which is added at checkout as applicable.";
const TERMS_NOTE = "Cancellation and refund terms will be shown here before purchase once published.";
// OD-05: grace period after expiry is undecided — provisional value, configurable
const GRACE_DAYS = Number(process.env.FMD_MEMBERSHIP_GRACE_DAYS ?? 0);

function planView(p: Plan) {
  return {
    code: p.code,
    product: p.product,
    audience: p.audience,
    name: p.name,
    priceInr: p.price_paise / 100,
    period: p.period,
    features: JSON.parse(p.features) as string[],
    usageLimits: JSON.parse(p.usage_limits) as Record<string, number>,
    pendingDecision: p.pending_decision,
    taxNote: p.price_paise ? GST_NOTE : null,
    termsNote: p.price_paise ? TERMS_NOTE : null,
  };
}

/** Plans relevant to the signed-in account type. Clinic OS is listed separately — it is a different product. */
export function catalogFor(a: Auth) {
  const plans = all<Plan>("SELECT * FROM plans WHERE active = 1");
  const membership = plans.find((p) => p.product === "main_membership" && p.audience === a.user.account_type)!;
  return {
    membership: planView(membership),
    addOns: plans.filter((p) => p.product === "scholar_upgrade" && a.user.account_type === "student").map(planView),
    separateProducts: plans.filter((p) => p.product === "clinic_os" && a.user.account_type === "dentist").map(planView),
    checkout: { available: false, reason: "Online payment isn't available yet. The payment provider and settlement model are still being finalised." },
  };
}

function activeSubs(userId: string, now = Date.now()) {
  return all<Sub>("SELECT id, plan_code, status, starts_at, ends_at, source, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC", userId).filter(
    (s) => s.status === "active" && (s.ends_at === null || s.ends_at + GRACE_DAYS * 86400_000 > now),
  );
}

/** Single source of truth for access decisions. */
export function entitlementsOf(a: Auth, now = Date.now()) {
  const subs = activeSubs(a.user.id, now);
  const has = (code: string) => subs.some((s) => s.plan_code === code);
  const student = a.user.account_type === "student" && has("main_student");
  return {
    mainMembership: a.user.account_type === "patient" ? true : has(`main_${a.user.account_type}`),
    scholar: student, // PRD §8.1: Scholar comes with an active student membership; no assumed access for others (OD-05)
    clinicOs: has("clinic_os"),
  };
}

export function membershipStatus(a: Auth) {
  const now = Date.now();
  const all_ = all<Sub>("SELECT id, plan_code, status, starts_at, ends_at, source, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC", a.user.id);
  const current = all_.find((s) => s.plan_code === `main_${a.user.account_type}`);
  const inGrace = current?.status === "active" && current.ends_at !== null && current.ends_at < now;
  return {
    accountType: a.user.account_type,
    catalog: catalogFor(a),
    current: current
      ? {
          planCode: current.plan_code,
          status: inGrace ? "grace" : current.status,
          startsAt: current.starts_at,
          renewsOrEndsAt: current.ends_at,
          source: current.source,
        }
      : a.user.account_type === "patient"
        ? { planCode: "main_patient", status: "active", startsAt: null, renewsOrEndsAt: null, source: "free" }
        : null,
    entitlements: entitlementsOf(a, now),
    usage: usageFor(a, now),
  };
}

/* ---------------- usage meters (MAIN-05, SCH-29) ---------------- */

const monthStart = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

export function usageFor(a: Auth, now = Date.now()) {
  if (!entitlementsOf(a, now).scholar) return [];
  const limits = planView(one<Plan>("SELECT * FROM plans WHERE code = 'main_student'")!).usageLimits;
  const used = one<{ used: number }>("SELECT used FROM usage_counters WHERE user_id = ? AND feature = 'scholar_requests' AND period_start = ?", a.user.id, monthStart(now))?.used ?? 0;
  return [{ feature: "scholar_requests", label: "Scholar requests this month", used, limit: limits.scholar_requests_per_month ?? null, provisional: true }];
}

/** Atomically consume one unit; refuses (with the upgrade path) at the limit instead of silently charging. */
export function consume(a: Auth, feature: "scholar_requests", now = Date.now()) {
  const u = usageFor(a, now).find((x) => x.feature === feature);
  if (!u) throw new HttpError(403, "not_entitled", "This needs an active student membership.");
  if (u.limit !== null && u.used >= u.limit)
    throw new HttpError(429, "limit_reached", "You've used this month's included Scholar requests. The optional upgrade is shown in your membership page.");
  run(
    "INSERT INTO usage_counters (user_id, feature, period_start, used) VALUES (?, ?, ?, 1) ON CONFLICT (user_id, feature, period_start) DO UPDATE SET used = used + 1",
    a.user.id,
    feature,
    monthStart(now),
  );
}

/* ---------------- staff: record an offline / verified membership ---------------- */

/**
 * Until a gateway exists, FMD staff can activate a membership after verifying eligibility and an
 * offline payment. Evidence is required and audited (COM-05).
 */
export function activateMembership(staff: Auth, input: Record<string, unknown>) {
  requireRole(staff, "fmd_ops", "super_admin");
  const userId = typeof input.userId === "string" ? input.userId : "";
  const u = one<{ account_type: string }>("SELECT account_type FROM users WHERE id = ?", userId);
  if (!u) throw notFound("User not found.");
  const plan = one<Plan>("SELECT * FROM plans WHERE code = ?", `main_${u.account_type}`);
  if (!plan || plan.price_paise === 0) throw bad("This account type has no paid membership.");
  const evidence = typeof input.evidence === "string" ? input.evidence.trim() : "";
  if (evidence.length < 6) throw bad("Record the payment reference and the verification performed.");
  const now = Date.now();
  const id = randomUUID();
  tx(() => {
    run("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND plan_code = ? AND status = 'active'", userId, plan.code);
    run(
      "INSERT INTO subscriptions (id, user_id, plan_code, status, starts_at, ends_at, source, evidence, created_by, created_at) VALUES (?, ?, ?, 'active', ?, ?, 'manual', ?, ?, ?)",
      id, userId, plan.code, now, now + 365 * 86400_000, evidence, staff.user.id, now,
    );
    audit(staff.user.id, "membership.activated", "user", userId, { plan: plan.code, subscriptionId: id });
  });
  return { subscriptionId: id };
}
