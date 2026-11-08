import { Home } from "@/components/clinic/home/Home";

/** Client view rendered inside the clinic shell; opted out of instant-navigation validation like its layout. */
export const instant = false;

export default function ClinicHomePage() {
  return <Home />;
}
