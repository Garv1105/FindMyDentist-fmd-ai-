import assert from "node:assert/strict";
import { test } from "node:test";
import { addComment, checkDraft, comments, DEID_CHECKS, feed, importPreview, myPosts, newDraft, noteSearch, report, REVIEW_MS, saveDraft, toggleFollow, vote } from "./content.ts";
import { setConsent } from "./privacy.ts";

test("the feed: a reason on every card, one labelled sponsored post, never in Following", async () => {
  const f = await feed(null, "for_you");
  assert.ok(f.every((p) => p.reason));
  assert.equal(f.filter((p) => p.sponsored_by).length, 1);
  assert.match(f.find((p) => p.sponsored_by)!.reason, /paid placement/);
  await toggleFollow("u1", "priyanka-shah");
  assert.ok((await feed("u1", "following")).every((p) => !p.sponsored_by));
  assert.ok((await feed(null, "reels")).every((p) => p.kind === "video"));
});

test("a past search shapes the feed only with the personalisation consent", async () => {
  await noteSearch("u2", "braces for my son");
  assert.ok(!(await feed("u2", "for_you")).some((p) => /searched/.test(p.reason)), "no consent: the search isn't used");
  await setConsent("u2", "personalisation", true);
  await noteSearch("u2", "braces for my son");
  const f = await feed("u2", "for_you");
  assert.equal(f[0].topic, "Orthodontics");
  assert.match(f[0].reason, /searched for/);
  assert.ok(f.some((p) => p.topic !== "Orthodontics"), "general education is still mixed in");
});

test("polls show results only after voting, once", async () => {
  assert.equal((await feed("u3", "for_you")).find((p) => p.poll)!.votes, null);
  await vote("u3", "p-gums-poll", 1);
  assert.deepEqual((await feed("u3", "for_you")).find((p) => p.poll)!.votes, [41, 64, 18, 12]);
  await assert.rejects(vote("u3", "p-gums-poll", 2), /already/);
});

test("signed-out people can read but not act; comments and reports have rules", async () => {
  await assert.rejects(vote(null, "p-gums-poll", 0), /Log in/);
  await assert.rejects(addComment("u4", "Me", "p-kids", "  "), /Write something/);
  await addComment("u4", "Me", "p-kids", "Thanks, very helpful");
  assert.equal((await comments("u4", "p-kids")).filter((c) => c.mine).length, 1);
  await assert.rejects(report("u4", "p-kids", "", ""), /Choose/);
  await assert.rejects(report("u4", "p-kids", "other", ""), /Tell us/);
  await report("u4", "p-kids", "misinformation", "");
  await assert.rejects(report("u4", "p-kids", "spam", ""), /already/);
});

test("creating posts: patient cases need consent and every privacy check; imports only from supported platforms", () => {
  const d = { ...newDraft(), title: "Gap closed", body: "Bonding case", owns: true, is_case: true };
  assert.match(checkDraft(d)!, /documented consent/);
  assert.match(checkDraft({ ...d, consent: { kind: "clinic_record", ref: "CR-12" } })!, /privacy check/);
  assert.equal(checkDraft({ ...d, consent: { kind: "clinic_record", ref: "CR-12" }, deidentified: DEID_CHECKS }), null);
  assert.match(checkDraft({ ...newDraft(), title: "x", body: "y", owns: false })!, /own this content/);
  assert.equal((importPreview("https://youtu.be/abcdef123") as { platform: string }).platform, "YouTube");
  assert.match((importPreview("https://example.com/video.mp4") as { error: string }).error, /upload it instead/);
});

test("a submitted post is reviewed, then published", async () => {
  const now = Date.parse("2026-11-10T11:00:00+05:30");
  const d = await saveDraft("u5", { ...newDraft(), title: "Floss daily", body: "Once a day.", owns: true }, true, now);
  assert.equal(d.status, "in_review");
  assert.equal((await myPosts("u5", now + REVIEW_MS)).find((x) => x.id === d.id)!.status, "published");
  assert.ok((await myPosts("u5", now)).some((x) => x.status === "rejected" && x.reason));
});
