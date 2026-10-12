import { requireAuth } from "@/server/auth";
import { acceptInvite } from "@/server/clinic/workspace";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => Response.json(acceptInvite(requireAuth(req), (await body(req)).token)));
