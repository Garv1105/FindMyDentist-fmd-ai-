import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  briefingText, decideAiTask, getClinic, getClinicHome, listNotices, markNoticesRead, resetSample, toggleFollowUp,
} from "./clinic.ts";

beforeEach(resetSample);
const now = new Date("2026-11-10T10:40:00+05:30"); // a Tuesday
const home = (date = "2026-11-10", branchId = "main") => getClinicHome("smile-studio", { date, branchId, now });

test("unknown clinic", async () => {
  assert.equal(await getClinic("nope"), null);
  await assert.rejects(getClinicHome("nope", { date: "2026-11-10", branchId: "main", now }));
});

test("the demo clinic has two branches", async () => {
  const c = await getClinic("smile-studio");
  assert.equal(c?.name, "Smile Studio Dental");
  assert.deepEqual(c?.branches.map((b) => b.id), ["main", "kora"]);
});

test("today, main branch: counts add up and match the mockup", async () => {
  const h = await home();
  assert.equal(h.counts.total, 14);
  assert.equal(h.counts.noShow, 1);
  assert.equal(h.counts.unconfirmed, 3);
  assert.equal(h.next.length, 5);
  assert.ok(h.next.every((a) => a.status !== "completed" && a.status !== "no_show" && a.status !== "cancelled"));
  assert.equal(h.tasks.filter((t) => t.needsApproval).length, 2);
});

test("all branches = main + kora", async () => {
  const [m, k, all] = await Promise.all([home("2026-11-10", "main"), home("2026-11-10", "kora"), home("2026-11-10", "all")]);
  assert.equal(all.counts.total, m.counts.total + k.counts.total);
  assert.ok(k.counts.total > 0);
});

test("past days are finished, future days are booked", async () => {
  const past = await home("2026-11-09");
  assert.equal(past.next.length, 0);
  assert.equal(past.counts.unconfirmed, 0);
  const future = await home("2026-11-11");
  assert.equal(future.counts.checkedIn + future.counts.completed + future.counts.noShow, 0);
  assert.equal(future.counts.unconfirmed, 2);
});

test("Sunday is empty and the briefing says so", async () => {
  const h = await home("2026-11-15");
  assert.equal(h.counts.total, 0);
  assert.equal(h.next.length, 0);
  assert.equal(h.firstAt, null);
  assert.equal(briefingText(h), "No appointments on this day.");
  const sundayToday = await getClinicHome("smile-studio", { date: "2026-11-15", branchId: "main", now: new Date("2026-11-15T10:00:00+05:30") });
  assert.equal(briefingText(sundayToday), "No appointments today.");
});

test("briefing mentions the real numbers", async () => {
  const t = briefingText(await home());
  assert.match(t, /14 appointments/);
  assert.match(t, /3 patients haven't confirmed/);
});

test("briefing drops clauses that are zero", async () => {
  const h = await home();
  const t = briefingText({ ...h, counts: { ...h.counts, unconfirmed: 0, recallDue: 0 }, lowStock: null });
  assert.doesNotMatch(t, /haven't confirmed|recall|run out/);
});

test("approving twice is harmless", async () => {
  const id = (await home()).tasks[0].id;
  assert.equal((await decideAiTask("smile-studio", id, "approve")).status, "approved");
  assert.equal((await decideAiTask("smile-studio", id, "approve")).status, "approved");
  assert.equal((await home()).tasks.filter((t) => t.status === "approved").length, 1);
});

test("unknown task id rejects", async () => {
  await assert.rejects(decideAiTask("smile-studio", "nope", "approve"));
});

test("skip then undo returns to proposed; approved can't be undone", async () => {
  const [a, b] = (await home()).tasks;
  await decideAiTask("smile-studio", a.id, "skip");
  assert.equal((await decideAiTask("smile-studio", a.id, "undo")).status, "proposed");
  await decideAiTask("smile-studio", b.id, "approve");
  assert.equal((await decideAiTask("smile-studio", b.id, "undo")).status, "approved");
});

test("follow-up tick toggles and is remembered", async () => {
  const f = (await home()).followUps[0];
  assert.equal((await toggleFollowUp("smile-studio", f.id)).done, !f.done);
  assert.equal((await home()).followUps.find((x) => x.id === f.id)?.done, !f.done);
});

test("notices: unread until marked read", async () => {
  assert.ok((await listNotices("smile-studio")).some((n) => !n.read));
  await markNoticesRead("smile-studio");
  assert.ok((await listNotices("smile-studio")).every((n) => n.read));
});
