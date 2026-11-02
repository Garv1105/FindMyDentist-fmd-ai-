import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Answers about finding a dentist, booking appointments, your dental records, FMD AI and your FindMyDentist account.",
  alternates: { canonical: "/help" },
  openGraph: { url: "/help", title: "Help & support | FindMyDentist" },
};

export default function Layout({ children }: LayoutProps<"/help">) {
  return children;
}
