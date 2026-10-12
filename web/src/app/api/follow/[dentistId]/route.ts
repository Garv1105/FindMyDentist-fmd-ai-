import { requireAuth } from "@/server/auth";
import { toggleFollow } from "@/server/content";
import { handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/follow/[dentistId]">>(async (req, ctx) => Response.json(toggleFollow(requireAuth(req), (await ctx.params).dentistId)));
