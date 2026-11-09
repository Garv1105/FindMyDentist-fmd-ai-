import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_SIZE, search, slotAt } from "./providers.ts";

// Monday 10 Nov 2026, 11:00 IST
const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const names = (r: ReturnType<typeof search>) => r.items.map((p) => p.name);

test("filters: city, specialty, treatment, language, gender, fee", () => {
  assert.ok(search({ loc: "Mumbai" }, NOW).items.every((p) => p.clinic.city === "Mumbai"));
  assert.ok(search({ loc: "indiranagar" }, NOW).items.every((p) => p.clinic.area === "Indiranagar"));
  assert.ok(search({ specialty: "Orthodontist" }, NOW).items.every((p) => p.specialty === "Orthodontist"));
  assert.ok(search({ service: "Braces", language: "Marathi" }, NOW).items.every((p) => p.services.includes("Braces") && p.languages.includes("Marathi")));
  assert.ok(search({ gender: "female" }, NOW).items.every((p) => p.gender === "female"));
  const cheap = search({ fee_max: 500 }, NOW).items;
  assert.ok(cheap.length && cheap.every((p) => p.fee && p.fee.min <= 500), "unknown fees are left out when a fee limit is set");
});

test("plain-language concerns find the right specialists", () => {
  assert.ok(search({ q: "bleeding gums" }, NOW).items.every((p) => p.specialty === "Periodontist" || p.services.includes("Gum Treatment")));
  assert.ok(names(search({ q: "crooked teeth", loc: "Bengaluru" }, NOW)).includes("Dr. Rohan Mehta"));
  assert.equal(names(search({ q: "Sneha" }, NOW))[0], "Dr. Sneha Iyer");
});

test("organic ranking ignores sponsorship; a sponsored profile is separate, once, and never on its own page twice", () => {
  const r = search({ loc: "Bengaluru" }, NOW);
  assert.ok(r.sponsored.length <= 1);
  assert.ok(r.sponsored.every((s) => !r.items.some((p) => p.id === s.id)));
  const ortho = search({ loc: "Bengaluru", specialty: "Orthodontist" }, NOW);
  assert.equal(ortho.items[0].name, "Dr. Rohan Mehta", "on the page by match: keeps its label there");
  assert.equal(ortho.sponsored.length, 0);
  assert.ok(search({ loc: "Pune" }, NOW).sponsored.length === 0, "a sponsor must match the filters too");
});

test("verified dentists rank above unverified ones with the same match", () => {
  const r = search({ loc: "Bengaluru" }, NOW).items;
  const firstUnverified = r.findIndex((p) => p.verification.status === "unverified");
  assert.ok(r.slice(0, firstUnverified).every((p) => p.verification.status !== "unverified"));
});

test("availability only from connected schedules; today and this week", () => {
  const today = search({ available: "today" }, NOW).items;
  assert.ok(today.length && today.every((p) => p.nextAvailable && new Date(p.nextAvailable).toDateString() === new Date(NOW).toDateString()));
  assert.ok(search({ loc: "Pune" }, NOW).items.every((p) => p.nextAvailable === null), "Pune's clinic has no connected schedule");
  const soonest = search({ sort: "soonest" }, NOW).items;
  assert.ok(soonest[0].nextAvailable! <= soonest[1].nextAvailable!);
});

test("slots fall inside opening hours", () => {
  const late = slotAt(Date.parse("2026-11-10T18:50:00+05:30"), 1); // 19:50 → next day 10:00
  assert.equal(new Date(late).toISOString(), "2026-11-11T04:30:00.000Z");
  assert.equal(slotAt(NOW, 2), Date.parse("2026-11-10T13:00:00+05:30"));
});

