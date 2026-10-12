"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

/** Accept a staff invitation. The token comes from the link the owner shared. */
export default function JoinClinic() {
  const me = useMe();
  const router = useRouter();
  const [err, setErr] = useState("");
  const token = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") ?? "";
  const accept = async () => {
    try {
      const { clinicId } = await api<{ clinicId: string }>("/api/clinic/join", { method: "POST", body: { token } });
      router.push(`/clinic/${clinicId}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Page narrow>
      <p className="eyebrow">FMD Clinic OS</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink">Join your clinic</h1>
      <div className="mt-6 space-y-4">
        {me === null && (
          <Notice kind="info">
            <Link href={`/signin?next=${encodeURIComponent(`/clinic/join?token=${token}`)}`} className="underline">Sign in</Link> with the email address the invitation was sent to.
          </Notice>
        )}
        {me && (
          <button onClick={accept} className="btn-primary h-11 px-6 text-[13.5px]">
            Accept invitation
          </button>
        )}
        {err && <Notice kind="error">{err}</Notice>}
      </div>
    </Page>
  );
}
