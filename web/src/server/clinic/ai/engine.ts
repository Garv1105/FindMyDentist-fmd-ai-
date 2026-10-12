import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "../../db.ts";
import type { Auth } from "../../auth.ts";
import { bad, HttpError, notFound } from "../../http.ts";
import { can, requireClinic } from "../workspace.ts";
import { devPlanner, type Planner } from "./planner.ts";
import { toolByName, type Risk, type ToolCtx } from "./tools.ts";

/**
 * Clinic AI manager task engine (PRD §7.3–7.7):
 * Receive → Clarify → Plan → Authorize → Preview → Execute → Verify → Report → Audit.
 * Approval policy is fixed in code, not in the planner or the instruction:
 *   read / internal          → run automatically for users with the tool's permission
 *   external / publish       → stop with a preview; a permitted user must approve
 */
const NEEDS_APPROVAL: Risk[] = ["external", "publish"];
const planner: Planner = devPlanner; // OD-14: swap for a model-backed planner behind the same interface

type TaskRow = {
  id: string;
  clinic_id: string;
  requested_by: string;
  instruction: string;
  intent: string;
  status: "clarifying" | "running" | "awaiting_approval" | "completed" | "partial" | "blocked" | "failed" | "cancelled";
  question: string;
  report: string;
  schedule_id: string | null;
  planner: string;
  created_at: number;
  updated_at: number;
};
type StepRow = {
  id: string;
  task_id: string;
  seq: number;
  tool: string;
  input: string;
  risk: Risk;
  status: "pending" | "awaiting_approval" | "done" | "skipped" | "blocked" | "failed";
  preview: string;
  output: string;
  error: string;
  verified: number;
};

// ponytail: in-memory per-clinic rate window; move to the shared store with the job queue
const hits = new Map<string, number[]>();
function rateLimit(clinicId: string, max = 60) {
  const now = Date.now();
  const list = (hits.get(clinicId) ?? []).filter((t) => t > now - 3600_000);
  if (list.length >= max) throw new HttpError(429, "rate_limited", "The AI manager has reached this hour's task limit for your clinic.");
  list.push(now);
  hits.set(clinicId, list);
}

function settingsOf(clinicId: string) {
  return one<{ enabled: number }>("SELECT enabled FROM ai_settings WHERE clinic_id = ?", clinicId) ?? { enabled: 1 };
}

/** Receive + Plan. Returns the task after running every step it is allowed to run on its own. */
export function startTask(a: Auth, clinicId: string, instructionRaw: unknown, opts: { scheduleId?: string } = {}) {
  requireClinic(a, clinicId, "ai.use");
  if (!settingsOf(clinicId).enabled) throw new HttpError(409, "ai_disabled", "The AI manager is turned off for this clinic. Clinic OS keeps working without it.");
  const instruction = typeof instructionRaw === "string" ? instructionRaw.trim() : "";
  if (instruction.length < 3 || instruction.length > 1000) throw bad("Tell the AI manager what to do (up to 1,000 characters).");
  rateLimit(clinicId);
  const started = Date.now();
  const plan = planner.plan(instruction);
  const id = randomUUID();
  tx(() => {
    run(
      "INSERT INTO ai_tasks (id, clinic_id, requested_by, instruction, intent, status, question, plan, schedule_id, planner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, clinicId, a.user.id, instruction, plan.intent, plan.intent === "clarify" ? "clarifying" : "running", "question" in plan ? plan.question : "",
      JSON.stringify(plan.steps), opts.scheduleId ?? null, planner.name, started, started,
    );
    plan.steps.forEach((s, i) => {
      const tool = toolByName(s.tool);
      if (!tool) throw new Error(`planner chose unknown tool ${s.tool}`);
      run("INSERT INTO ai_task_steps (id, task_id, seq, tool, input, risk, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')", randomUUID(), id, i, s.tool, JSON.stringify(tool.validate(s.input)), tool.risk);
    });
    audit(a.user.id, "ai.task_received", "ai_task", id, { intent: plan.intent });
  });
  if (plan.intent !== "clarify") advance(a, id);
  run("INSERT INTO ai_usage (id, clinic_id, task_id, provider, latency_ms, tool_calls, est_cost_paise, at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)", randomUUID(), clinicId, id, planner.name, Date.now() - started, plan.steps.length, Date.now());
  return taskView(a, clinicId, id);
}

