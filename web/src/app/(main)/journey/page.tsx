import type { Metadata } from "next";
import { JourneysPage } from "@/components/main/records/Journey";

export const metadata: Metadata = {
  title: "Treatment journeys · FMD",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <JourneysPage />;
}
