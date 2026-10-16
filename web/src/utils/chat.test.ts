// Gemini request shape (run with npm test). No network: askGemini is not called.
import assert from "node:assert/strict";
import { SYSTEM_PROMPT, geminiRequest } from "./chat.ts";

const req = geminiRequest([
  { role: "user", text: "Why do I grind my teeth?" },
  { role: "assistant", text: "Often stress or sleep." },
  { role: "user", text: "Can a dentist help?" },
]);
assert.equal(req.systemInstruction.parts[0].text, SYSTEM_PROMPT);
assert.deepEqual(req.contents.map((c) => c.role), ["user", "model", "user"], "assistant turns are sent as Gemini's 'model' role");
assert.equal(req.contents[2].parts[0].text, "Can a dentist help?");
assert.match(SYSTEM_PROMPT, /FindMyDentist/);
assert.match(SYSTEM_PROMPT, /never give a diagnosis/);
console.log("gemini request ok");
