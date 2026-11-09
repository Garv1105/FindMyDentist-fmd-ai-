import type { ReactNode } from "react";
import { MainShell } from "@/components/main/MainShell";

/** Every FMD Main page except the homepage and the sign-in pages. */
export default function MainLayout({ children }: { children: ReactNode }) {
  return <MainShell>{children}</MainShell>;
}
