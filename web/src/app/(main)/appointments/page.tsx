import type { Metadata } from "next";
import { Suspense } from "react";
import { AppointmentsPage } from "@/components/main/appointments/Appointments";

export const metadata: Metadata = { title: "My appointments · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="app-panel h-48 animate-pulse" aria-busy />}>
      <AppointmentsPage />
    </Suspense>
  );
}
