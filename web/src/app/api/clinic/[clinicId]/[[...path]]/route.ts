import { requireAuth } from "@/server/auth";
import { dispatch } from "@/server/clinic/router";
import "@/server/clinic/ai/routes";
import { body, handler } from "@/server/http";

type Ctx = RouteContext<"/api/clinic/[clinicId]/[[...path]]">;

/** All Clinic OS endpoints. Authorisation happens inside each service (requireClinic). */
async function go(method: string, req: Request, ctx: Ctx) {
  const { clinicId, path } = await ctx.params;
  return dispatch(method, path ?? [], {
    a: requireAuth(req),
    clinicId,
    body: method === "GET" ? {} : await body(req),
    q: new URL(req.url).searchParams,
  });
}

export const GET = handler<Ctx>(async (req, ctx) => go("GET", req, ctx));
export const POST = handler<Ctx>(async (req, ctx) => go("POST", req, ctx));
