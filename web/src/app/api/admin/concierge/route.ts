import { requireAuth } from "@/server/auth";
import { listQueue } from "@/server/concierge";
import { handler } from "@/server/http";

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams;
  return Response.json(listQueue(requireAuth(req), { status: q.get("status") ?? undefined, overdue: q.get("overdue") === "1", mine: q.get("mine") === "1" }));
});
