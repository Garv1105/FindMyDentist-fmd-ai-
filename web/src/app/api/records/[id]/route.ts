import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { deleteRecord } from "@/server/records";

export const DELETE = handler<RouteContext<"/api/records/[id]">>(async (req, ctx) => {
  deleteRecord(requireAuth(req), (await ctx.params).id);
  return Response.json({ deleted: true });
});
