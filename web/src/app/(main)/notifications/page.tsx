import type { Metadata } from "next";
import { NotificationsPage } from "@/components/main/help/Support";

export const metadata: Metadata = { title: "Notifications · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <NotificationsPage />;
}
