import type { Metadata } from "next";
import { PostPage } from "@/components/main/explore/Explore";

export const metadata: Metadata = { title: "Post · FMD", robots: { index: false, follow: false } };
/** data loads in the browser (demo content), so navigation into it isn't expected to be instant */
export const instant = false;

export default function Page() {
  return <PostPage />;
}