/** Clarify: answer the question; the answer is appended to the instruction and the task is re-planned. */
export function answerClarification(a: Auth, clinicId: string, taskId: string, answer: unknown) {
  const t = ownTask(a, clinicId, taskId);
  if (t.status !== "clarifying") throw new HttpError(409, "not_clarifying", "This task isn't waiting for an answer.");
  run("UPDATE ai_tasks SET status = 'cancelled', report = 'Replaced by a clarified task.', updated_at = ? WHERE id = ?", Date.now(), taskId);
  return startTask(a, clinicId, `${t.instruction} — ${String(answer ?? "").slice(0, 300)}`);
}

function ownTask(a: Auth, clinicId: string, id: string) {
  requireClinic(a, clinicId, "ai.use");
  const t = one<TaskRow>("SELECT * FROM ai_tasks WHERE id = ? AND clinic_id = ?", id, clinicId);
  if (!t) throw notFound("Task not found.");
  return t;
}

const outputsOf = (taskId: string) =>
  Object.fromEntries(all<{ tool: string; output: string }>("SELECT tool, output FROM ai_task_steps WHERE task_id = ? AND status = 'done'", taskId).map((s) => [s.tool, JSON.parse(s.output || "null")]));

/**
 * Authorize → Preview → Execute → Verify, step by step, until finished or an approval is needed.
 * A failed step stops the task; nothing after it runs (no silent partial changes).
 */
function advance(actor: Auth, taskId: string) {
  const t = one<TaskRow>("SELECT * FROM ai_tasks WHERE id = ?", taskId)!;
  const ctx: ToolCtx = { a: actor, clinicId: t.clinic_id, taskId };
  for (const s of all<StepRow>("SELECT * FROM ai_task_steps WHERE task_id = ? AND status IN ('pending','awaiting_approval') ORDER BY seq", taskId)) {
    const tool = toolByName(s.tool)!;
    // Authorize: the acting user must hold the tool's clinic permission
    if (!can(actor, t.clinic_id, tool.permission)) {
      run("UPDATE ai_task_steps SET status = 'blocked', error = ? WHERE id = ?", `Needs the ${tool.permission} permission.`, s.id);
      return finish(taskId);
    }
    // Preview + approval gate for external/publish actions
    if (NEEDS_APPROVAL.includes(tool.risk) && s.status === "pending") {
      const preview = tool.preview ? tool.preview(ctx, JSON.parse(s.input)) : null;
      run("UPDATE ai_task_steps SET status = 'awaiting_approval', preview = ? WHERE id = ?", JSON.stringify(preview), s.id);
      run("UPDATE ai_tasks SET status = 'awaiting_approval', updated_at = ? WHERE id = ?", Date.now(), taskId);
      audit(actor.user.id, "ai.approval_requested", "ai_task", taskId, { tool: tool.name });
      return;
    }
    if (s.status === "awaiting_approval") return; // still waiting
    // Execute + Verify
    run("UPDATE ai_task_steps SET started_at = ? WHERE id = ?", Date.now(), s.id);
    try {
      const out = tool.run(ctx, JSON.parse(s.input), outputsOf(taskId));
      const verified = tool.verify ? tool.verify(ctx, out) : true;
      run("UPDATE ai_task_steps SET status = 'done', output = ?, verified = ?, finished_at = ? WHERE id = ?", JSON.stringify(out ?? null), verified ? 1 : 0, Date.now(), s.id);
      audit(actor.user.id, "ai.tool_executed", "ai_task", taskId, { tool: tool.name, verified });
    } catch (e) {
      run("UPDATE ai_task_steps SET status = 'failed', error = ?, finished_at = ? WHERE id = ?", (e as Error).message.slice(0, 300), Date.now(), s.id);
      audit(actor.user.id, "ai.tool_failed", "ai_task", taskId, { tool: tool.name });
      return finish(taskId);
    }
  }
  finish(taskId);
}

