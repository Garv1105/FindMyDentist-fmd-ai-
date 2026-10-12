import { listConversations } from "@/server/assistant";
import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";

export const GET = handler(async (req) => Response.json({ items: listConversations(requireAuth(req)) }));
