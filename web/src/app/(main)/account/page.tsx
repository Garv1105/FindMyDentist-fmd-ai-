import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { Account } from "@/components/main/account/Account";

export const metadata: Metadata = { title: "Account · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Fresh>
      <Account />
    </Fresh>
  );
}
