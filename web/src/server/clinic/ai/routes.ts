import { registerClinicRoutes } from "../router.ts";
import { TOOL_CATALOG } from "./tools.ts";
import * as ai from "./engine.ts";

registerClinicRoutes([
  ["GET", "ai/tasks", async ({ a, clinicId, q }) => await ai.listTasks(a, clinicId, { status: q.get("status") ?? undefined })],
  ["POST", "ai/tasks", async ({ a, clinicId, body }) => await ai.startTask(a, clinicId, body.instruction)],
  ["GET", "ai/tasks/:id", async ({ a, clinicId, p }) => await ai.taskView(a, clinicId, p.id)],
  ["POST", "ai/tasks/:id/decide", async ({ a, clinicId, p, body }) => await ai.decide(a, clinicId, p.id, body)],
  ["POST", "ai/tasks/:id/answer", async ({ a, clinicId, p, body }) => await ai.answerClarification(a, clinicId, p.id, body.answer)],
  ["POST", "ai/tasks/:id/cancel", async ({ a, clinicId, p }) => await ai.cancelTask(a, clinicId, p.id)],
  ["GET", "ai/schedules", async ({ a, clinicId }) => await ai.schedules(a, clinicId)],
  ["POST", "ai/schedules", async ({ a, clinicId, body }) => await ai.addSchedule(a, clinicId, body)],
  ["POST", "ai/schedules/:id", async ({ a, clinicId, p, body }) => await ai.toggleSchedule(a, clinicId, p.id, body.active === true)],
  ["POST", "ai/schedules/run-due", async ({ a, clinicId }) => await ai.runDueSchedules(a, clinicId)],
  ["GET", "ai/settings", async ({ a, clinicId }) => await ai.aiSettings(a, clinicId)],
  ["POST", "ai/settings", async ({ a, clinicId, body }) => await ai.updateAiSettings(a, clinicId, body)],
  ["GET", "ai/tools", () => TOOL_CATALOG],
]);
