import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { submitClaim } from "@/server/providers";

export const POST = handler<RouteContext<"/api/providers/[id]/claim">>(async (req, ctx) =>
  Response.json(await submitClaim(await requireAuth(req), (await ctx.params).id, await body(req)), { status: 201 }),
);
