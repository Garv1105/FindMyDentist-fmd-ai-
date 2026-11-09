import type { Metadata } from "next";
import { PlansPage } from "@/components/main/billing/Billing";

export const metadata: Metadata = { title: "Plans · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <PlansPage />;
}
