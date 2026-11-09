import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { AppointmentPage } from "@/components/main/appointments/Appointments";

export const metadata: Metadata = { title: "Appointment · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo bookings), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return (
    <Fresh>
      <AppointmentPage />
    </Fresh>
  );
}
