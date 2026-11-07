import { deleteConversation, getConversation } from "@/server/assistant";
import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";

export const GET = handler<RouteContext<"/api/assistant/conversations/[id]">>(async (req, ctx) =>
  Response.json(await getConversation(await requireAuth(req), (await ctx.params).id)),
);
export const DELETE = handler<RouteContext<"/api/assistant/conversations/[id]">>(async (req, ctx) => {
  await deleteConversation(await requireAuth(req), (await ctx.params).id);
  return Response.json({ deleted: true });
});
