import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Crawl the public pages; keep out of people's private areas, the clinic tools and the API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/appointments", "/records", "/signin", "/admin", "/clinic", "/hehe"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
