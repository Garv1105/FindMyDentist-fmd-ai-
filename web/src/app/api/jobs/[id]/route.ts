import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { updateJob } from "@/server/jobs";

export const POST = handler<RouteContext<"/api/jobs/[id]">>(async (req, ctx) => Response.json(await updateJob(await requireAuth(req), (await ctx.params).id, (await body(req)).action)));
