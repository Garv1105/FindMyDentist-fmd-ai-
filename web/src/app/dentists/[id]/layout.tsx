import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dentist Profile - Services, Clinic & Appointments",
  description: "See this dentist’s services, clinic, availability and patient guidance, and book an appointment on FindMyDentist.",
};

export default function Layout({ children }: LayoutProps<"/dentists/[id]">) {
  return children;
}
