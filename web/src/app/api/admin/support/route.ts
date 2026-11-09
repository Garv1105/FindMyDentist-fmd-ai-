import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { queue } from "@/server/support";

export const GET = handler(async (req) => Response.json(queue(requireAuth(req), { status: new URL(req.url).searchParams.get("status") ?? undefined })));
