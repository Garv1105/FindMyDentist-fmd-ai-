import type { Metadata } from "next";
import { BillingPage } from "@/components/main/billing/Billing";

export const metadata: Metadata = { title: "Payments and receipts · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <BillingPage />;
}
