import { register, sessionCookie, type ConsentPurpose } from "@/server/auth";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => {
  const b = await body(req);
  const consents = (b.consents && typeof b.consents === "object" ? b.consents : {}) as Partial<Record<ConsentPurpose, boolean>>;
  const s = register({ ticket: b.ticket, name: b.name, accountType: b.accountType, consents, userAgent: req.headers.get("user-agent") ?? "" });
  return Response.json({ signedIn: true }, { status: 201, headers: { "Set-Cookie": sessionCookie(s.token, s.maxAge) } });
});
