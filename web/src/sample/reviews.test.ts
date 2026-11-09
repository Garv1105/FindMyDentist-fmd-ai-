import assert from "node:assert/strict";
import { test } from "node:test";
import { feed } from "./content.ts";
import { getInterests, resetPersonalisation, saveInterests } from "./personalisation.ts";
import { setConsent } from "./privacy.ts";
import { checkFeedback, dentistReviews, feedbackInvites, snoozeInvite, submitFeedback } from "./reviews.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const R = { access: 4, communication: 5, environment: 4, overall: 2 };

test("one invitation, for a recent completed visit; Not now snoozes it", async () => {
  const [inv] = await feedbackInvites("r1", NOW);
  assert.equal(inv.booking_id, "demo-past-01");
  await snoozeInvite("r1", inv.booking_id, NOW);
  assert.equal((await feedbackInvites("r1", NOW + 86_400_000)).length, 0);
  // two weeks on, the first visit is over 30 days old; the later demo visit has happened and gets its own invitation
  assert.deepEqual((await feedbackInvites("r1", NOW + 15 * 86_400_000)).map((i) => i.booking_id), ["demo-move-03"]);
});

test("only completed visits, once; experience ratings only; low ratings still show publicly", async () => {
  await assert.rejects(submitFeedback("r2", "Priya Sharma", "demo-move-03", { ratings: R, comment: "", visibility: "public" }, NOW), /completed/);
  assert.match(checkFeedback({ ratings: { ...R, overall: 0 }, comment: "" })!, /four parts/);
  assert.match(checkFeedback({ ratings: R, comment: "call me on 9876543210" })!, /phone numbers/);
  const r = await submitFeedback("r2", "Priya Sharma", "demo-past-01", { ratings: R, comment: "Long wait.", visibility: "public" }, NOW);
  assert.equal(r.verified_visit, true);
  assert.equal(r.author, "Priya");
  await assert.rejects(submitFeedback("r2", "Priya Sharma", "demo-past-01", { ratings: R, comment: "", visibility: "public" }, NOW), /already/);
  const list = await dentistReviews("r2", "aditi-sharma");
  assert.equal(list.items[0].id, r.id, "newest first, a 2/5 overall is not hidden");
  assert.equal(list.count, 3);
});

test("private feedback never appears publicly", async () => {
  await submitFeedback("r3", "Ravi K", "demo-past-01", { ratings: R, comment: "For the clinic only", visibility: "private" }, NOW);
  assert.ok(!(await dentistReviews("r3", "aditi-sharma")).items.some((x) => x.comment === "For the clinic only"));
});

test("declared interests lead the feed, only with consent; reset forgets them", async () => {
  await saveInterests("r4", { topics: ["Kids"], concerns: [] });
  assert.ok(!(await feed("r4", "for_you"))[0].reason.includes("interested"), "no consent, no personalisation");
  await setConsent("r4", "personalisation", true);
  const f = await feed("r4", "for_you");
  assert.equal(f[0].topic, "Kids");
  assert.match(f[0].reason, /interested in kids/);
  await resetPersonalisation("r4");
  assert.deepEqual(await getInterests("r4"), { topics: [], concerns: [] });
});
