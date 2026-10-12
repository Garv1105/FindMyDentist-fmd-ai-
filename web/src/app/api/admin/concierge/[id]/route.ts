import { requireAuth } from "@/server/auth";
import { enquiryDetail } from "@/server/concierge";
import { handler } from "@/server/http";

export const GET = handler<RouteContext<"/api/admin/concierge/[id]">>(async (req, ctx) =>
  Response.json(enquiryDetail(requireAuth(req), (await ctx.params).id)),
);
