import { clearSessionCookie, currentAuth, signOut } from "@/server/auth";
import { handler } from "@/server/http";

export const POST = handler(async (req) => {
  const a = currentAuth(req);
  if (a) signOut(a);
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
});
