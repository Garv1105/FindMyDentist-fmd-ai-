import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { PersonalisationPage } from "@/components/main/trust/Trust";

export const metadata: Metadata = { title: "Personalisation · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Fresh>
      <PersonalisationPage />
    </Fresh>
  );
}
