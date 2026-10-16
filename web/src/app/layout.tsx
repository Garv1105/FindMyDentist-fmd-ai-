import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { noFlashScript } from "@/lib/themes"; // theme switcher removed: the site is fixed to the navy glass theme
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FindMyDentist — AI-native dental care",
  description:
    "Find the right dentist, understand treatments, and organise your dental care — guided by FMD AI, with you in control of every decision.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="obsidian-royal"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      {/* <head><script dangerouslySetInnerHTML={{ __html: noFlashScript }} /></head> — restore with the theme switcher */}
      <body className="fmd-glass isolate min-h-dvh">
        {/* Site-wide dark backdrop: faint colour orbs for the glass panels to refract */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#000000_0%,#02050d_45%,#050b1c_100%)]" />
          <div className="glass-orb absolute -left-[8%] top-[10%] size-[480px] rounded-full bg-[#2f6bff] opacity-[0.14] blur-[120px]" />
          <div className="glass-orb absolute -right-[6%] top-[40%] size-[420px] rounded-full bg-[#7c4dff] opacity-[0.09] blur-[120px] [animation-delay:-6s]" />
          <div className="glass-orb absolute bottom-[-10%] left-[30%] size-[400px] rounded-full bg-[#22c3ff] opacity-[0.07] blur-[110px] [animation-delay:-12s]" />
        </div>
        {children}
      </body>
    </html>
  );
}
