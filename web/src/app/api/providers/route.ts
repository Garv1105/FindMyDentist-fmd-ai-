import { devSeed } from "@/server/db";
import { handler } from "@/server/http";
import { searchProviders } from "@/server/providers";
import { seedDemoClinic } from "@/server/clinic/seed";
import { seedDemoDirectory } from "@/server/seed";

export const GET = handler(async (req) => {
  await devSeed(async () => {
    await seedDemoDirectory();
    await seedDemoClinic();
  });
  const q = new URL(req.url).searchParams;
  return Response.json(
    await searchProviders({
      q: q.get("q") ?? undefined,
      city: q.get("city") ?? undefined,
      specialty: q.get("specialty") ?? undefined,
      service: q.get("service") ?? undefined,
      language: q.get("language") ?? undefined,
      sort: q.get("sort") ?? undefined,
      page: Number(q.get("page") ?? 1),
    }),
  );
});
