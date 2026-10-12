import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { issueLink } from "@/server/records";

export const POST = handler<RouteContext<"/api/records/[id]/link">>(async (req, ctx) => {
  const mode = (await body(req)).mode === "download" ? "download" : "view";
  const { token, expiresAt } = issueLink(requireAuth(req), (await ctx.params).id, mode);
  return Response.json({ url: `/api/records/file?t=${encodeURIComponent(token)}`, expiresAt });
});
