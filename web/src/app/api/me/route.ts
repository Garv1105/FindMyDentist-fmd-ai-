import { currentAuth, publicMe, requireAuth, updateProfile } from "@/server/auth";
import { body, handler } from "@/server/http";

/**
 * 200 with { user: null } when signed out, so pages can render a signed-out state without an error.
 * ?fresh=1 re-reads the FastAPI account now (after signing in, or after a change made there).
 */
export const GET = handler(async (req) => {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const a = await currentAuth(req, { fresh });
  return Response.json({ user: a ? publicMe(a) : null });
});

/** This app's own preferences (language). Name, phone and email are changed through the FastAPI account. */
export const PATCH = handler(async (req) => {
  const a = await requireAuth(req);
  const user = updateProfile(a, { language: (await body(req)).language });
  return Response.json({ user: publicMe({ ...a, user }) });
});
