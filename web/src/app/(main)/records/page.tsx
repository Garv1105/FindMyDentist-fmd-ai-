import type { Metadata } from "next";
import { Suspense } from "react";
import { RecordsPage } from "@/components/main/records/Records";

export const metadata: Metadata = {
  title: "Records · FMD",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense
      fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}
    >
      <RecordsPage />
    </Suspense>
  );
}
