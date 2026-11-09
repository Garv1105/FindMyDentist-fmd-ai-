import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkPrefs,
  DEFAULT_PREFS,
  getConsents,
  getDeletion,
  getExport,
  getPrefs,
  LINK_DAYS,
  PREPARE_MS,
  requestDeletion,
  requestExport,
  savePrefs,
  setConsent,
  cancelDeletion,
} from "./privacy.ts";

const SIGNED_UP = "2026-11-01T10:00:00.000Z";
const ok = { marketing: true, emailVerified: true };

test("terms and privacy are given at sign-up; the rest start off", async () => {
  const c = await getConsents("c1", SIGNED_UP);
  assert.deepEqual(c.filter((x) => x.granted).map((x) => x.purpose), ["terms", "privacy_notice"]);
  assert.equal(c[0].at, SIGNED_UP);
});

test("required consents can't be withdrawn", async () => {
  await assert.rejects(setConsent("c2", "terms", false), /delete your account/);
  assert.equal((await setConsent("c2", "ai_history", true)).granted, true);
});

test("withdrawing marketing switches offers off", async () => {
  await setConsent("c3", "marketing", true);
  await savePrefs("c3", { ...DEFAULT_PREFS, matrix: { ...DEFAULT_PREFS.matrix, offers: { sms: false, whatsapp: true, email: false, push: false } } }, ok);
  await setConsent("c3", "marketing", false);
  assert.equal((await getPrefs("c3")).matrix.offers.whatsapp, false);
});

test("preference rules", () => {
  const m = DEFAULT_PREFS.matrix;
  assert.equal(checkPrefs(DEFAULT_PREFS, ok), null);
  assert.match(checkPrefs({ ...DEFAULT_PREFS, matrix: { ...m, appointments: { sms: false, whatsapp: false, email: false, push: false } } }, ok)!, /at least one/);
  assert.match(checkPrefs({ ...DEFAULT_PREFS, matrix: { ...m, offers: { ...m.offers, sms: true } } }, { ...ok, marketing: false })!, /consents first/);
  assert.match(checkPrefs(DEFAULT_PREFS, { ...ok, emailVerified: false })!, /verify an email/);
  assert.match(checkPrefs({ ...DEFAULT_PREFS, quiet: { on: true, from: "22:00", to: "22:00" } }, ok)!, /different/);
});

test("the security row can't be switched off", async () => {
  const saved = await savePrefs("c4", { ...DEFAULT_PREFS, matrix: { ...DEFAULT_PREFS.matrix, security: { sms: false, whatsapp: false, email: false, push: false } } }, ok);
  assert.equal(saved.matrix.security.sms, true);
});

test("data export: preparing, then ready, then the link expires", async () => {
  const t0 = Date.parse("2026-11-09T10:00:00Z");
  await requestExport("c5", t0);
  assert.equal((await getExport("c5", t0 + 1000))?.status, "preparing");
  const ready = await getExport("c5", t0 + PREPARE_MS);
  assert.equal(ready?.status, "ready");
  assert.equal(ready?.expires_at, new Date(t0 + PREPARE_MS + LINK_DAYS * 86_400_000).toISOString());
  assert.equal(await getExport("c5", t0 + PREPARE_MS + LINK_DAYS * 86_400_000), null);
});

test("deletion request and cancel", async () => {
  await requestDeletion("c6", "Privacy concerns");
  assert.equal((await getDeletion("c6"))?.status, "received");
  await cancelDeletion("c6");
  assert.equal(await getDeletion("c6"), null);
});
