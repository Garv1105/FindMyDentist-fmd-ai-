import { requireAuth } from "@/server/auth";
import { bad, handler } from "@/server/http";
import { attach } from "@/server/support";

export const POST = handler<RouteContext<"/api/support/tickets/[id]/attachments">>(async (req, ctx) => {
  const a = requireAuth(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw bad("Choose a file.");
  return Response.json(attach(a, (await ctx.params).id, new Uint8Array(await file.arrayBuffer())), { status: 201 });
});
