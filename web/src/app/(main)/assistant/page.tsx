import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { AssistantPage } from "@/components/main/assistant/Chat";

export const metadata: Metadata = { title: "FMD AI", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Fresh>
      <AssistantPage />
    </Fresh>
  );
}
