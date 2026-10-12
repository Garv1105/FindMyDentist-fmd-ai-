import { requireAuth } from "@/server/auth";
import { workspacesForOps } from "@/server/clinic/workspace";
import { handler } from "@/server/http";

export const GET = handler(async (req) => Response.json({ items: workspacesForOps(requireAuth(req)) }));
