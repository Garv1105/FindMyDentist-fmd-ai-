import { requireAuth } from "@/server/auth";
import { activateWorkspace } from "@/server/clinic/workspace";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/admin/clinics/[clinicId]/activate">>(async (req, ctx) => {
  await activateWorkspace(await requireAuth(req), (await ctx.params).clinicId, (await body(req)).evidence);
  return Response.json({ activated: true });
});
