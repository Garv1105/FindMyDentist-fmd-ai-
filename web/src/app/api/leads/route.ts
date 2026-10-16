import { body, handler } from "@/server/http";
import { submitLead } from "@/server/leads";

/** Public: Clinic OS demo / early-access requests and the product-updates waitlist. */
export const POST = handler(async (req) => Response.json(submitLead(await body(req)), { status: 201 }));