test("distance: near me sorts nearest first and limits by km", () => {
  const near = search({ lat: 12.97, lng: 77.64, sort: "distance" }, NOW).items; // Indiranagar
  assert.equal(near[0].clinic.area, "Indiranagar");
  assert.ok(near.every((p, i) => i === 0 || near[i - 1].distanceKm! <= p.distanceKm!));
  // same clinic, same distance: the verified dentist comes first
  assert.deepEqual(near.slice(0, 2).map((p) => p.verification.status), ["verified", "unverified"]);
  assert.ok(search({ lat: 12.97, lng: 77.64, within: 10 }, NOW).items.every((p) => p.distanceKm! <= 10));
});

test("paging and no-result help", () => {
  const all = search({}, NOW);
  assert.equal(all.items.length, PAGE_SIZE);
  assert.equal(all.pages, Math.ceil(all.total / PAGE_SIZE));
  const none = search({ loc: "Kochi", language: "Marathi" }, NOW);
  assert.equal(none.total, 0);
  assert.ok(none.suggestions.some((s) => s.includes("Kochi")) && none.suggestions.some((s) => s.includes("Marathi")));
});

import { availability, getClinicPage, getProvider, openSlots, POLICY, requestWindows, submitClaim } from "./providers.ts";

const istHour = (t: number) => new Date(t + 5.5 * 3_600_000).getUTCHours();
const istDow = (t: number) => new Date(t + 5.5 * 3_600_000).getUTCDay();

test("open slots: opening hours, no Sundays, enough notice, and booked times removed", () => {
  const slots = openSlots("aditi-sharma", NOW);
  assert.ok(slots.length > 20);
  assert.ok(slots.every((t) => istHour(t) >= POLICY.open && istHour(t) < POLICY.close && istDow(t) !== 0));
  assert.ok(slots.every((t) => t - NOW >= POLICY.minNoticeHours * 3_600_000));
  assert.ok(slots.every((t, i) => i === 0 || slots[i - 1] < t));
  assert.ok(!openSlots("aditi-sharma", NOW, 7, new Set([slots[0]])).includes(slots[0]));
  assert.deepEqual(openSlots("karan-malhotra", NOW), [], "no connected schedule, no slots");
});

test("next available on the card is the first open slot", () => {
  const card = search({ q: "Aditi" }, NOW).items[0];
  assert.equal(card.nextAvailable, openSlots("aditi-sharma", NOW)[0]);
});

test("request windows for clinics without a schedule", () => {
  const w = requestWindows(NOW);
  assert.ok(w.length > 10);
  assert.ok(w.every((x) => new Date(`${x.date}T12:00:00+05:30`).getUTCDay() !== 0));
  assert.ok(!w.some((x) => x.date === "2026-11-10" && x.part === "morning"), "this morning has passed");
  assert.equal(availability("karan-malhotra", NOW).mode, "request");
});

test("profiles and clinic pages", async () => {
  const p = await getProvider("karan-malhotra", NOW);
  assert.equal(p?.claimed, false);
  assert.ok(p?.serviceFees.some((f) => f.service === "Veneers"));
  assert.equal(await getProvider("nobody", NOW), null);
  const c = await getClinicPage("kor", NOW);
  assert.deepEqual(c?.dentists.map((d) => d.name).sort(), ["Dr. Aditi Sharma", "Dr. Venkat Rao"]);
});

test("claims need details and proof, once", async () => {
  const ok = { full_name: "Karan Malhotra", council: "Karnataka State Dental Council", registration_no: "KA-1", confirm: true };
  const pdf = { name: "cert.pdf", type: "application/pdf", size: 1000 };
  await assert.rejects(submitClaim("u9", "karan-malhotra", ok, null), /certificate/);
  await assert.rejects(submitClaim("u9", "karan-malhotra", { ...ok, confirm: false }, pdf), /Confirm/);
  assert.equal((await submitClaim("u9", "karan-malhotra", ok, pdf)).status, "pending");
  await assert.rejects(submitClaim("u9", "karan-malhotra", ok, pdf), /already/);
});
