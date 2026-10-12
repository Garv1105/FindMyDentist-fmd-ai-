import { sessionCookie, verifyOtp } from "@/server/auth";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => {
  const b = await body(req);
  const r = verifyOtp(b.target, b.code, req.headers.get("user-agent") ?? "");
  if (!r.ok) return Response.json({ error: "wrong_code", message: "That code isn't right. Check it and try again." }, { status: 400 });
  if ("needsProfile" in r) return Response.json({ needsProfile: true, ticket: r.ticket });
  return Response.json({ signedIn: true }, { headers: { "Set-Cookie": sessionCookie(r.token, r.maxAge) } });
});
