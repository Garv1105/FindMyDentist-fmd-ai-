import assert from "node:assert/strict";
import { test } from "node:test";
import { canPostJobs, checkJob, cleanApply, closeJob, getJob, jobState, myJobs, postJob, renewJob, reportJob, searchJobs, type JobInput } from "./jobs.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const input: JobInput = { title: "Associate dentist", role: "associate", type: "full_time", employer: "Smile Studio", city: "Bengaluru", area: "Indiranagar", description: "General practice, 5 days a week, with mentoring.", requirements: "BDS\nRegistered", min_years: 1, salary: { min: 40000, max: 60000 }, apply: { method: "phone", value: "98765 43210" } };

test("search: filters, newest first, expired listings never shown", async () => {
  const all = await searchJobs(null, {}, NOW);
  assert.ok(all.items.every((j, i) => i === 0 || all.items[i - 1].posted_at >= j.posted_at));
  assert.ok(!all.items.some((j) => j.id === "job-expired"));
  assert.ok((await searchJobs(null, { role: "hygienist" }, NOW)).items.every((j) => j.role === "hygienist"));
  assert.ok((await searchJobs(null, { experience: "0" }, NOW)).items.every((j) => j.min_years === 0));
  assert.ok((await searchJobs(null, { salary_min: 50000 }, NOW)).items.every((j) => j.salary && j.salary.max >= 50000));
  assert.equal(jobState((await getJob(null, "job-expired", NOW))!, NOW), "expired");
});

test("posting rules: who, what, and how to apply", () => {
  assert.equal(canPostJobs({ dentist_profile: null, workspaces: [] }, "patient"), false);
  assert.equal(canPostJobs({ dentist_profile: { verification_status: "verified" }, workspaces: [] }, null), true);
  assert.equal(canPostJobs({ dentist_profile: null, workspaces: [{ role: "owner" }] }, null), true);
  assert.equal(checkJob(input), null);
  assert.match(checkJob({ ...input, salary: { min: 9, max: 1 } })!, /lowest first/);
  assert.match(cleanApply({ method: "url", value: "http://x.example/jobs" }) as string, /https/);
  assert.deepEqual(cleanApply({ method: "phone", value: "098765 43210" }), { method: "phone", value: "+919876543210" });
});

test("a new posting is never shown as FMD-checked; edit, close, renew", async () => {
  const j = await postJob("j1", input, null, NOW);
  assert.equal(j.employer.verified, false);
  assert.ok((await searchJobs("j1", { q: "smile studio" }, NOW)).items.some((x) => x.id === j.id));
  await postJob("j1", { ...input, title: "Senior associate dentist" }, j.id, NOW);
  assert.equal((await myJobs("j1")).length, 1);
  await closeJob("j1", j.id);
  assert.ok(!(await searchJobs("j1", {}, NOW)).items.some((x) => x.id === j.id));
  await renewJob("j1", j.id, NOW + 40 * 86_400_000);
  assert.equal(jobState((await myJobs("j1"))[0], NOW + 40 * 86_400_000), "active");
  await assert.rejects(postJob("j1", input, "job-assoc-kor", NOW), /own postings/);
});

test("reporting a job", async () => {
  await assert.rejects(reportJob(null, "job-intern-ady", "fake", ""), /Log in/);
  await reportJob("j2", "job-intern-ady", "fees", "");
  await assert.rejects(reportJob("j2", "job-intern-ady", "fake", ""), /already/);
});
