import { requireAuth } from "@/server/auth";
import { myBookings, requestBooking } from "@/server/booking";
import { body, handler } from "@/server/http";

export const GET = handler(async (req) => Response.json({ items: myBookings(requireAuth(req)) }));
export const POST = handler(async (req) => Response.json(requestBooking(requireAuth(req), await body(req)), { status: 201 }));
