import { requireAuth } from "@/server/auth";
import { bookingHistory } from "@/server/booking";
import { handler } from "@/server/http";

export const GET = handler<RouteContext<"/api/bookings/[id]">>(async (req, ctx) => Response.json(await bookingHistory(await requireAuth(req), (await ctx.params).id)));
