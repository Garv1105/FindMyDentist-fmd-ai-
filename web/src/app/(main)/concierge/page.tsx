import type { Metadata } from "next";
import { EdgePage } from "@/components/main/concierge/Edge";

export const metadata: Metadata = { title: "FMD Edge · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <EdgePage />;
}
