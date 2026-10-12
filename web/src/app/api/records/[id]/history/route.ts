import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { accessHistory } from "@/server/records";

export const GET = handler<RouteContext<"/api/records/[id]/history">>(async (req, ctx) => Response.json({ items: accessHistory(requireAuth(req), (await ctx.params).id) }));
