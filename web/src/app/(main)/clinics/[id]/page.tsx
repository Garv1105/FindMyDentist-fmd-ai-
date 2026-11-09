import type { Metadata } from "next";
import { ClinicView } from "@/components/main/dentists/Profile";

export const metadata: Metadata = { title: "Clinic · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo directory), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <ClinicView />;
}
