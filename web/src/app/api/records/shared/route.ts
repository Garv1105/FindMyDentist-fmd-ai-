import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { sharedWithMe } from "@/server/records";

export const GET = handler(async (req) => Response.json({ items: await sharedWithMe(await requireAuth(req)) }));
