import { currentAuth } from "@/server/auth";
import { submitEnquiry } from "@/server/concierge";
import { body, handler } from "@/server/http";

/** Signed-in users get the request linked to their account; signed-out users may still ask for help. */
export const POST = handler(async (req) => Response.json(submitEnquiry(await body(req), currentAuth(req)), { status: 201 }));
