import type { Metadata } from "next";
import { ToolPage } from "@/components/main/assistant/Tools";

export const metadata: Metadata = { title: "FMD AI tools", robots: { index: false, follow: false } };
/** data loads in the browser (demo tools), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <ToolPage />;
}
