import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#03050f] px-6 text-center text-[#eef2ff]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#03050f_0%,#060b1c_45%,#0a1428_75%,#03050f_100%)]" />
        <div className="absolute -left-[10%] top-[20%] h-[60%] w-[45%] rounded-full bg-[radial-gradient(closest-side,rgb(40_80_170/0.22),transparent)] blur-2xl" />
        <div className="absolute -right-[10%] top-[5%] h-[60%] w-[45%] rounded-full bg-[radial-gradient(closest-side,rgb(40_80_170/0.2),transparent)] blur-2xl" />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/mascots/mascot-point-512.webp" alt="" className="h-40 w-auto sm:h-52" />
      <h1 className="mt-4 bg-[linear-gradient(180deg,#ffffff_8%,#e3eaff_40%,#9fb2e0_78%,#c6d3f7_100%)] bg-clip-text text-[clamp(88px,18vw,200px)] font-normal leading-none tracking-[-0.03em] text-transparent [filter:drop-shadow(0_0_28px_rgb(110_150_255/0.35))]">
        404
      </h1>
      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.42em] text-[#c3cce6] sm:text-[14px]">Page not found</p>
      <p className="mt-4 max-w-[40ch] text-[15px] text-[#aab6d8]">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-[#0b1230] shadow-[0_8px_24px_-10px_rgb(180_200_255/0.7)] transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-[0_10px_30px_-8px_rgb(180_200_255/0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7f9cff]"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        Back to home
      </Link>
    </main>
  );
}
