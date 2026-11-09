import type { Metadata } from "next";
import { Suspense } from "react";
import { NewJobPage } from "@/components/main/jobs/Jobs";

export const metadata: Metadata = { title: "Post a job · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}>
      <NewJobPage />
    </Suspense>
  );
}
