import { requireAuth, updateConsents, type ConsentPurpose } from "@/server/auth";
import { body, handler } from "@/server/http";

export const PUT = handler(async (req) => {
  const a = await requireAuth(req);
  const consents = await updateConsents(a, (await body(req)) as Partial<Record<ConsentPurpose, boolean>>);
  return Response.json({ consents });
});
