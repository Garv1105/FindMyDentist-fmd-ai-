import type { Metadata } from "next";
import { Suspense } from "react";
import { Fresh } from "@/components/app/Fresh";
import { BookPage } from "@/components/main/booking/Book";

export const metadata: Metadata = { title: "Book an appointment · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo directory), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-64 animate-pulse" aria-busy />}>
      <Fresh>
        <BookPage />
      </Fresh>
    </Suspense>
  );
}
