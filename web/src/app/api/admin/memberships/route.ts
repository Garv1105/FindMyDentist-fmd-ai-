import { requireAuth } from "@/server/auth";
import { body, handler } from "@/server/http";
import { activateMembership } from "@/server/membership";

/** Staff-only: record a verified offline membership payment (until a gateway exists). */
export const POST = handler(async (req) => Response.json(activateMembership(requireAuth(req), await body(req)), { status: 201 }));
