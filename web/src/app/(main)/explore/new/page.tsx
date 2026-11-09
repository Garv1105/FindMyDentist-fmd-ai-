import type { Metadata } from "next";
import { NewPostPage } from "@/components/main/explore/Create";

export const metadata: Metadata = { title: "Create a post · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return <NewPostPage />;
}
