import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, errorMessage, fmd, passwordRules } from "./fmd.ts";

test("error messages from both backend error shapes", () => {
  assert.equal(errorMessage(409, { error: { code: "conflict", message: "Taken" } }), "Taken");
  assert.equal(errorMessage(422, { detail: [{ msg: "Value error, Password must include a number." }] }), "Password must include a number.");
  assert.equal(errorMessage(429, null), "Too many tries. Wait a minute and try again.");
  assert.equal(errorMessage(500, null), "Something went wrong. Please try again.");
});

test("password rules mirror the server", () => {
  assert.ok(passwordRules("Abcdef1!").every((r) => r.ok));
  assert.deepEqual(
    passwordRules("abc").filter((r) => !r.ok).map((r) => r.label),
    ["8 or more characters", "an uppercase letter", "a number", "a special character"],
  );
});

function stubFetch(responses: Response[]) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => (calls.push(url), responses.shift()!)) as typeof fetch;
  return calls;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

test("an expired access token is refreshed once, then the call is retried", async () => {
  const calls = stubFetch([json(401, { error: { code: "unauthorized", message: "Not authenticated" } }), new Response(null, { status: 204 }), json(200, { id: "u1" })]);
  assert.deepEqual(await fmd("/auth/me"), { id: "u1" });
  assert.deepEqual(calls, ["/api/v1/auth/me", "/api/v1/auth/refresh", "/api/v1/auth/me"]);
});

test("wrong credentials are not refreshed", async () => {
  const calls = stubFetch([json(401, { error: { code: "unauthorized", message: "Incorrect mobile number, email or password" } })]);
  await assert.rejects(fmd("/auth/login/password", { body: {} }), (e: ApiError) => e.status === 401 && e.message.startsWith("Incorrect"));
  assert.equal(calls.length, 1);
});

test("a wrong code on a signed-in endpoint is not retried (it would burn an OTP try)", async () => {
  const calls = stubFetch([json(401, { error: { code: "unauthorized", message: "That OTP is wrong or has expired." } })]);
  await assert.rejects(fmd("/me/mfa", { body: { code: "000000" } }), (e: ApiError) => e.message.startsWith("That OTP"));
  assert.equal(calls.length, 1);
});

test("a failed refresh surfaces the 401", async () => {
  stubFetch([json(401, { error: { code: "unauthorized", message: "Not authenticated" } }), json(401, {})]);
  await assert.rejects(fmd("/auth/me"), (e: ApiError) => e.status === 401);
});

test("phone and initials for display", async () => {
  const { fmtPhone, initials } = await import("./fmd.ts");
  assert.equal(fmtPhone("+919876543210"), "+91 98765 43210");
  assert.equal(fmtPhone("+14155550100"), "+14155550100");
  assert.equal(initials("Priya Ramesh Sharma"), "PS");
  assert.equal(initials("  dr.  karthik "), "DK");
  assert.equal(initials("Ananya"), "A");
  assert.equal(initials(" "), "?");
});

test("device names from user agents", async () => {
  const { deviceName } = await import("./fmd.ts");
  assert.equal(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"), "Chrome on Windows");
  assert.equal(deviceName("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0"), "Edge on Windows");
  assert.equal(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), "Safari on iOS");
  assert.equal(deviceName("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36"), "Chrome on Android");
  assert.equal(deviceName("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"), "Firefox on Linux");
  assert.equal(deviceName("curl/8.5.0"), "Other device");
  assert.equal(deviceName(null), "Unknown device");
});
