import type { Metadata } from "next";

// private: kept out of search results (robots.ts also asks crawlers not to visit)
export const metadata: Metadata = {
  title: "My dental records",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: LayoutProps<"/records">) {
  return children;
}
