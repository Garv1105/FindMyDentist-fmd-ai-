import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { myJobs } from "@/server/jobs";

export const GET = handler(async (req) => Response.json({ items: myJobs(requireAuth(req)) }));
