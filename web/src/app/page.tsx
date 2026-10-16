import type { Metadata } from "next";
import { DiscoveryProvider } from "@/components/discovery";
import { AssistantPanel } from "@/components/hero/Assistant";
import Hero from "@/components/hero/Hero";
import Navbar from "@/components/nav/Navbar";
import About from "@/components/sections/About";
import AiFeatures from "@/components/sections/AiFeatures";
import ClinicOS from "@/components/sections/ClinicOS";
// /* extra (not in homepage PDF) — restore when needed */
// import ComingSoon from "@/components/sections/ComingSoon";
// import Concierge from "@/components/sections/Concierge";
import Dentists from "@/components/sections/Dentists";
import Ecosystem from "@/components/sections/Ecosystem";
import Explore from "@/components/sections/Explore";
import Faq from "@/components/sections/Faq";
import Footer from "@/components/sections/Footer";
import ForDentists from "@/components/sections/ForDentists";
// import Intelligence from "@/components/sections/Intelligence";
import JoinNetwork from "@/components/sections/JoinNetwork";
import LowerWorld from "@/components/sections/LowerWorld";
// import Products from "@/components/sections/Products";
import Records from "@/components/sections/Records";
// import Search from "@/components/sections/Search"; // extra (not in homepage PDF)
import Showcase from "@/components/sections/Showcase";
// import { BrandStatement, Philosophy } from "@/components/sections/Statements";
import Trust from "@/components/sections/Trust";
import Walkthrough from "@/components/sections/Walkthrough";
import WhyFMD from "@/components/sections/WhyFMD";

export const metadata: Metadata = {
  title: "FindMyDentist — The world's first AI-native ecosystem for dentistry",
  description:
    "FMD connects patient care, dentist discovery, dental records and AI-assisted clinic operations in one dentistry-focused ecosystem: FMD Main, FMD Clinic OS and FMD Intelligence.",
};

// Order follows the FMD homepage revision brief (§ numbers). The hero is unchanged.
export default function Home() {
  return (
    <DiscoveryProvider>
      <Navbar />
      <main>
        <Hero /> {/* 01 */}
        {/* extra (not in homepage PDF), restore when needed: <Search /> */}
        <LowerWorld>
          {/* extra (not in homepage PDF), restore when needed: <BrandStatement /> */}
          <About /> {/* 03 */}
          {/* <Philosophy /> */}
          <Ecosystem /> {/* 04 */}
          {/* <Intelligence /> */}
          <ClinicOS /> {/* 06 */}
          <Walkthrough /> {/* 07 FMD Main */}
          <AiFeatures /> {/* 08 */}
          <Explore /> {/* 09 */}
          <Records /> {/* 10 */}
          {/* <Concierge /> FMD Edge */}
          <Dentists /> {/* 12 */}
          <ForDentists /> {/* 13 */}
          {/* <Products /> Scholar & companies */}
          <Showcase /> {/* 15 */}
          <WhyFMD /> {/* 16 */}
          <Trust /> {/* 17 — §18 testimonials omitted until genuine evidence exists */}
          <JoinNetwork /> {/* 19 */}
          <Faq /> {/* 20 */}
        </LowerWorld>
        {/* <ComingSoon /> general product-updates waitlist */}
      </main>
      <Footer /> {/* 21 */}
      <AssistantPanel />
    </DiscoveryProvider>
  );
}
