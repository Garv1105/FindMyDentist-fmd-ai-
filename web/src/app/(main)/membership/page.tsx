import type { Metadata } from "next";
import { MembershipPage } from "@/components/main/billing/Billing";

export const metadata: Metadata = { title: "Membership · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <MembershipPage />;
}
