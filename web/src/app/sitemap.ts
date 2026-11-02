import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly") => ({
    url: `${SITE.url}${path}`,
    changeFrequency,
    priority,
  });
  return [page("", 1, "weekly"), page("/explore", 0.9, "daily"), page("/jobs", 0.7, "daily"), page("/help", 0.5, "monthly")];
}
