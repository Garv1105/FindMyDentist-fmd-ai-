import { requireAuth } from "@/server/auth";
import { act, enquiryDetail } from "@/server/concierge";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/admin/concierge/[id]/actions">>(async (req, ctx) => {
  const a = await requireAuth(req);
  const { id } = await ctx.params;
  await act(a, id, await body(req));
  return Response.json(await enquiryDetail(a, id));
});
