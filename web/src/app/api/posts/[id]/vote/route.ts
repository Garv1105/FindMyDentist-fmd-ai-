import { requireAuth } from "@/server/auth";
import { vote } from "@/server/content";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/posts/[id]/vote">>(async (req, ctx) => Response.json(vote(requireAuth(req), (await ctx.params).id, (await body(req)).optionId)));
