import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create an account · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy />}>
      <Fresh>
        <RegisterForm />
      </Fresh>
    </Suspense>
  );
}