/** Report: completed / partial / blocked / failed, from actual step states and verification. */
function finish(taskId: string) {
  const steps = all<StepRow>("SELECT * FROM ai_task_steps WHERE task_id = ? ORDER BY seq", taskId);
  const done = steps.filter((s) => s.status === "done");
  const unverified = done.filter((s) => !s.verified);
  const failed = steps.find((s) => s.status === "failed");
  const blocked = steps.find((s) => s.status === "blocked");
  const skipped = steps.filter((s) => s.status === "skipped");
  const status = failed ? (done.length ? "partial" : "failed") : blocked ? (done.length ? "partial" : "blocked") : unverified.length || skipped.length ? "partial" : "completed";
  const lines = steps.map((s) => {
    const label = toolByName(s.tool)?.label ?? s.tool;
    if (s.status === "done") return `✓ ${label}${s.verified ? "" : " (could not be verified)"}`;
    if (s.status === "failed") return `✗ ${label}: ${s.error}`;
    if (s.status === "blocked") return `■ ${label}: ${s.error}`;
    if (s.status === "skipped") return `– ${label}: skipped (${s.error || "not approved"})`;
    return `… ${label}: not run`;
  });
  run("UPDATE ai_tasks SET status = ?, report = ?, updated_at = ? WHERE id = ?", status, lines.join("\n"), Date.now(), taskId);
  audit(null, "ai.task_finished", "ai_task", taskId, { status });
}

/** Human authorisation for a previewed step. Rejection skips that step and everything after it. */
export function decide(a: Auth, clinicId: string, taskId: string, input: Record<string, unknown>) {
  const t = ownTask(a, clinicId, taskId);
  if (t.status !== "awaiting_approval") throw new HttpError(409, "not_waiting", "Nothing is waiting for approval on this task.");
  const step = one<StepRow>("SELECT * FROM ai_task_steps WHERE task_id = ? AND status = 'awaiting_approval' ORDER BY seq LIMIT 1", taskId)!;
  const tool = toolByName(step.tool)!;
  requireClinic(a, clinicId, tool.permission); // approver needs the same permission the action needs
  const decision = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : null;
  if (!decision) throw bad("Approve or reject.");
  run("INSERT INTO ai_approvals (id, task_id, step_id, approver_id, decision, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)", randomUUID(), taskId, step.id, a.user.id, decision, typeof input.note === "string" ? input.note.slice(0, 300) : "", Date.now());
  audit(a.user.id, `ai.step_${decision}`, "ai_task", taskId, { tool: tool.name });
  if (decision === "rejected") {
    run("UPDATE ai_task_steps SET status = 'skipped', error = 'rejected by ' || ? WHERE task_id = ? AND status IN ('pending','awaiting_approval')", a.user.name, taskId);
    finish(taskId);
  } else {
    run("UPDATE ai_task_steps SET status = 'pending' WHERE id = ?", step.id);
    run("UPDATE ai_tasks SET status = 'running', updated_at = ? WHERE id = ?", Date.now(), taskId);
    // re-entering advance with an approved step: mark it so the gate doesn't re-trigger
    executeApproved(a, taskId, step.id);
  }
  return taskView(a, clinicId, taskId);
}

function executeApproved(a: Auth, taskId: string, stepId: string) {
  const s = one<StepRow>("SELECT * FROM ai_task_steps WHERE id = ?", stepId)!;
  const t = one<TaskRow>("SELECT * FROM ai_tasks WHERE id = ?", taskId)!;
  const tool = toolByName(s.tool)!;
  const ctx: ToolCtx = { a, clinicId: t.clinic_id, taskId };
  run("UPDATE ai_task_steps SET started_at = ? WHERE id = ?", Date.now(), s.id);
  try {
    const out = tool.run(ctx, JSON.parse(s.input), outputsOf(taskId));
    const verified = tool.verify ? tool.verify(ctx, out) : true;
    run("UPDATE ai_task_steps SET status = 'done', output = ?, verified = ?, finished_at = ? WHERE id = ?", JSON.stringify(out ?? null), verified ? 1 : 0, Date.now(), s.id);
    audit(a.user.id, "ai.tool_executed", "ai_task", taskId, { tool: tool.name, verified, approved: true });
  } catch (e) {
    run("UPDATE ai_task_steps SET status = 'failed', error = ?, finished_at = ? WHERE id = ?", (e as Error).message.slice(0, 300), Date.now(), s.id);
    return finish(taskId);
  }
  advance(a, taskId);
}

