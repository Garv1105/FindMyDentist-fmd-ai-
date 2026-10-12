import { requireAuth } from "@/server/auth";
import { bad, handler } from "@/server/http";
import { readByToken } from "@/server/records";

/** Streams a document for a short-lived signed token bound to the current session. */
export const GET = handler(async (req) => {
  const t = new URL(req.url).searchParams.get("t");
  if (!t) throw bad("Missing link.");
  const f = readByToken(requireAuth(req), t);
  return new Response(new Uint8Array(f.bytes), {
    headers: {
      "content-type": f.mime,
      "content-disposition": `${f.mode === "download" ? "attachment" : "inline"}; filename="${f.filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
