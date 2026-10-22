import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dental Jobs - Dentist, Hygienist & Dental Assistant Jobs",
  description: "Find dental jobs at clinics near you: dentists, orthodontists, hygienists, dental assistants and front-desk roles, on FindMyDentist.",
  keywords: ["dental jobs", "dentist jobs", "dental assistant jobs", "dental hygienist jobs", "orthodontist jobs", "clinic jobs"],
  alternates: { canonical: "/jobs" },
  openGraph: { url: "/jobs", title: "Dental jobs | FindMyDentist" },
};

export default function Layout({ children }: LayoutProps<"/jobs">) {
  return children;
}
