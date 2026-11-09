import type { Metadata } from "next";
import { PrivacyNoticePage } from "@/components/main/legal/Legal";

export const metadata: Metadata = { title: "Privacy Notice · FMD" };

export default function Page() {
  return <PrivacyNoticePage />;
}
