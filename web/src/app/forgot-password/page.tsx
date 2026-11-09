import type { Metadata } from "next";
import { Fresh } from "@/components/app/Fresh";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset password · FMD", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy />}>
      <Fresh>
        <ForgotPasswordForm />
      </Fresh>
    </Suspense>
  );
}
