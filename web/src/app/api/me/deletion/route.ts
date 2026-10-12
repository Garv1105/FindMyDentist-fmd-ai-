import { requestDeletion, requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => {
  const a = requireAuth(req);
  return Response.json(requestDeletion(a, (await body(req)).reason), { status: 201 });
});
