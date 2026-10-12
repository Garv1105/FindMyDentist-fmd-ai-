import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { reopen, reply, staffUpdate, ticketDetail } from "@/server/support";

export const GET = handler<RouteContext<"/api/support/tickets/[id]">>(async (req, ctx) => Response.json(ticketDetail(requireAuth(req), (await ctx.params).id)));

/** { action: "reply" | "reopen" | "update", ... } — the service decides what each role may do. */
export const POST = handler<RouteContext<"/api/support/tickets/[id]">>(async (req, ctx) => {
  const a = requireAuth(req);
  const id = (await ctx.params).id;
  const b = await body(req);
  if (b.action === "reopen") return Response.json(reopen(a, id));
  if (b.action === "update") return Response.json(staffUpdate(a, id, b));
  return Response.json(reply(a, id, b));
});
