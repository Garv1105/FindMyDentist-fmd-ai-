import { chat } from "@/server/assistant";
import { currentAuth } from "@/server/auth";
import { body, handler } from "@/server/http";

export const POST = handler(async (req) => {
  // rate-limit key for signed-out visitors; behind a proxy, the first forwarded address
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return Response.json(await chat(currentAuth(req), await body(req), ip));
});
