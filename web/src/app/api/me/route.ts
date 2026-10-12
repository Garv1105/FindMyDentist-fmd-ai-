import { currentAuth, publicMe, requireAuth, updateProfile } from "@/server/auth";
import { body, handler } from "@/server/http";

/** 200 with { user: null } when signed out, so pages can render a signed-out state without an error. */
export const GET = handler(async (req) => {
  const a = currentAuth(req);
  return Response.json({ user: a ? publicMe(a) : null });
});

export const PATCH = handler(async (req) => {
  const a = requireAuth(req);
  const b = await body(req);
  const user = updateProfile(a, { name: b.name, language: b.language });
  return Response.json({ user: publicMe({ ...a, user }) });
});
