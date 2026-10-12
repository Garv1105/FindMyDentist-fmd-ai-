import { requireAuth } from "@/server/auth";
import { createWorkspace, myClinics } from "@/server/clinic/workspace";
import { devSeed } from "@/server/db";
import { body, handler } from "@/server/http";
import { seedDemoClinic } from "@/server/clinic/seed";
import { seedDemoDirectory } from "@/server/seed";

export const GET = handler(async (req) => {
  devSeed(() => {
    seedDemoDirectory();
    seedDemoClinic();
  });
  return Response.json({ items: myClinics(requireAuth(req)) });
});
export const POST = handler(async (req) => Response.json(createWorkspace(requireAuth(req), await body(req)), { status: 201 }));
