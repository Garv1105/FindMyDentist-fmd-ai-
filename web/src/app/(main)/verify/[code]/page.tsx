import type { Metadata } from "next";
import { VerifyPage } from "@/components/main/records/Certificate";

export const metadata: Metadata = {
  title: "Check a certificate · FMD",
  robots: { index: false, follow: false },
};
/** data loads in the browser (demo records), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <VerifyPage />;
}
