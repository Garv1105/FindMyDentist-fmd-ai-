import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { decideClaim } from "@/server/providers";

export const POST = handler<RouteContext<"/api/admin/claims/[id]">>(async (req, ctx) =>
  Response.json({ items: decideClaim(requireAuth(req), (await ctx.params).id, await body(req)) }),
);
