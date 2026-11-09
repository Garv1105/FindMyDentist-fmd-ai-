import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { InvitePage } from "@/components/main/trust/Trust";

export const metadata: Metadata = { title: "Invite friends · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Fresh>
      <InvitePage />
    </Fresh>
  );
}
