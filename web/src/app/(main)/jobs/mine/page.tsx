import type { Metadata } from "next";
import { MyJobsPage } from "@/components/main/jobs/Jobs";

export const metadata: Metadata = { title: "Your postings · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <MyJobsPage />;
}
