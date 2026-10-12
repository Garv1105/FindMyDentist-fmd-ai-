import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { readAttachment } from "@/server/support";

export const GET = handler<RouteContext<"/api/support/tickets/[id]/attachments/[attachmentId]">>(async (req, ctx) => {
  const { id, attachmentId } = await ctx.params;
  const f = readAttachment(requireAuth(req), id, attachmentId);
  return new Response(new Uint8Array(f.bytes), {
    headers: { "content-type": f.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; sandbox" },
  });
});