export function cancelTask(a: Auth, clinicId: string, taskId: string) {
  const t = ownTask(a, clinicId, taskId);
  if (!["clarifying", "awaiting_approval", "running"].includes(t.status)) throw new HttpError(409, "finished", "This task has already finished.");
  run("UPDATE ai_task_steps SET status = 'skipped', error = 'task cancelled' WHERE task_id = ? AND status IN ('pending','awaiting_approval')", taskId);
  run("UPDATE ai_tasks SET status = 'cancelled', report = 'Cancelled by ' || ?, updated_at = ? WHERE id = ?", a.user.name, Date.now(), taskId);
  audit(a.user.id, "ai.task_cancelled", "ai_task", taskId);
  return taskView(a, clinicId, taskId);
}

export function taskView(a: Auth, clinicId: string, id: string) {
  const t = ownTask(a, clinicId, id);
  const steps = all<StepRow>("SELECT * FROM ai_task_steps WHERE task_id = ? ORDER BY seq", id);
  return {
    id: t.id,
    instruction: t.instruction,
    intent: t.intent,
    status: t.status,
    question: t.question,
    report: t.report,
    planner: { name: t.planner, configured: false },
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    steps: steps.map((s) => ({
      tool: s.tool,
      label: toolByName(s.tool)?.label ?? s.tool,
      risk: s.risk,
      status: s.status,
      preview: s.preview ? JSON.parse(s.preview) : null,
      output: s.output ? JSON.parse(s.output) : null,
      error: s.error,
      verified: s.verified === 1,
    })),
    approvals: all("SELECT p.decision, p.note, p.at, u.name AS approver FROM ai_approvals p JOIN users u ON u.id = p.approver_id WHERE p.task_id = ? ORDER BY p.at", id),
  };
}

export function listTasks(a: Auth, clinicId: string, f: { status?: string } = {}) {
  requireClinic(a, clinicId, "ai.use");
  return all<TaskRow & { requester: string }>(
    `SELECT t.*, u.name AS requester FROM ai_tasks t JOIN users u ON u.id = t.requested_by WHERE t.clinic_id = ? ${f.status ? "AND t.status = ?" : ""} ORDER BY t.created_at DESC LIMIT 100`,
    clinicId,
    ...(f.status ? [f.status] : []),
  ).map((t) => ({ id: t.id, instruction: t.instruction, status: t.status, requester: t.requester, createdAt: t.created_at, scheduled: !!t.schedule_id }));
}

/* ---------------- scheduled & recurring tasks ---------------- */

export function schedules(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "ai.use");
  return all("SELECT id, instruction, cadence, next_run_at, active FROM ai_schedules WHERE clinic_id = ? ORDER BY created_at", clinicId);
}

export function addSchedule(a: Auth, clinicId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "ai.configure");
  const instruction = typeof input.instruction === "string" ? input.instruction.trim() : "";
  if (instruction.length < 3) throw bad("Describe the recurring task.");
  const cadence = input.cadence === "weekly" ? "weekly" : "daily";
  const first = Number(input.firstRunAt);
  run(
    "INSERT INTO ai_schedules (id, clinic_id, instruction, cadence, next_run_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), clinicId, instruction.slice(0, 500), cadence, Number.isFinite(first) && first > Date.now() ? first : Date.now() + 3600_000, a.user.id, Date.now(),
  );
  return schedules(a, clinicId);
}

