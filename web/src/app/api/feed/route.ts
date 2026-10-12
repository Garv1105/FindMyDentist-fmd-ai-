import { currentAuth } from "@/server/auth";
import { feed } from "@/server/content";
import { devSeed } from "@/server/db";
import { handler } from "@/server/http";
import { seedDemoContent, seedDemoDirectory } from "@/server/seed";

export const GET = handler(async (req) => {
  devSeed(() => {
    seedDemoDirectory();
    seedDemoContent();
  });
  const q = new URL(req.url).searchParams;
  return Response.json(feed(currentAuth(req), { tab: q.get("tab") ?? undefined, topic: q.get("topic") ?? undefined, q: q.get("q") ?? undefined }));
});
