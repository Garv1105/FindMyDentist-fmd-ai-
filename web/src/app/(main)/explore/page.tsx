import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorePage } from "@/components/main/explore/Explore";

export const metadata: Metadata = { title: "Explore · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}>
      <ExplorePage />
    </Suspense>
  );
}
