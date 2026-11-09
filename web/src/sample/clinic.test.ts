import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  CHAIRS, cleanBranch, cleanDate, briefingText, dayAppointments, decideAiTask, getClinic, getClinicHome, listNotices, markNoticesRead, resetSample, toggleFollowUp,
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
  const t = briefingText({ ...h, counts: { ...h.counts, unconfirmed: 0, recallDue: 0 } });
  assert.doesNotMatch(t, /haven't confirmed|recall/);
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

test("reminder task only on today, and only while someone is unconfirmed", async () => {
  assert.ok((await home()).tasks.some((t) => t.id === "t-reminders"));
  assert.ok(!(await home("2026-11-15")).tasks.some((t) => t.id === "t-reminders"));
  assert.ok(!(await home("2026-11-11")).tasks.some((t) => t.id === "t-reminders"));
  const evening = await getClinicHome("smile-studio", { date: "2026-11-10", branchId: "main", now: new Date("2026-11-10T19:00:00+05:30") });
  assert.ok(!evening.tasks.some((t) => t.id === "t-reminders"));
});

test("cleanDate keeps real YYYY-MM-DD dates only", () => {
  assert.equal(cleanDate("2026-11-10", "2026-11-09"), "2026-11-10");
  for (const bad of [null, "", "garbage", "2026-13-45", "2026-02-30", "2026-1-1"]) assert.equal(cleanDate(bad, "2026-11-09"), "2026-11-09");
});

test("cleanBranch keeps known branches or all", async () => {
  const c = (await getClinic("smile-studio"))!;
  assert.equal(cleanBranch("kora", c), "kora");
  assert.equal(cleanBranch("all", c), "all");
  assert.equal(cleanBranch("nope", c), "main");
  assert.equal(cleanBranch(null, c), "main");
});

test("no chair is double-booked, and nothing crosses lunch or closing", async () => {
  for (const branchId of ["main", "kora"]) {
    const appts = dayAppointments(branchId, "2026-11-10", now);
    const byChair = Map.groupBy(appts, (a) => a.chair);
    for (const [chair, list] of byChair) {
      const spans = list.map((a) => [Date.parse(a.start), Date.parse(a.start) + a.minutes * 60_000] as const).sort((x, y) => x[0] - y[0]);
      for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] >= spans[i - 1][1], `${branchId} ${chair} overlap`);
      for (const [s, e] of spans) {
        const lunchS = Date.parse("2026-11-10T13:00:00+05:30"), lunchE = Date.parse("2026-11-10T14:00:00+05:30");
        assert.ok(e <= lunchS || s >= lunchE, `${branchId} ${chair} crosses lunch`);
        assert.ok(e <= Date.parse("2026-11-10T19:00:00+05:30"), `${branchId} ${chair} after closing`);
      }
    }
  }
});

test("each chair has one dentist", async () => {
  for (const branchId of ["main", "kora"]) {
    const appts = dayAppointments(branchId, "2026-11-10", now);
    for (const c of CHAIRS[branchId]) assert.ok(appts.filter((a) => a.chair === c.chair).every((a) => a.dentist === c.dentist), `${branchId} ${c.chair}`);
  }
  assert.deepEqual(CHAIRS.main.map((c) => c.chair), ["Chair 1", "Chair 2", "Chair 3"]);
});

test("appointment ids are unique on every day of the week", () => {
  for (let d = 9; d <= 14; d++) {
    const date = `2026-11-${String(d).padStart(2, "0")}`;
    const ids = ["main", "kora"].flatMap((b) => dayAppointments(b, date, now)).map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, date);
  }
});

test("the week isn't the same every day: Saturday is mornings only", () => {
  const count = (date: string) => dayAppointments("main", date, now).length;
  assert.equal(count("2026-11-10"), 14);
  assert.ok(count("2026-11-14") < count("2026-11-12") && count("2026-11-12") < count("2026-11-10"));
  assert.ok(dayAppointments("main", "2026-11-14", now).every((a) => a.start.slice(11, 16) < "13:00"));
});

test("no inventory: no stock in Home, the briefing or the AI tasks; recall needs approval instead", async () => {
  const h = await home();
  assert.ok(!("stockAlerts" in h.attention));
  assert.ok(!("lowStock" in h));
  assert.doesNotMatch(briefingText(h), /stock|run out|composite/i);
  assert.ok(!h.tasks.some((t) => /purchase order/i.test(t.title)));
  const recall = h.tasks.find((t) => t.id === "t-recall");
  assert.equal(recall?.needsApproval, true);
  assert.ok(recall?.preview && "recipients" in recall.preview && recall.preview.recipients.length === 2);
  assert.equal(h.attention.unsignedNotes, 2);
  assert.equal(h.attention.overdueFollowUps, 1);
  assert.ok(!(await listNotices("smile-studio")).some((n) => /inventory|reorder/i.test(n.text + n.href)));
});
