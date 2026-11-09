import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { myTickets, openTicket } from "@/server/support";

export const GET = handler(async (req) => Response.json({ items: myTickets(requireAuth(req)) }));
export const POST = handler(async (req) => Response.json(openTicket(requireAuth(req), await body(req)), { status: 201 }));
