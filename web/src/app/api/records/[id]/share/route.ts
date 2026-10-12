import { requireAuth } from "@/server/auth";
import { body, handler, str } from "@/server/http";
import { revokeShare, shareRecord } from "@/server/records";

export const POST = handler<RouteContext<"/api/records/[id]/share">>(async (req, ctx) =>
  Response.json(shareRecord(requireAuth(req), (await ctx.params).id, await body(req)), { status: 201 }),
);
export const DELETE = handler<RouteContext<"/api/records/[id]/share">>(async (req, ctx) =>
  Response.json(revokeShare(requireAuth(req), (await ctx.params).id, str((await body(req)).shareId, "Share", { max: 64 }))),
);
