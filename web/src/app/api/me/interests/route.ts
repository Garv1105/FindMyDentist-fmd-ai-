import { requireAuth } from "@/server/auth";
import { interestsOf, setInterests } from "@/server/content";
import { body, handler } from "@/server/http";

export const GET = handler(async (req) => Response.json({ topics: interestsOf((await requireAuth(req)).user.id) }));
export const PUT = handler(async (req) => Response.json({ topics: setInterests(await requireAuth(req), (await body(req)).topics) }));
