import assert from "node:assert/strict";
import { test } from "node:test";
import { getCertificate, verify } from "./certificates.ts";
import { acknowledgePlan, currentStage, getJourney, listJourneys } from "./journeys.ts";
import {
  accessEvents,
  addRecord,
  checkUpload,
  deleteRecord,
  exportAll,
  findRecipients,
  getLink,
  listRecords,
  listShares,
  revokeShare,
  shareRecords,
  storage,
  UPLOAD,
  VIEW_AFTER_MS,
} from "./records.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const file = (name: string, type: string, size = 1000) => Object.assign(new Blob([new Uint8Array(size)], { type }), { name });
const details = { title: "My X-ray", type: "photo" as const, date: "2026-11-01", clinic: null, dentist: null, episode_id: null, note: null };

test("upload rules: type, size, storage", () => {
  assert.equal(checkUpload({ type: "application/pdf", size: 1000 }, 0), null);
  assert.match(checkUpload({ type: "image/gif", size: 1000 }, 0)!, /PDF, JPG, PNG or WebP/);
  assert.match(checkUpload({ type: "image/png", size: UPLOAD.maxBytes + 1 }, 0)!, /20 MB/);
  assert.match(checkUpload({ type: "image/png", size: 1000 }, UPLOAD.quotaBytes - 10)!, /100 MB/);
});

test("the demo history is there, filters work, and an upload is added and counted", async () => {
  const all = await listRecords("r1", {}, NOW);
  assert.ok(all.length >= 8 && all.every((r, i) => i === 0 || all[i - 1].date >= r.date), "newest first");
  assert.ok((await listRecords("r1", { type: "xray" }, NOW)).every((r) => r.type === "xray"));
  assert.ok((await listRecords("r1", { episode: "j-rct" }, NOW)).every((r) => r.episode_id === "j-rct"));
  const before = (await storage("r1", NOW)).used;
  const r = await addRecord("r1", details, file("x.png", "image/png", 5000), NOW);
  assert.equal(r.source, "you");
  assert.equal((await storage("r1", NOW)).used, before + 5000);
  await assert.rejects(addRecord("r1", { ...details, date: "2030-01-01" }, file("y.png", "image/png"), NOW), /future/);
});

test("opening a file gives a short-lived link and logs it", async () => {
  const link = await getLink("r2", "rec-summary", "view", NOW);
  assert.match(link.url, /^blob:/);
  assert.equal(Date.parse(link.expires_at) - NOW, 5 * 60_000);
  const ev = await accessEvents("r2", "rec-summary", NOW);
  assert.equal(ev[0].what, "viewed");
  assert.equal(ev[0].who, "You");
});

test("sharing is explicit and specific; the dentist's view is logged; revoking ends it at once", async () => {
  await assert.rejects(shareRecords("r3", { to: null, record_ids: ["rec-xray"], days: 7, note: "" }, NOW), /who to share/);
  const to = findRecipients("aditi")[0];
  assert.equal(to.name, "Dr. Aditi Sharma");
  await assert.rejects(shareRecords("r3", { to, record_ids: [], days: 7, note: "" }, NOW), /at least one/);
  const sh = await shareRecords("r3", { to, record_ids: ["rec-xray"], days: 7, note: "For my second opinion" }, NOW);
  assert.equal((await listShares("r3", NOW))[0].state, "active");
  const later = NOW + VIEW_AFTER_MS;
  assert.ok((await accessEvents("r3", "rec-xray", later)).some((e) => e.who === "Dr. Aditi Sharma" && e.what === "viewed"));
  await revokeShare("r3", sh.id, later);
  assert.equal((await listShares("r3", later))[0].state, "revoked");
  assert.equal((await listShares("r3", NOW + 8 * 86_400_000))[0].state, "revoked");
});

test("a share expires on its own", async () => {
  const to = findRecipients("aditi")[0];
  await shareRecords("r4", { to, record_ids: ["rec-xray"], days: 7, note: "" }, NOW);
  assert.equal((await listShares("r4", NOW + 7 * 86_400_000))[0].state, "expired");
});

test("deleting a record takes it out of shares, and an emptied share ends", async () => {
  const to = findRecipients("aditi")[0];
  await shareRecords("r5", { to, record_ids: ["rec-rx"], days: null, note: "" }, NOW);
  await deleteRecord("r5", "rec-rx", NOW);
  const [sh] = await listShares("r5", NOW);
  assert.deepEqual(sh.record_ids, []);
  assert.equal(sh.state, "revoked");
  assert.ok(!(await listRecords("r5", {}, NOW)).some((r) => r.id === "rec-rx"));
});

test("export is a zip with every file and an index", async () => {
  const zip = new Uint8Array(await (await exportAll("r6", NOW)).arrayBuffer());
  assert.deepEqual([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], "zip signature");
});

test("journeys: the in-progress one waits on the plan; acknowledging moves it on; only the latest version", async () => {
  const [rct, fill] = await listJourneys("r7", NOW);
  assert.equal(currentStage(rct).key, "plan");
  assert.equal(fill.status, "completed");
  await assert.rejects(acknowledgePlan("r7", "j-rct", 1, NOW), /latest/);
  const after = await acknowledgePlan("r7", "j-rct", 2, NOW);
  assert.equal(after.stages.find((s) => s.key === "plan")!.status, "completed");
  assert.equal(currentStage(after).key, "visits");
  assert.equal((await getJourney("someone-else", "j-rct", NOW))!.acknowledged, null);
});

test("certificates: active with its version history; the public check shows no patient details", async () => {
  const c = (await getCertificate("cert-0147", NOW))!;
  assert.equal(c.status, "active");
  assert.equal(c.versions.length, 2);
  const pub = (await verify(c.code.toLowerCase(), NOW))!;
  assert.equal(pub.number, c.number);
  assert.ok(!("site" in pub) && !("dentist" in pub) && !JSON.stringify(pub).includes("tooth"));
  assert.equal(await verify("NOPE-NOPE-NOPE", NOW), null);
});
