import assert from "node:assert/strict";
import { test } from "node:test";
import { feelingOf, moodFor } from "./expression.ts";

test("feelings follow the meaning, most serious first", () => {
  assert.equal(feelingOf("My face is swollen and I have a fever"), "alert");
  assert.equal(feelingOf("Bleeding won't stop after the extraction"), "alert");
  assert.equal(feelingOf("My tooth hurts when I drink something cold"), "empathy");
  assert.equal(feelingOf("मेरे दांत में दर्द है"), "empathy");
  assert.equal(feelingOf("Severe pain and it costs ₹500?"), "alert"); // urgency outranks pain and cost
  assert.equal(feelingOf("Thanks, that's booked"), "cheer");
  assert.equal(feelingOf("Net revenue this month so far is ₹5,13,702"), "focused");
  assert.equal(feelingOf("In the last 7 days the no-show rate was 6%"), "focused");
  assert.equal(feelingOf("Which tooth is it, upper or lower?"), "curious");
  assert.equal(feelingOf("Braces or clear aligners: what's the difference"), "calm");
  assert.equal(feelingOf("Anything at all", { urgent: true }), "alert");
});

test("the body pose fits the moment and the feeling", () => {
  assert.equal(moodFor("waiting", "empathy"), "thinking");
  assert.equal(moodFor("typing", "calm"), "listening");
  assert.equal(moodFor("answered", "empathy"), "listening");
  assert.equal(moodFor("answered", "focused"), "explaining");
  assert.equal(moodFor("answered", "curious"), "thinking");
  assert.equal(moodFor("idle", "cheer"), "idle");
});
