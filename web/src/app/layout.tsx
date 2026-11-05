import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import CursorFx from "@/components/CursorFx";
import { SITE } from "@/lib/site";
import { noFlashScript } from "@/lib/themes";
import "./globals.css";

// brand face: Plus Jakarta Sans, variable (200–800), self-hosted by next/font
const brandSans = Plus_Jakarta_Sans({ variable: "--font-brand", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// what search engines and social networks show for the site; the share image is app/opengraph-image.png, the icons
// app/icon.png, app/apple-icon.png and app/favicon.ico (all picked up by file name)
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} - Find Verified Dentists Near You & AI Dental Guidance`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: SITE.keywords,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "health",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: SITE.name,
    title: `${SITE.name} - ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} - ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  verification: {
    ...(SITE.verification.google && { google: SITE.verification.google }),
    ...(SITE.verification.bing && { other: { "msvalidate.01": SITE.verification.bing } }),
  },
};

// structured data: who the site is (name, logo, what it does), so search results can show the brand properly
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      alternateName: SITE.short,
      url: SITE.url,
      logo: `${SITE.url}/logo.png`,
      description: SITE.description,
      areaServed: { "@type": "Country", name: "India" },
      knowsAbout: ["Dentistry", "Dental implants", "Orthodontics", "Root canal treatment", "Teeth whitening", "Oral health"],
      ...(SITE.social.length && { sameAs: SITE.social }),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      alternateName: SITE.short,
      url: SITE.url,
      description: SITE.description,
      inLanguage: "en-IN",
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#04050a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="obsidian-royal"
      suppressHydrationWarning
      className={`${brandSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <CursorFx />
      </body>
    </html>
  );
}
