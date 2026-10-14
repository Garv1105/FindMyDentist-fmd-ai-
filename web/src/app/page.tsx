import { DiscoveryProvider } from "@/components/discovery";
import { AssistantPanel } from "@/components/hero/Assistant";
import Hero from "@/components/hero/Hero";
import Navbar from "@/components/nav/Navbar";
import AiValue from "@/components/sections/AiValue";
import ComingSoon from "@/components/sections/ComingSoon";
import Concierge from "@/components/sections/Concierge";
import Dentists from "@/components/sections/Dentists";
import Explore from "@/components/sections/Explore";
import Footer from "@/components/sections/Footer";
import LowerWorld from "@/components/sections/LowerWorld";
import Journey from "@/components/sections/Journey";
import QuickActions from "@/components/sections/QuickActions";
import Records from "@/components/sections/Records";
import Treatments from "@/components/sections/Treatments";
import Trust from "@/components/sections/Trust";
import HeroSection from "@/components/sections/HeroSection";
import SearchPanel from "@/components/sections/SearchPanel";

export default function Home() {
  return (
    <DiscoveryProvider>
      <Navbar />
      <main>
        {/*
          Scroll-driven frame hero.
          showHeader=false because you already have your own Navbar at the top.
        */}
        <HeroSection showHeader={false} />

        {/* Keep your existing Hero if you want both; comment out if replacing */}
        {/* <Hero /> */}
        <SearchPanel /> 
        <QuickActions />
        <Treatments />
        <Explore />
        <AiValue />
        <LowerWorld>
          <Journey />
          <Records />
          <Concierge />
          <Dentists />
          <Trust />
        </LowerWorld>
        <ComingSoon />
      </main>
      <Footer />
      <AssistantPanel />
    </DiscoveryProvider>
  );
}
