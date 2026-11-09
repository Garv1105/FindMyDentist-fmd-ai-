import type { Metadata } from "next";
import { MyPostsPage } from "@/components/main/explore/Create";

export const metadata: Metadata = { title: "Your posts · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <MyPostsPage />;
}
