import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { Suspense } from "react";
import { Onboarding } from "@/components/main/onboarding/Onboarding";

export const metadata: Metadata = { title: "Welcome · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy />}>
      <Fresh>
        <Onboarding />
      </Fresh>
    </Suspense>
  );
}
