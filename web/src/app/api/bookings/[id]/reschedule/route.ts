import { requireAuth } from "@/server/auth";
import { rescheduleBooking } from "@/server/booking";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/bookings/[id]/reschedule">>(async (req, ctx) =>
  Response.json(await rescheduleBooking(await requireAuth(req), (await ctx.params).id, await body(req)), { status: 201 }),
);
