import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPage } from "@/components/main/billing/Billing";

export const metadata: Metadata = { title: "Checkout · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo payments), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}>
      <CheckoutPage />
    </Suspense>
  );
}
