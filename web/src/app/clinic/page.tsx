"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChooseDemo } from "@/components/clinic/Shell";
import { useDemoUser } from "@/lib/useDemoUser";

/** FMD Clinic's entry: clinic people go straight to their clinic; anyone else picks a demo account first. */
export default function ClinicEntry() {
  const { user } = useDemoUser();
  const router = useRouter();
  const clinicId = user?.clinicId;
  useEffect(() => {
    if (clinicId) router.replace(`/clinic/${clinicId}`);
  }, [clinicId, router]);
  if (user === undefined || clinicId) return <div className="min-h-dvh" aria-busy />;
  return <ChooseDemo next="/clinic" />;
}
