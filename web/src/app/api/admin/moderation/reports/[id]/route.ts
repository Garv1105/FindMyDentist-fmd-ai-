import { requireAuth } from "@/server/auth";
import { decideReport, reviewQueue } from "@/server/content";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/admin/moderation/reports/[id]">>(async (req, ctx) => {
  const a = await requireAuth(req);
  await decideReport(a, (await ctx.params).id, await body(req));
  return Response.json(await reviewQueue(a));
});
