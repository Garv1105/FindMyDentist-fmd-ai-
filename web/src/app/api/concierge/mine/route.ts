import { requireAuth } from "@/server/auth";
import { myEnquiries } from "@/server/concierge";
import { handler } from "@/server/http";

export const GET = handler(async (req) => Response.json({ items: await myEnquiries(await requireAuth(req)) }));
