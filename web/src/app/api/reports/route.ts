import { requireAuth } from "@/server/auth";
import { report } from "@/server/content";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => Response.json(report(await requireAuth(req), await body(req)), { status: 201 }));
