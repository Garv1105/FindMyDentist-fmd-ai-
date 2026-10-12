import { availability } from "@/server/booking";
import { handler } from "@/server/http";

export const GET = handler<RouteContext<"/api/providers/[id]/availability">>(async (req, ctx) =>
  Response.json(availability((await ctx.params).id, Date.now(), new URL(req.url).searchParams.get("clinic") ?? undefined)),
);
