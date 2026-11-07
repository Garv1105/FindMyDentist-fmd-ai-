import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { addComment, createPost, decideReport, feed, moderatePost, report, reviewQueue, setInterests, setSponsor, toggle, toggleFollow, vote } from "./content.ts";
import { myJobs, postJob, searchJobs, updateJob } from "./jobs.ts";
import { seedDemoContent, seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => {
  await resetDb();
  await seedDemoDirectory();
  await seedDemoContent();
});

async function user(email: string, accountType = "patient", role?: "moderator" | "fmd_ops"): Promise<Auth> {
  return await testUser(email, { accountType, roles: role ? [role] : [] });
}
async function verifiedDentist(email: string, profile = "Dr. Venkat Rao") {
  const d = await user(email, "dentist");
  await run("UPDATE dentists SET user_id = ?, verification_status = 'verified' WHERE name = ?", d.user.id, profile);
  return d;
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const post = { kind: "education", topic: "Root canal", title: "Root canal myths", body: "A root canal relieves pain rather than causing it, and modern treatment is usually comfortable." };

test("only verified dentists publish, and nothing is public before review", async () => {
  assert.equal(await status(async () => await createPost(await user("p@example.com"), post)), 403);
  assert.equal(await status(async () => await createPost(await user("u@example.com", "dentist"), post)), 403); // unverified dentist
  const d = await verifiedDentist("d@example.com");
  const { id } = await createPost(d, post);
  assert.ok(!(await feed(null)).items.some((i) => i.id === id));
  const mod = await user("m@example.com", "patient", "moderator");
  assert.equal(await status(async () => await moderatePost(d, id, { decision: "publish" })), 403);
  assert.equal((await reviewQueue(mod)).posts.length, 1);
  await moderatePost(mod, id, { decision: "publish" });
  assert.ok((await feed(null)).items.some((i) => i.id === id));
});

test("case posts are refused without consent reference and attestations", async () => {
  const d = await verifiedDentist("d@example.com");
  const c = { ...post, kind: "case", title: "Case: replacing a front tooth" };
  assert.equal(await status(async () => await createPost(d, c)), 400);
  assert.equal(await status(async () => await createPost(d, { ...c, caseConsentRef: "CONS-2026-014", caseDeidentified: true })), 400);
  assert.equal((await createPost(d, { ...c, caseConsentRef: "CONS-2026-014", caseDeidentified: true, caseClinicallyReviewed: true })).status, "in_review");
});

test("feed explains itself; interests and follows rank first; reset works; sponsorship by staff only", async () => {
  const p = await user("p@example.com");
  assert.ok((await feed(p)).items.every((i) => i.reason === "General dental education"));
  await setInterests(p, ["Kids", "Not a topic"]);
  const f = await feed(p);
  assert.equal(f.items[0].topic, "Kids");
  assert.equal(f.items[0].reason, "You're interested in Kids");
  assert.ok(f.items.some((i) => i.reason === "General dental education")); // not only past interests
  const rohan = (await one<{ id: string }>("SELECT id FROM dentists WHERE name = 'Dr. Rohan Mehta'"))!.id;
  await toggleFollow(p, rohan);
  assert.equal((await feed(p)).items[0].reason, "From a dentist you follow");
  assert.equal((await feed(p, { tab: "following" })).items.length, 1);
  await setInterests(p, []);
  await toggleFollow(p, rohan);
  assert.ok((await feed(p)).items.every((i) => i.reason === "General dental education"));

  const target = (await feed(null)).items[0].id;
  assert.equal(await status(async () => await setSponsor(p, target, "Brand")), 403);
  await setSponsor(await user("ops@example.com", "patient", "fmd_ops"), target, "Demo Brand");
  assert.equal((await (await feed(null)).items.find((i) => i.id === target))!.sponsoredBy, "Demo Brand");
});

test("likes, saves, polls (results only after voting), comments", async () => {
  const p = await user("p@example.com");
  const items = (await feed(p)).items;
  const pollItem = (await items.find((i) => i.kind === "poll"))!;
  assert.ok(pollItem.poll!.options.every((o) => o.votes === null)); // hidden before voting
  const after = await vote(p, pollItem.id, pollItem.poll!.options[1].id);
  assert.equal(after.total, 1);
  assert.equal(await status(async () => await vote(p, pollItem.id, pollItem.poll!.options[0].id)), 409);
  await toggle(p, items[0].id, "like");
  await toggle(p, items[0].id, "save");
  assert.equal((await feed(p, { tab: "saved" })).items.length, 1);
  assert.equal((await (await feed(p)).items.find((i) => i.id === items[0].id))!.likes, 1);
  assert.equal((await addComment(p, items[0].id, "Very helpful, thank you")).length, 1);
  assert.equal(await status(async () => await addComment(p, items[0].id, "x")), 400);
});

test("reports go to moderation; removal takes content down; duplicate reports refused", async () => {
  const p = await user("p@example.com");
  const q = await user("q@example.com");
  const mod = await user("m@example.com", "patient", "moderator");
  const target = (await feed(null)).items[0].id;
  assert.equal(await status(async () => await report(p, { targetType: "post", targetId: target, category: "made_up" })), 400);
  await report(p, { targetType: "post", targetId: target, category: "misinformation", note: "outdated advice" });
  await report(q, { targetType: "post", targetId: target, category: "misleading_claims" });
  assert.equal(await status(async () => await report(p, { targetType: "post", targetId: target, category: "spam" })), 409);
  const rq = (await reviewQueue(mod)).reports;
  assert.equal(rq.length, 2);
  await decideReport(mod, rq[0].id, { action: "remove", note: "Outdated guidance" });
  assert.ok(!(await feed(null)).items.some((i) => i.id === target));
  assert.equal((await reviewQueue(mod)).reports.length, 0); // all reports on that post resolved together
});

test("jobs: posting permission, honest employer label, expiry, renew/close, report removal", async () => {
  const p = await user("p@example.com");
  const co = await user("co@example.com", "company");
  const mod = await user("m@example.com", "patient", "moderator");
  const job = {
    orgName: "Demo Dental Group",
    title: "Associate dentist (general)",
    roleType: "associate",
    city: "Bengaluru",
    area: "Whitefield",
    description: "Full-time associate for a busy family practice; mentoring available.",
    applyMethod: "email",
    applyValue: "jobs@demo.example",
  };
  assert.equal(await status(async () => await postJob(p, job)), 403);
  assert.equal(await status(async () => await postJob(co, { ...job, applyMethod: "url", applyValue: "http://insecure.example" })), 400);
  const j = await postJob(co, job);
  assert.equal(j.employerVerified, false);
  assert.equal((await searchJobs(null, { city: "Bengaluru", q: "associate" })).length, 1);
  await run("UPDATE jobs SET expires_at = ?", Date.now() - 1);
  assert.equal((await searchJobs(null)).length, 0);
  assert.equal((await myJobs(co))[0].status, "expired");
  await updateJob(co, j.id, "renew");
  assert.equal((await searchJobs(null)).length, 1);
  assert.equal(await status(async () => await updateJob(p, j.id, "close")), 404);
  await report(p, { targetType: "job", targetId: j.id, category: "spam" });
  await decideReport(mod, (await reviewQueue(mod)).reports[0].id, { action: "remove", note: "Fake listing" });
  assert.equal((await searchJobs(null)).length, 0);
  assert.equal(await status(async () => await updateJob(co, j.id, "renew")), 409);
});
