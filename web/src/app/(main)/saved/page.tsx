import type { Metadata } from "next";
import { SavedPage } from "@/components/main/explore/Create";

export const metadata: Metadata = { title: "Saved · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <SavedPage />;
}
