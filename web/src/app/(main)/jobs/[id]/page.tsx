import type { Metadata } from "next";
import { JobPage } from "@/components/main/jobs/Jobs";

export const metadata: Metadata = { title: "Job · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo jobs), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <JobPage />;
}
