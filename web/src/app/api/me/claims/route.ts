import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { myClaims } from "@/server/providers";

export const GET = handler(async (req) => Response.json({ items: myClaims(requireAuth(req)) }));
