import { requireAuth } from "@/server/auth";
import { reviewQueue } from "@/server/content";
import { handler } from "@/server/http";

export const GET = handler(async (req) => Response.json(reviewQueue(requireAuth(req))));
