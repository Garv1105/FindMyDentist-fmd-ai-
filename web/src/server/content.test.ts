import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "./auth.ts";
import { addComment, createPost, decideReport, feed, moderatePost, report, reviewQueue, setInterests, setSponsor, toggle, toggleFollow, vote } from "./content.ts";
import { myJobs, postJob, searchJobs, updateJob } from "./jobs.ts";
import { seedDemoContent, seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => {
  resetDb();
  seedDemoDirectory();
  seedDemoContent();
});

function user(email: string, accountType = "patient", role?: "moderator" | "fmd_ops"): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: "Test User", accountType, consents: { terms: true, privacy: true } });
  const req = () => new Request("http://x/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  if (role) grantRole(requireAuth(req()).user.id, role, null);
  return requireAuth(req());
}
function verifiedDentist(email: string, profile = "Dr. Venkat Rao") {
  const d = user(email, "dentist");
  run("UPDATE dentists SET user_id = ?, verification_status = 'verified' WHERE name = ?", d.user.id, profile);
  return d;
}
const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const post = { kind: "education", topic: "Root canal", title: "Root canal myths", body: "A root canal relieves pain rather than causing it, and modern treatment is usually comfortable." };

test("only verified dentists publish, and nothing is public before review", () => {
  assert.equal(status(() => createPost(user("p@example.com"), post)), 403);
  assert.equal(status(() => createPost(user("u@example.com", "dentist"), post)), 403); // unverified dentist
  const d = verifiedDentist("d@example.com");
  const { id } = createPost(d, post);
  assert.ok(!feed(null).items.some((i) => i.id === id));
  const mod = user("m@example.com", "patient", "moderator");
  assert.equal(status(() => moderatePost(d, id, { decision: "publish" })), 403);
  assert.equal(reviewQueue(mod).posts.length, 1);
  moderatePost(mod, id, { decision: "publish" });
  assert.ok(feed(null).items.some((i) => i.id === id));
});

test("case posts are refused without consent reference and attestations", () => {
  const d = verifiedDentist("d@example.com");
  const c = { ...post, kind: "case", title: "Case: replacing a front tooth" };
  assert.equal(status(() => createPost(d, c)), 400);
  assert.equal(status(() => createPost(d, { ...c, caseConsentRef: "CONS-2026-014", caseDeidentified: true })), 400);
  assert.equal(createPost(d, { ...c, caseConsentRef: "CONS-2026-014", caseDeidentified: true, caseClinicallyReviewed: true }).status, "in_review");
});

test("feed explains itself; interests and follows rank first; reset works; sponsorship by staff only", () => {
  const p = user("p@example.com");
  assert.ok(feed(p).items.every((i) => i.reason === "General dental education"));
  setInterests(p, ["Kids", "Not a topic"]);
  const f = feed(p);
  assert.equal(f.items[0].topic, "Kids");
  assert.equal(f.items[0].reason, "You're interested in Kids");
  assert.ok(f.items.some((i) => i.reason === "General dental education")); // not only past interests
  const rohan = one<{ id: string }>("SELECT id FROM dentists WHERE name = 'Dr. Rohan Mehta'")!.id;
  toggleFollow(p, rohan);
  assert.equal(feed(p).items[0].reason, "From a dentist you follow");
  assert.equal(feed(p, { tab: "following" }).items.length, 1);
  setInterests(p, []);
  toggleFollow(p, rohan);
  assert.ok(feed(p).items.every((i) => i.reason === "General dental education"));

  const target = feed(null).items[0].id;
  assert.equal(status(() => setSponsor(p, target, "Brand")), 403);
  setSponsor(user("ops@example.com", "patient", "fmd_ops"), target, "Demo Brand");
  assert.equal(feed(null).items.find((i) => i.id === target)!.sponsoredBy, "Demo Brand");
});

test("likes, saves, polls (results only after voting), comments", () => {
  const p = user("p@example.com");
  const items = feed(p).items;
  const pollItem = items.find((i) => i.kind === "poll")!;
  assert.ok(pollItem.poll!.options.every((o) => o.votes === null)); // hidden before voting
  const after = vote(p, pollItem.id, pollItem.poll!.options[1].id);
  assert.equal(after.total, 1);
  assert.equal(status(() => vote(p, pollItem.id, pollItem.poll!.options[0].id)), 409);
  toggle(p, items[0].id, "like");
  toggle(p, items[0].id, "save");
  assert.equal(feed(p, { tab: "saved" }).items.length, 1);
  assert.equal(feed(p).items.find((i) => i.id === items[0].id)!.likes, 1);
  assert.equal(addComment(p, items[0].id, "Very helpful, thank you").length, 1);
  assert.equal(status(() => addComment(p, items[0].id, "x")), 400);
});

test("reports go to moderation; removal takes content down; duplicate reports refused", () => {
  const p = user("p@example.com");
  const q = user("q@example.com");
  const mod = user("m@example.com", "patient", "moderator");
  const target = feed(null).items[0].id;
  assert.equal(status(() => report(p, { targetType: "post", targetId: target, category: "made_up" })), 400);
  report(p, { targetType: "post", targetId: target, category: "misinformation", note: "outdated advice" });
  report(q, { targetType: "post", targetId: target, category: "misleading_claims" });
  assert.equal(status(() => report(p, { targetType: "post", targetId: target, category: "spam" })), 409);
  const rq = reviewQueue(mod).reports;
  assert.equal(rq.length, 2);
  decideReport(mod, rq[0].id, { action: "remove", note: "Outdated guidance" });
  assert.ok(!feed(null).items.some((i) => i.id === target));
  assert.equal(reviewQueue(mod).reports.length, 0); // all reports on that post resolved together
});

test("jobs: posting permission, honest employer label, expiry, renew/close, report removal", () => {
  const p = user("p@example.com");
  const co = user("co@example.com", "company");
  const mod = user("m@example.com", "patient", "moderator");
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
  assert.equal(status(() => postJob(p, job)), 403);
  assert.equal(status(() => postJob(co, { ...job, applyMethod: "url", applyValue: "http://insecure.example" })), 400);
  const j = postJob(co, job);
  assert.equal(j.employerVerified, false);
  assert.equal(searchJobs(null, { city: "Bengaluru", q: "associate" }).length, 1);
  run("UPDATE jobs SET expires_at = ?", Date.now() - 1);
  assert.equal(searchJobs(null).length, 0);
  assert.equal(myJobs(co)[0].status, "expired");
  updateJob(co, j.id, "renew");
  assert.equal(searchJobs(null).length, 1);
  assert.equal(status(() => updateJob(p, j.id, "close")), 404);
  report(p, { targetType: "job", targetId: j.id, category: "spam" });
  decideReport(mod, reviewQueue(mod).reports[0].id, { action: "remove", note: "Fake listing" });
  assert.equal(searchJobs(null).length, 0);
  assert.equal(status(() => updateJob(co, j.id, "renew")), 409);
});
