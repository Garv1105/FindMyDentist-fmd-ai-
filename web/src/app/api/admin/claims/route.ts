import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { listClaims } from "@/server/providers";

export const GET = handler(async (req) => Response.json({ items: await listClaims(await requireAuth(req)) }));
