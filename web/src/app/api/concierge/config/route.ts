import { NextResponse } from "next/server";
import { CONCIERGE } from "@/lib/concierge";

export function GET() {
  return NextResponse.json(CONCIERGE);
}
