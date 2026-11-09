import type { Metadata } from "next";
import { EnquiriesPage } from "@/components/main/concierge/Edge";

export const metadata: Metadata = { title: "Your FMD Edge requests · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <EnquiriesPage />;
}
