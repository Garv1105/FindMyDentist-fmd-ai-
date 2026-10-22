import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dental Knowledge from Verified Dentists - Treatments, Tips & Oral Health",
  description:
    "Learn about dental implants, braces and aligners, root canal treatment, teeth whitening, tooth pain and everyday oral care - explained by verified dentists on FindMyDentist.",
  keywords: ["dental tips", "oral health", "tooth pain", "dental implants", "braces", "aligners", "root canal", "teeth whitening", "gum disease"],
  alternates: { canonical: "/explore" },
  openGraph: { url: "/explore", title: "Dental knowledge from verified dentists | FindMyDentist" },
};

export default function Layout({ children }: LayoutProps<"/explore">) {
  return children;
}
