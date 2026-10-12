import { registerClinicRoutes } from "../router.ts";
import { TOOL_CATALOG } from "./tools.ts";
import * as ai from "./engine.ts";

registerClinicRoutes([
  ["GET", "ai/tasks", ({ a, clinicId, q }) => ai.listTasks(a, clinicId, { status: q.get("status") ?? undefined })],
  ["POST", "ai/tasks", ({ a, clinicId, body }) => ai.startTask(a, clinicId, body.instruction)],
  ["GET", "ai/tasks/:id", ({ a, clinicId, p }) => ai.taskView(a, clinicId, p.id)],
  ["POST", "ai/tasks/:id/decide", ({ a, clinicId, p, body }) => ai.decide(a, clinicId, p.id, body)],
  ["POST", "ai/tasks/:id/answer", ({ a, clinicId, p, body }) => ai.answerClarification(a, clinicId, p.id, body.answer)],
  ["POST", "ai/tasks/:id/cancel", ({ a, clinicId, p }) => ai.cancelTask(a, clinicId, p.id)],
  ["GET", "ai/schedules", ({ a, clinicId }) => ai.schedules(a, clinicId)],
  ["POST", "ai/schedules", ({ a, clinicId, body }) => ai.addSchedule(a, clinicId, body)],
  ["POST", "ai/schedules/:id", ({ a, clinicId, p, body }) => ai.toggleSchedule(a, clinicId, p.id, body.active === true)],
  ["POST", "ai/schedules/run-due", ({ a, clinicId }) => ai.runDueSchedules(a, clinicId)],
  ["GET", "ai/settings", ({ a, clinicId }) => ai.aiSettings(a, clinicId)],
  ["POST", "ai/settings", ({ a, clinicId, body }) => ai.updateAiSettings(a, clinicId, body)],
  ["GET", "ai/tools", () => TOOL_CATALOG],
]);
