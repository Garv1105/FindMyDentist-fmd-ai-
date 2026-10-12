import { currentAuth, requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { postJob, searchJobs } from "@/server/jobs";

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams;
  return Response.json({ items: searchJobs(currentAuth(req), { q: q.get("q") ?? undefined, city: q.get("city") ?? undefined, role: q.get("role") ?? undefined }) });
});
export const POST = handler(async (req) => Response.json(postJob(requireAuth(req), await body(req)), { status: 201 }));
