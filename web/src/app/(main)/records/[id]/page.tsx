import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { RecordPage } from "@/components/main/records/Records";

export const metadata: Metadata = {
  title: "Record · FMD",
  robots: { index: false, follow: false },
};
/** data loads in the browser (demo records), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return (
    <Fresh>
      <RecordPage />
    </Fresh>
  );
}
