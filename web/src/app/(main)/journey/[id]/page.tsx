import type { Metadata } from "next";
import { JourneyPage } from "@/components/main/records/Journey";

export const metadata: Metadata = {
  title: "Treatment · FMD",
  robots: { index: false, follow: false },
};
/** data loads in the browser (demo records), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <JourneyPage />;
}
