import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { DentistProfilePage } from "@/components/main/account/Dentist";

export const metadata: Metadata = { title: "Dentist profile · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Fresh>
      <DentistProfilePage />
    </Fresh>
  );
}
