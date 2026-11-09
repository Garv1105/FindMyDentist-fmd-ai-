import type { Metadata } from "next";
import { TermsPage } from "@/components/main/legal/Legal";

export const metadata: Metadata = { title: "Terms of Use · FMD" };

export default function Page() {
  return <TermsPage />;
}
