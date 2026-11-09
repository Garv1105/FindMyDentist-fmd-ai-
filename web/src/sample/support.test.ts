import assert from "node:assert/strict";
import { test } from "node:test";
import { checkout } from "./billing.ts";
import { checkTicket, getTicket, raiseTicket, reopenTicket, replyTicket, REPLY_MS, searchArticles } from "./help.ts";
import { listNotifications, markRead } from "./notifications.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const SIGNED_UP = "2026-11-01T10:00:00.000Z";

test("notifications come from what happened, open the right page, and carry no clinical details", async () => {
  await checkout("n1", "dentist", "k", "failure", NOW);
  const list = await listNotifications("n1", SIGNED_UP, NOW + 5000);
  assert.ok(list.some((n) => n.kind === "payment" && n.href === "/billing" && /didn't go through/.test(n.title)));
  assert.ok(list.some((n) => n.kind === "booking" && /changed your appointment time/.test(n.title) && n.href.startsWith("/appointments/")));
  const text = list.map((n) => `${n.title} ${n.body}`).join(" ");
  assert.doesNotMatch(text, /root canal|filling|tooth \d|pain|swelling|cleaning|follow-up visit/i);
  assert.ok(list.every((n, i) => i === 0 || list[i - 1].at >= n.at));
});

test("mark read, one or all", async () => {
  const list = await listNotifications("n2", SIGNED_UP, NOW);
  await markRead("n2", [list[0].id]);
  assert.equal((await listNotifications("n2", SIGNED_UP, NOW)).filter((n) => !n.read).length, list.length - 1);
  await markRead("n2", list.map((n) => n.id));
  assert.equal((await listNotifications("n2", SIGNED_UP, NOW)).filter((n) => !n.read).length, 0);
});

test("help articles search by words and topic", () => {
  assert.ok(searchArticles("refund").some((a) => a.slug === "membership-cancel"));
  assert.ok(searchArticles("", "privacy").every((a) => a.topic === "privacy"));
  assert.equal(searchArticles("xyzzy").length, 0);
});

test("tickets: checked, answered, resolved, reopened", async () => {
  assert.match(checkTicket({ topic: "booking", subject: "x", body: "long enough body", attachment: null })!, /title/);
  assert.match(checkTicket({ topic: "booking", subject: "Can't book", body: "The button does nothing", attachment: { type: "application/pdf", size: 10 } })!, /screenshot/);
  const t = await raiseTicket("n3", { topic: "booking", subject: "Can't book", body: "The confirm button does nothing.", context: "dentist aditi-sharma", attachment: null }, NOW);
  assert.equal((await getTicket("n3", t.id, NOW + REPLY_MS))!.status, "in_progress");
  assert.equal((await getTicket("n3", t.id, NOW + 2 * REPLY_MS))!.status, "resolved");
  await assert.rejects(replyTicket("n3", t.id, "still broken", NOW + 2 * REPLY_MS), /Reopen/);
  assert.equal((await reopenTicket("n3", t.id, "Still broken on my phone", NOW + 2 * REPLY_MS)).status, "reopened");
});
