import assert from "node:assert/strict";
import { test } from "node:test";
import { clean, sentEvents, track } from "./analytics.ts";

test("analytics keeps only allowed properties of the right kind", () => {
  assert.deepEqual(clean("dentist_search", { filters: 2, near_me: true, results: 14, q: "bleeding gums", concern: "pain" }), { filters: 2, near_me: true, results: 14 });
  assert.deepEqual(clean("booking_confirmed", { mode: "live", for_someone_else: "yes", treatment: "root canal" }), { mode: "live" });
  assert.deepEqual(clean("onboarding_completed", { account_type: "hacker" }), {});
  assert.deepEqual(clean("profile_viewed", { dentist_id: "aditi-sharma" }), { dentist_id: "aditi-sharma" });
  assert.deepEqual(clean("profile_viewed", { dentist_id: "my tooth hurts" }), {});
  track("ai_message_sent", { language: "en", text: "my tooth hurts", has_attachment: false });
  assert.deepEqual(sentEvents().at(-1)!.props, { language: "en", has_attachment: false });
});
