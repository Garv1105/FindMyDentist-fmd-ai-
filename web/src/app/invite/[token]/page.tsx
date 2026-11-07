"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Notice, Page } from "@/components/Page";
import { accountChanged, api, CLINIC_ROLE_LABELS, useMe, type ApiClinicRole, type Me } from "@/lib/me";

type Preview = { clinic_name: string; clinic_city: string; role: ApiClinicRole; email_hint: string; expires_at: string };

/**
 * A clinic invitation (the link FastAPI emails: {CLINIC_OS_URL}/invite/{token}). The invitation is for one email
 * address; accepting it adds that email to the account if it has none verified yet.
 */
export default function InvitePage() {
  // the token comes from the URL, so this renders on request (Cache Components: dynamic data inside Suspense)
  return (
    <Suspense
      fallback={
        <Page narrow>
          <p className="text-[13px] text-ink-4">Loading…</p>
        </Page>
      }
    >
      <Invite />
    </Suspense>
  );
}

function Invite() {
  const { token } = useParams<{ token: string }>();
  const me = useMe();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Preview>(`/api/v1/invitations/${token}`)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [token]);

  const accept = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await api<{ clinic_id: string }>(`/api/v1/invitations/${token}/accept`, { method: "POST" });
      await accountChanged();
      const fresh = await api<{ user: Me | null }>("/api/me");
      const ws = fresh.user?.workspaces.find((w) => w.clinic_id === r.clinic_id)?.workspace_id;
      router.push(ws ? `/clinic/${ws}` : "/clinic");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const back = encodeURIComponent(`/invite/${token}`);

  return (
    <Page narrow>
      <p className="eyebrow">Clinic invitation</p>
      <div className="glass mt-6 rounded-[28px] p-6 sm:p-8">
        {preview === undefined && <p className="text-[13px] text-ink-4">Loading…</p>}
        {preview === null && (
          <div className="space-y-3">
            <h1 className="text-[24px] font-light text-ink">This invitation can&apos;t be used</h1>
            <p className="text-[13.5px] text-ink-3">It has expired, was already used, or was withdrawn. Ask the clinic for a new invitation.</p>
          </div>
        )}
        {preview && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <span className="icon-tile size-12 shrink-0">
                <Building2 className="size-5" strokeWidth={1.4} />
              </span>
              <div>
                <h1 className="text-[24px] font-light leading-tight text-ink">{preview.clinic_name}</h1>
                <p className="mt-1 text-[13px] text-ink-3">
                  {preview.clinic_city} · invites you to join as <span className="text-ink">{CLINIC_ROLE_LABELS[preview.role]}</span>
                </p>
              </div>
            </div>
            <p className="text-[13px] text-ink-4">
              Sent to {preview.email_hint}. Valid until {new Date(preview.expires_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}.
            </p>
            {me === null && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/signin?next=${back}`} className="btn-primary h-11 text-[13.5px]">
                  Sign in to accept
                </Link>
                <Link href={`/signin?mode=signup&next=${back}`} className="btn-ghost h-11 text-[13.5px]">
                  Create an account
                </Link>
              </div>
            )}
            {me && (
              <>
                <p className="text-[12.5px] text-ink-4">
                  Accepting as {me.name}. If your account has no verified email yet, {preview.email_hint} becomes its email.
                </p>
                <button onClick={accept} disabled={busy} className="btn-primary h-11 w-full text-[13.5px] disabled:opacity-50">
                  {busy ? "Joining…" : `Join ${preview.clinic_name}`}
                </button>
              </>
            )}
            {err && <Notice kind="error">{err}</Notice>}
          </div>
        )}
      </div>
    </Page>
  );
}
