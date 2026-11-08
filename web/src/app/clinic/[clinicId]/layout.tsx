import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ClinicShell } from "@/components/clinic/Shell";

export const metadata: Metadata = {
  title: "FMD Clinic",
  robots: { index: false, follow: false },
};

/** A signed-in app whose data loads in the browser; instant-navigation validation isn't a goal here. */
export const instant = false;

/** Search params (date, branch) are request-time data, so the shell streams in behind Suspense. */
export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy />}>
      <ClinicShell>{children}</ClinicShell>
    </Suspense>
  );
}
