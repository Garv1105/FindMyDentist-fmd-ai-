import type { Metadata } from "next";
import { DiscoveryProvider } from "@/components/discovery";
import { AssistantPanel } from "@/components/hero/Assistant";
import Hero from "@/components/hero/Hero";
import ModelPreloader from "@/components/ModelPreloader";
import Navbar from "@/components/nav/Navbar";
import AiFeatures from "@/components/sections/AiFeatures";
import ComingSoon from "@/components/sections/ComingSoon";
import Concierge from "@/components/sections/Concierge";
import Dentists from "@/components/sections/Dentists";
import Explore from "@/components/sections/Explore";
import Footer from "@/components/sections/Footer";
import Journey from "@/components/sections/Journey";
import LowerWorld from "@/components/sections/LowerWorld";
import Products from "@/components/sections/Products";
import Records from "@/components/sections/Records";
import Trust from "@/components/sections/Trust";
import Walkthrough from "@/components/sections/Walkthrough";

// the home page's own address (set here, not in the layout, so other pages don't inherit it)
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Homepage order (01–13) is fixed by the FMD homepage brief.
export default function Home() {
  return (
    <DiscoveryProvider>
      <ModelPreloader />
      <Navbar />
      <main>
        <Hero /> {/* 01 */}
        <LowerWorld>
          <AiFeatures /> {/* 03 */}
          <Walkthrough /> {/* 04 */}
          <Explore /> {/* 05 */}
          <Journey /> {/* 06 */}
          <Records /> {/* 07 Private Vault */}
          <Concierge /> {/* 08 FMD Edge */}
          <Dentists /> {/* 09 */}
          <Trust /> {/* 10 */}
          <Products /> {/* 11 */}
        </LowerWorld>
        <ComingSoon /> {/* 12 */}
      </main>
      <Footer /> {/* 13 */}
      <AssistantPanel />
    </DiscoveryProvider>
  );
}
