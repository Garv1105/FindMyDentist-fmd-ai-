import type { Metadata } from "next";
import { TicketsPage } from "@/components/main/help/Support";

export const metadata: Metadata = { title: "Your questions to support · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <TicketsPage />;
}
