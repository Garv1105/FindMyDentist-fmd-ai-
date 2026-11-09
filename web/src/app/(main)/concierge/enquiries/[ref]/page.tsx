import type { Metadata } from "next";
import { EnquiryPage } from "@/components/main/concierge/Edge";

export const metadata: Metadata = { title: "FMD Edge request · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo requests), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <EnquiryPage />;
}
