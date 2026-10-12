import { listSessions, requireAuth, revokeSession } from "@/server/auth";
import { body, handler, str } from "@/server/http";

export const GET = handler(async (req) => Response.json({ sessions: listSessions(requireAuth(req)) }));

export const DELETE = handler(async (req) => {
  const a = requireAuth(req);
  revokeSession(a, str((await body(req)).ref, "Session", { max: 20 }));
  return Response.json({ sessions: listSessions(a) });
});
