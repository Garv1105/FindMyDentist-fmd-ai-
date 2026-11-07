import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { myTickets, openTicket } from "@/server/support";

export const GET = handler(async (req) => Response.json({ items: await myTickets(await requireAuth(req)) }));
export const POST = handler(async (req) => Response.json(await openTicket(await requireAuth(req), await body(req)), { status: 201 }));
