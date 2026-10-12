import { requireAuth } from "@/server/auth";
import { handler } from "@/server/http";
import { membershipStatus } from "@/server/membership";

export const GET = handler(async (req) => Response.json(membershipStatus(requireAuth(req))));
