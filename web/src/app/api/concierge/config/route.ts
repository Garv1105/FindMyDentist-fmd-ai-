import { conciergeConfig, CONTACT_METHODS, NEEDS, TIMINGS } from "@/server/concierge";

export async function GET() {
  return Response.json({ ...conciergeConfig(), needs: NEEDS, timings: TIMINGS, contactMethods: CONTACT_METHODS });
}
