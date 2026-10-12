import { requireAuth } from "@/server/auth";
import { cancelBooking } from "@/server/booking";
import { body, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/bookings/[id]/cancel">>(async (req, ctx) =>
  Response.json(cancelBooking(requireAuth(req), (await ctx.params).id, (await body(req)).reason)),
);
