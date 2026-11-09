import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { PrivacyPage } from "@/components/main/account/Privacy";

export const metadata: Metadata = { title: "Privacy and data · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Fresh>
      <PrivacyPage />
    </Fresh>
  );
}
