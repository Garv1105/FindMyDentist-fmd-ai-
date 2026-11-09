import { handler } from "@/server/http";
import { providerProfile } from "@/server/providers";

export const GET = handler<RouteContext<"/api/providers/[id]">>(async (_req, ctx) => Response.json(providerProfile((await ctx.params).id)));
