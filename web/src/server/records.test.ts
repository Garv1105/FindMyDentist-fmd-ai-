import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { accessHistory, deleteRecord, exportManifest, issueLink, listRecords, readByToken, revokeShare, shareRecord, sharedWithMe, uploadRecord } from "./records.ts";
import { signLink } from "./adapters/storage.ts";
import { seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => {
  await resetDb();
  await seedDemoDirectory();
});

async function user(email: string, accountType = "patient"): Promise<Auth> {
  return await testUser(email, { name: "Test " + email.split("@")[0], accountType });
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const meta = { title: "Panoramic X-ray", docType: "xray", recordDate: "2026-03-14", clinicName: "Demo Dental Studio", episode: "Root canal 2026" };

/** A dentist account linked to a demo profile (as an approved claim would do). */
async function linkedDentist(email: string, profileName: string) {
  const d = await user(email, "dentist");
  await run("UPDATE dentists SET user_id = ? WHERE name = ?", d.user.id, profileName);
  return { auth: d, dentistId: (await one<{ id: string }>("SELECT id FROM dentists WHERE name = ?", profileName))!.id };
}

test("upload validates by content, size and metadata", async () => {
  const a = await user("a@example.com");
  assert.equal(await status(async () => await uploadRecord(a, new TextEncoder().encode("<script>alert(1)</script>"), meta)), 415); // renamed HTML is refused
  assert.equal(await status(async () => await uploadRecord(a, new Uint8Array(), meta)), 400);
  assert.equal(await status(async () => await uploadRecord(a, new Uint8Array(16 * 1024 * 1024), meta)), 413);
  assert.equal(await status(async () => await uploadRecord(a, PDF, { ...meta, docType: "selfie" })), 400);
  assert.equal(await status(async () => await uploadRecord(a, PDF, { ...meta, recordDate: "2999-01-01" })), 400);
  const r = await uploadRecord(a, PNG, meta);
  assert.equal(r.mime, "image/png");
  assert.equal("storage_key" in r, false); // storage paths never leave the server
  const l = await listRecords(a, { episode: "Root canal 2026" });
  assert.equal(l.items.length, 1);
  assert.deepEqual(l.facets.clinics, ["Demo Dental Studio"]);
  assert.equal(l.usage.usedBytes, PNG.byteLength);
});

test("signed links: bound to the viewer, expire, and fail for anyone else", async () => {
  const a = await user("a@example.com");
  const eve = await user("eve@example.com");
  const r = await uploadRecord(a, PDF, meta);
  assert.equal(await status(async () => await issueLink(eve, r.id, "view")), 404);
  const { token } = await issueLink(a, r.id, "download");
  assert.equal((await readByToken(a, token)).mime, "application/pdf");
  assert.equal(await status(async () => await readByToken(eve, token)), 403); // stolen link is useless to another session
  assert.equal(await status(async () => await readByToken(a, token.slice(0, -2) + "xx")), 403); // tampered
  const expired = signLink({ recordId: r.id, viewerId: a.user.id, mode: "view", ttlSeconds: -1 }).token;
  assert.equal(await status(async () => await readByToken(a, expired)), 403);
});

test("sharing is explicit, time-limited, revocable, and only with dentists on FMD", async () => {
  const a = await user("a@example.com");
  const { auth: doc, dentistId } = await linkedDentist("doc@example.com", "Dr. Aditi Sharma");
  const other = await linkedDentist("other@example.com", "Dr. Sneha Iyer");
  const unclaimed = (await one<{ id: string }>("SELECT id FROM dentists WHERE name = 'Dr. Rohan Mehta'"))!.id;
  const r = await uploadRecord(a, PDF, meta);

  assert.equal(await status(async () => await issueLink(doc, r.id, "view")), 404); // nothing shared yet
  assert.equal(await status(async () => await shareRecord(a, r.id, { dentistId, days: 7 })), 400); // not confirmed
  assert.equal(await status(async () => await shareRecord(a, r.id, { dentistId: unclaimed, days: 7, confirmed: true })), 409);
  const shared = await shareRecord(a, r.id, { dentistId, days: 7, confirmed: true });
  assert.equal(shared.shares.length, 1);

  assert.equal((await sharedWithMe(doc)).length, 1);
  assert.equal((await sharedWithMe(other.auth)).length, 0);
  assert.equal(await status(async () => await issueLink(other.auth, r.id, "view")), 404);
  const { token } = await issueLink(doc, r.id, "view");
  assert.equal((await readByToken(doc, token)).mime, "application/pdf");

  await revokeShare(a, r.id, shared.shares[0].id);
  assert.equal(await status(async () => await readByToken(doc, token)), 403); // revocation applies to links already issued
  assert.equal((await sharedWithMe(doc)).length, 0);

  const kinds = (await accessHistory(a, r.id)).map((e) => e.kind);
  assert.ok(kinds.includes("shared") && kinds.includes("viewed") && kinds.includes("share_revoked"));
  assert.equal(await status(async () => await accessHistory(doc, r.id)), 404);
});

test("expired shares stop working", async () => {
  const a = await user("a@example.com");
  const { auth: doc, dentistId } = await linkedDentist("doc@example.com", "Dr. Aditi Sharma");
  const r = await uploadRecord(a, PDF, meta);
  await shareRecord(a, r.id, { dentistId, days: 1, confirmed: true });
  await run("UPDATE record_shares SET expires_at = ?", Date.now() - 1);
  assert.equal(await status(async () => await issueLink(doc, r.id, "view")), 404);
});

test("delete removes access and the file; export lists the rest", async () => {
  const a = await user("a@example.com");
  const r1 = await uploadRecord(a, PDF, meta);
  const r2 = await uploadRecord(a, PNG, { ...meta, title: "Bite photo", docType: "photo" });
  const { token } = await issueLink(a, r1.id, "view");
  await deleteRecord(a, r1.id);
  assert.equal(await status(async () => await readByToken(a, token)), 404);
  assert.equal(await status(async () => await deleteRecord(a, r1.id)), 404);
  const m = await exportManifest(a);
  assert.deepEqual(m.records.map((r) => r.id), [r2.id]);
  assert.equal((await listRecords(a)).usage.usedBytes, PNG.byteLength);
});