export function toggleSchedule(a: Auth, clinicId: string, id: string, active: boolean) {
  requireClinic(a, clinicId, "ai.configure");
  run("UPDATE ai_schedules SET active = ? WHERE id = ? AND clinic_id = ?", active ? 1 : 0, id, clinicId);
  return schedules(a, clinicId);
}

/**
 * Runs due schedules as the user who created them (their permissions apply).
 * ponytail: invoked on request (manual "run due now" and dashboard load); a real job queue/cron replaces this in production.
 */
export function runDueSchedules(a: Auth, clinicId: string, now = Date.now()) {
  requireClinic(a, clinicId, "ai.use");
  const due = all<{ id: string; instruction: string; cadence: string; next_run_at: number; created_by: string }>(
    "SELECT * FROM ai_schedules WHERE clinic_id = ? AND active = 1 AND next_run_at <= ?",
    clinicId, now,
  );
  const ran: string[] = [];
  for (const s of due) {
    const owner = one<{ id: string }>("SELECT id FROM users WHERE id = ?", s.created_by);
    if (!owner) continue;
    const ownerAuth: Auth = { ...a, user: { ...a.user, ...one<Auth["user"]>("SELECT * FROM users WHERE id = ?", s.created_by)! } };
    const step = s.cadence === "weekly" ? 7 * 86400_000 : 86400_000;
    run("UPDATE ai_schedules SET next_run_at = ? WHERE id = ?", s.next_run_at + Math.ceil((now - s.next_run_at + 1) / step) * step, s.id);
    try {
      ran.push(startTask(ownerAuth, clinicId, s.instruction, { scheduleId: s.id }).id);
    } catch {
      // a failing schedule must not block the others; the failure is visible in task history
    }
  }
  return { ran: ran.length, taskIds: ran };
}

/* ---------------- settings & usage (PRD §7.7) ---------------- */

export function aiSettings(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "ai.use");
  const s = one<{ enabled: number; recall_months: number }>("SELECT enabled, recall_months FROM ai_settings WHERE clinic_id = ?", clinicId) ?? { enabled: 1, recall_months: 6 };
  const usage = one<{ tasks: number; calls: number; latency: number }>(
    "SELECT COUNT(*) AS tasks, COALESCE(SUM(tool_calls), 0) AS calls, COALESCE(AVG(latency_ms), 0) AS latency FROM ai_usage WHERE clinic_id = ? AND at > ?",
    clinicId, Date.now() - 30 * 86400_000,
  )!;
  const outcomes = all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM ai_tasks WHERE clinic_id = ? AND created_at > ? GROUP BY status", clinicId, Date.now() - 30 * 86400_000);
  return {
    enabled: s.enabled === 1,
    recallMonths: s.recall_months,
    planner: { name: planner.name, configured: planner.configured },
    approvalPolicy: {
      automatic: ["Read-only summaries and reports", "Internal drafts and staff tasks"],
      needsApproval: ["Messages to patients", "Submitting content to FMD"],
      neverByAi: ["Refunds, payments or bank actions", "Editing signed clinical records", "Clinical diagnosis or treatment decisions", "Changing patient appointments"],
    },
    usage30d: { tasks: usage.tasks, toolCalls: usage.calls, avgLatencyMs: Math.round(usage.latency), estCostInr: 0, outcomes: Object.fromEntries(outcomes.map((o) => [o.status, o.n])) },
  };
}

export function updateAiSettings(a: Auth, clinicId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "ai.configure");
  const months = Number.isInteger(input.recallMonths) ? Math.max(1, Math.min(24, input.recallMonths as number)) : 6;
  run(
    "INSERT INTO ai_settings (clinic_id, enabled, recall_months, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (clinic_id) DO UPDATE SET enabled = excluded.enabled, recall_months = excluded.recall_months, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
    clinicId, input.enabled === false ? 0 : 1, months, a.user.id, Date.now(),
  );
  audit(a.user.id, "ai.settings_changed", "clinic", clinicId, { enabled: input.enabled !== false, months });
  return aiSettings(a, clinicId);
}
