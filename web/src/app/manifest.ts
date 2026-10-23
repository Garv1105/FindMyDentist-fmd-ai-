import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Installable app details (name, colours, icons) for browsers and phones' "Add to home screen". */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.short,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#04050a",
    theme_color: "#04050a",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
