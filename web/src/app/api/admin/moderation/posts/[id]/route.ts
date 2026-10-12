import { requireAuth } from "@/server/auth";
import { moderatePost, reviewQueue } from "@/server/content";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/admin/moderation/posts/[id]">>(async (req, ctx) => {
  const a = requireAuth(req);
  moderatePost(a, (await ctx.params).id, await body(req));
  return Response.json(reviewQueue(a));
});
