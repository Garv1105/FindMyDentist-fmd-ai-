import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelMembership, checkout, getMembership, getPayment, GRACE_DAYS, priceOf, PLANS, usage, WEBHOOK_MS } from "./billing.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const DAY = 86_400_000;

test("prices with GST, shown before paying", () => {
  assert.deepEqual(priceOf(PLANS.find((p) => p.id === "dentist")!), { base: 550, gst: 99, total: 649 });
  assert.equal(priceOf(PLANS.find((p) => p.id === "patient")!).total, 0);
});

test("paid only when the gateway says so; the same key never charges twice", async () => {
  const p = await checkout("b1", "student", "k1", "success", NOW);
  assert.equal(p.status, "pending");
  assert.equal(await getMembership("b1", NOW), null, "coming back from the gateway isn't payment");
  assert.equal((await checkout("b1", "student", "k1", "success", NOW)).id, p.id);
  const paid = (await getPayment("b1", p.id, NOW + WEBHOOK_MS))!;
  assert.equal(paid.status, "paid");
  assert.match(paid.invoice!, /^FMD-INV-/);
  const m = (await getMembership("b1", NOW + WEBHOOK_MS))!;
  assert.equal(m.status, "active");
  await assert.rejects(checkout("b1", "patient", "k2", "success", NOW), /doesn't need a payment/);
});

test("a failed payment starts nothing", async () => {
  const p = await checkout("b2", "dentist", "k", "failure", NOW);
  assert.equal((await getPayment("b2", p.id, NOW + WEBHOOK_MS))!.status, "failed");
  assert.equal(await getMembership("b2", NOW + WEBHOOK_MS), null);
});

test("after the end date: a grace period, then expired", async () => {
  await checkout("b3", "dentist", "k", "success", NOW);
  const end = Date.parse((await getMembership("b3", NOW + WEBHOOK_MS))!.renews_at);
  assert.equal((await getMembership("b3", end + DAY))!.status, "grace");
  assert.equal((await getMembership("b3", end + (GRACE_DAYS + 1) * DAY))!.status, "expired");
});

test("cancelling: refunded within 7 days, otherwise runs to the end", async () => {
  await checkout("b4", "company", "k", "success", NOW);
  assert.deepEqual(await cancelMembership("b4", NOW + 2 * DAY), { refunded: true });
  assert.equal((await getMembership("b4", NOW + 2 * DAY + 1))!.status, "expired");
  await checkout("b5", "company", "k", "success", NOW);
  assert.deepEqual(await cancelMembership("b5", NOW + 30 * DAY), { refunded: false });
  assert.equal((await getMembership("b5", NOW + 31 * DAY))!.status, "cancelled");
  // buying a plan again after cancelling starts it renewing, not "renewal off"
  await checkout("b5", "student", "k2", "success", NOW + 32 * DAY);
  assert.equal((await getMembership("b5", NOW + 32 * DAY + 3000))!.auto_renew, true);
});

test("student usage is shown with its limit and reset date", () => {
  const u = usage("student", NOW);
  assert.ok(u[0].used < u[0].limit && u[0].resets_at!.startsWith("2026-11-30"));
});
