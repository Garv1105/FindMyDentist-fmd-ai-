import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { noFlashScript } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FindMyDentist — AI-native dental care",
  description:
    "Find the right dentist, understand treatments, and organise your dental care — guided by FMD AI, with you in control of every decision.",
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
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
