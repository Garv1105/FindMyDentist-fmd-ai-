import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpPage } from "@/components/main/help/Support";

export const metadata: Metadata = { title: "Help · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}>
      <HelpPage />
    </Suspense>
  );
}
