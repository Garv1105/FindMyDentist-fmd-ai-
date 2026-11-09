import type { Metadata } from "next";
import { ArticlePage } from "@/components/main/help/Support";

export const metadata: Metadata = { title: "Help · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo help), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <ArticlePage />;
}
