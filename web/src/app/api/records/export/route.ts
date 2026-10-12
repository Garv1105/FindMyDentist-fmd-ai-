import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { exportManifest } from "@/server/records";

export const GET = handler(async (req) =>
  new Response(JSON.stringify(exportManifest(requireAuth(req)), null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="fmd-records-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  }),
);
