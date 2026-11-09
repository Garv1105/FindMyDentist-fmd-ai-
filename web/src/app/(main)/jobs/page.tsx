import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsPage } from "@/components/main/jobs/Jobs";

export const metadata: Metadata = { title: "Dental jobs · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}>
      <JobsPage />
    </Suspense>
  );
}
