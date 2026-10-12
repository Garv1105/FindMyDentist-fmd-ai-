import { requireAuth } from "@/server/auth";
import { toggle } from "@/server/content";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/posts/[id]/react">>(async (req, ctx) => {
  const what = (await body(req)).what === "save" ? "save" : "like";
  return Response.json(toggle(requireAuth(req), (await ctx.params).id, what));
});
