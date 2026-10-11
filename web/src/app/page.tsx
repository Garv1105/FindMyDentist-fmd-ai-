import { DiscoveryProvider } from "@/components/discovery";
import { AssistantPanel } from "@/components/hero/Assistant";
import Hero from "@/components/hero/Hero";
import Navbar from "@/components/nav/Navbar";
import AiValue from "@/components/sections/AiValue";
import Concierge from "@/components/sections/Concierge";
import Dentists from "@/components/sections/Dentists";
import Explore from "@/components/sections/Explore";
import Footer from "@/components/sections/Footer";
import Journey from "@/components/sections/Journey";
import QuickActions from "@/components/sections/QuickActions";
import Records from "@/components/sections/Records";
import Treatments from "@/components/sections/Treatments";
import Trust from "@/components/sections/Trust";

export default function Home() {
  return (
    <DiscoveryProvider>
      <Navbar />
      <main>
        <Hero />
        <QuickActions />
        <Dentists />
        <Treatments />
        <AiValue />
        <Journey />
        <Records />
        <Explore />
        <Concierge />
        <Trust />
      </main>
      <Footer />
      <AssistantPanel />
    </DiscoveryProvider>
  );
}
