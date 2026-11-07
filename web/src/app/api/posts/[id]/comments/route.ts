import { requireAuth } from "@/server/auth";
import { addComment, comments } from "@/server/content";
import { body, handler } from "@/server/http";

export const GET = handler<RouteContext<"/api/posts/[id]/comments">>(async (_req, ctx) => Response.json({ items: await comments((await ctx.params).id) }));
export const POST = handler<RouteContext<"/api/posts/[id]/comments">>(async (req, ctx) =>
  Response.json({ items: await addComment(await requireAuth(req), (await ctx.params).id, (await body(req)).body) }, { status: 201 }),
);
