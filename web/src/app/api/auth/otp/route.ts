import { requestOtp } from "@/server/auth";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => {
  const { target, kind, delivery, devCode } = requestOtp((await body(req)).target);
  return Response.json({ target, kind, delivery, devCode });
});
