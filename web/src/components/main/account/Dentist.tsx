"use client";

import { ArrowLeft, BadgeCheck, CircleAlert, Check, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Chips, IconButton, Panel, Tag, type Tone } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { useRun } from "@/components/auth/AuthForms";
import { Notice } from "@/components/Page";
import { LANGUAGES, SERVICES, SPECIALTIES } from "@/lib/catalog";
import { DISTRICTS } from "@/lib/districts";
import { account, initials, type DentistProfile, type Me } from "@/lib/fmd";
import { authChanged, useRequireMe } from "@/lib/me";
import {
  drName,
  getDocument,
  getPublicProfile,
  LIMITS,
  savePublicProfile,
  submitDocument,
  type PublicProfile,
  type VerificationDoc,
} from "@/sample/dentist";

type Status = DentistProfile["verification_status"];

/** What each verification state means, in words a dentist understands. Shared with the Account page card. */
export const STATUS: Record<Status, { tag: string; tone: Tone; text: (council: string) => string }> = {
  unverified: { tag: "Not verified yet", tone: "warn", text: () => "FMD hasn't checked these details yet. Until it does, patients see “Registration not yet verified by FMD”." },
  pending: { tag: "Being checked", tone: "accent", text: (c) => `FMD is checking your registration with ${c}.` },
  verified: { tag: "Verified", tone: "ok", text: (c) => `FMD checked your registration with ${c}.` },
  rejected: { tag: "Couldn't verify", tone: "bad", text: () => "FMD couldn't verify these details. Check them and save again." },
};

const COUNCILS = ["Dental Council of India", ...Object.keys(DISTRICTS).map((s) => `${s} State Dental Council`)];

const submit = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault();
  fn();
};
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** /account/dentist */
export function DentistProfilePage() {
  const me = useRequireMe();
  if (!me) return <div className="app-panel h-40 animate-pulse" aria-busy />;
  return (
    <div className="grid gap-5">
      <Link href="/account" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Account
      </Link>
      <div>
        <h1 className="text-[24px] font-medium text-ink">Dentist profile</h1>
        <p className="mt-1 max-w-[680px] text-[14.5px] text-ink-3">
          Patients see your public profile when they search FMD. FMD checks your registration before your profile shows as verified.
        </p>
      </div>
      <Registration me={me} />
      <DemoParts me={me} />
    </div>
  );
}

export function Section({ title, tag, text, children }: { title: string; tag?: ReactNode; text?: ReactNode; children: ReactNode }) {
  return (
    <Panel as="section" className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-medium text-ink">{title}</h2>
        {tag}
      </div>
      {text && <div className="-mt-1 text-[14.5px] text-ink-2">{text}</div>}
      {children}
    </Panel>
  );
}

const demoTag = <Tag tone="muted">Demo · saved in this browser</Tag>;

/* ---------------- registration (FastAPI /me/dentist-profile) ---------------- */

function Registration({ me }: { me: Me }) {
  const p = me.dentist_profile;
  const { busy, err, run } = useRun();
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    council: p?.council ?? "",
    registration_no: p?.registration_no ?? "",
    qualifications: p?.qualifications ?? "",
    specialisation: p?.specialisation ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => (setSaved(false), setF((x) => ({ ...x, [k]: e.target.value })));
  const resets = p && p.verification_status !== "unverified" && (f.council.trim() !== p.council || f.registration_no.trim() !== p.registration_no);

  const save = () =>
    run(async () => {
      await account.saveDentistProfile({
        council: f.council.trim(),
        registration_no: f.registration_no.trim(),
        qualifications: f.qualifications.trim() || null,
        specialisation: f.specialisation.trim() || null,
      });
      authChanged();
      setSaved(true);
    });

  return (
    <Section
      title="Registration"
      tag={p ? <Tag tone={STATUS[p.verification_status].tone}>{STATUS[p.verification_status].tag}</Tag> : <Tag tone="muted">Not added</Tag>}
      text={p ? STATUS[p.verification_status].text(p.council) : "Add your dental council registration so FMD can verify you."}
    >
      <form onSubmit={submit(save)} className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        {saved && <Notice kind="success">Registration saved.</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dental council">
            <input className={fieldCls} list="fmd-councils" value={f.council} onChange={set("council")} minLength={2} maxLength={100} required />
          </Field>
          <Field label="Registration number">
            <input className={fieldCls} value={f.registration_no} onChange={set("registration_no")} maxLength={50} autoComplete="off" required />
          </Field>
          <Field label="Qualifications (optional)">
            <input className={fieldCls} value={f.qualifications} onChange={set("qualifications")} maxLength={200} placeholder="BDS, MDS (Endodontics)" />
          </Field>
          <Field label="Specialisation (optional)">
            <input className={fieldCls} list="fmd-specialties" value={f.specialisation} onChange={set("specialisation")} maxLength={100} />
          </Field>
        </div>
        <datalist id="fmd-councils">
          {COUNCILS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="fmd-specialties">
          {SPECIALTIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {resets && <Notice kind="info">Changing the council or registration number sends your registration back for checking.</Notice>}
        <div>
          <Button type="submit" disabled={busy || f.council.trim().length < 2 || !f.registration_no.trim()}>
            {busy ? "Saving…" : p ? "Save changes" : "Save registration"}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ---------------- demo: proof document and public profile ---------------- */

function DemoParts({ me }: { me: Me }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [doc, setDoc] = useState<VerificationDoc | null | undefined>(undefined);
  useEffect(() => {
    getPublicProfile(me.id).then(setProfile);
    getDocument(me.id).then(setDoc);
  }, [me.id]);
  if (!profile || doc === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  return (
    <>
      <ProofSection me={me} doc={doc} onDoc={setDoc} />
      <PublicSection me={me} initial={profile} />
    </>
  );
}

function ProofSection({ me, doc, onDoc }: { me: Me; doc: VerificationDoc | null; onDoc: (d: VerificationDoc) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const inputId = useId();
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    try {
      onDoc(await submitDocument(me.id, file));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Section title="Registration proof" tag={demoTag} text="Upload your registration certificate (PDF, JPG or PNG, up to 5 MB). Only FMD's verification team sees it.">
      {err && <Notice kind="error">{err}</Notice>}
      {doc && (
        <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
          <Check className="size-4 text-[var(--tone-ok)]" strokeWidth={2} />
          <span className="break-all font-medium text-ink">{doc.name}</span>· {kb(doc.size)} · submitted{" "}
          {new Date(doc.uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}
      <div>
        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-[var(--button-secondary)] px-4 text-[13px] font-semibold text-ink hover:border-line-strong focus-within:border-[var(--accent)]"
        >
          {doc ? "Replace file" : "Upload certificate"}
        </label>
        <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      </div>
    </Section>
  );
}

/** Downscale a photo to a small JPEG before it is stored, as the real upload will (PDR §10 image compression). */
async function shrink(file: File, size = 256) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, size / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

const num = (v: string) => (v === "" ? null : Number(v));
const str = (n: number | null) => (n === null ? "" : String(n));

function PublicSection({ me, initial }: { me: Me; initial: PublicProfile }) {
  const [p, setP] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const photoId = useId();
  const edit = (patch: Partial<PublicProfile>) => (setSaved(false), setP((x) => ({ ...x, ...patch })));
  const setClinic = (i: number, k: "name" | "area" | "city", v: string) => edit({ clinics: p.clinics.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return setErr("Choose a JPG or PNG photo under 10 MB.");
    try {
      edit({ photo: await shrink(file) });
    } catch {
      setErr("Couldn't read that photo. Try a JPG or PNG.");
    }
  };
  const save = async () => {
    setErr(null);
    try {
      setP(await savePublicProfile(me.id, p));
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Section title="Public profile" tag={demoTag} text="What patients see when they find you on FMD. Keep it factual; no guarantees or claims you can't back up.">
      <form onSubmit={submit(save)} className="grid gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={me.full_name} photo={p.photo} size={64} />
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={photoId}
              className="inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-[var(--button-secondary)] px-4 text-[13px] font-semibold text-ink hover:border-line-strong focus-within:border-[var(--accent)]"
            >
              {p.photo ? "Change photo" : "Add photo"}
            </label>
            <input id={photoId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => (pickPhoto(e.target.files?.[0]), (e.target.value = ""))} />
            {p.photo && (
              <Button variant="secondary" size="sm" onClick={() => edit({ photo: null })}>
                Remove photo
              </Button>
            )}
          </div>
        </div>

        <Field label="About you" hint={`${p.about.length}/${LIMITS.about}`}>
          <textarea
            className={`${fieldCls} h-28 resize-y py-2.5`}
            value={p.about}
            onChange={(e) => edit({ about: e.target.value })}
            maxLength={LIMITS.about}
            placeholder="Your approach, the treatments you focus on, and who you enjoy treating."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Years of experience">
            <input className={fieldCls} type="number" inputMode="numeric" min={0} max={LIMITS.years} value={str(p.years_experience)} onChange={(e) => edit({ years_experience: num(e.target.value) })} />
          </Field>
          <Field label="Consultation fee from (₹)">
            <input className={fieldCls} type="number" inputMode="numeric" min={0} max={LIMITS.fee} value={str(p.fee_min)} onChange={(e) => edit({ fee_min: num(e.target.value) })} />
          </Field>
          <Field label="Consultation fee to (₹)">
            <input className={fieldCls} type="number" inputMode="numeric" min={0} max={LIMITS.fee} value={str(p.fee_max)} onChange={(e) => edit({ fee_max: num(e.target.value) })} />
          </Field>
        </div>

        <Chips label="Languages you consult in" options={LANGUAGES} value={p.languages} onChange={(languages) => edit({ languages })} />
        <Chips label="Treatments you offer" options={SERVICES} value={p.services} onChange={(services) => edit({ services })} />

        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-[13.5px] text-ink-3">Clinics where you practise</legend>
          {p.clinics.map((c, i) => (
            <div key={i} className="grid items-end gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Clinic name">
                <input className={fieldCls} value={c.name} onChange={(e) => setClinic(i, "name", e.target.value)} maxLength={120} />
              </Field>
              <Field label="Area">
                <input className={fieldCls} value={c.area} onChange={(e) => setClinic(i, "area", e.target.value)} maxLength={80} />
              </Field>
              <Field label="City">
                <input className={fieldCls} value={c.city} onChange={(e) => setClinic(i, "city", e.target.value)} maxLength={80} />
              </Field>
              <IconButton label={`Remove ${c.name || "this clinic"}`} onClick={() => edit({ clinics: p.clinics.filter((_, j) => j !== i) })}>
                <X className="size-4" strokeWidth={1.5} />
              </IconButton>
            </div>
          ))}
          <div>
            <Button variant="secondary" size="sm" disabled={p.clinics.length >= LIMITS.clinics} onClick={() => edit({ clinics: [...p.clinics, { name: "", area: "", city: "" }] })}>
              <Plus className="size-4" strokeWidth={1.75} /> Add clinic
            </Button>
          </div>
        </fieldset>

        {err && <Notice kind="error">{err}</Notice>}
        {saved && <Notice kind="success">Public profile saved in this browser.</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save public profile</Button>
          <Button variant="secondary" onClick={() => setPreview(true)}>
            Preview as a patient
          </Button>
        </div>
      </form>
      {preview && (
        <Sheet title="How patients see you" onClose={() => setPreview(false)} wide>
          <PatientView me={me} p={p} />
        </Sheet>
      )}
    </Section>
  );
}

function Avatar({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  return photo ? (
    <Image src={photo} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials(name)}
    </span>
  );
}

/** The profile as a patient sees it. Verified only when FMD checked it, and it says what was checked (PDR §4.4, §4.8). */
function PatientView({ me, p }: { me: Me; p: PublicProfile }) {
  const reg = me.dentist_profile;
  const verified = reg?.verification_status === "verified";
  const sub = [reg?.specialisation, p.years_experience !== null ? `${p.years_experience} years of experience` : null].filter(Boolean).join(" · ");
  const rows: [string, ReactNode][] = [
    ["Qualifications", reg?.qualifications],
    ["Languages", p.languages.join(", ")],
    ["Consultation fee", p.fee_min !== null && p.fee_max !== null ? (p.fee_min === p.fee_max ? rupees(p.fee_min) : `${rupees(p.fee_min)} – ${rupees(p.fee_max)}`) : null],
    [
      "Clinics",
      p.clinics.length ? (
        <ul className="grid gap-0.5">
          {p.clinics.map((c, i) => (
            <li key={i}>
              {c.name} · {[c.area, c.city].filter(Boolean).join(", ")}
            </li>
          ))}
        </ul>
      ) : null,
    ],
  ];
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <Avatar name={me.full_name} photo={p.photo} size={72} />
        <div className="min-w-0">
          <p className="text-[19px] font-medium text-ink">{drName(me.full_name)}</p>
          {sub && <p className="text-[14px] text-ink-3">{sub}</p>}
          <p className={`mt-1 flex items-center gap-1.5 text-[13.5px] ${verified ? "text-[var(--tone-ok)]" : "text-ink-3"}`}>
            {verified ? <BadgeCheck className="size-4 shrink-0" strokeWidth={1.75} /> : <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} />}
            {verified ? `Registration checked by FMD with ${reg!.council}` : "Registration not yet verified by FMD"}
          </p>
        </div>
      </div>
      {p.about && <p className="whitespace-pre-line text-[14.5px] text-ink-2">{p.about}</p>}
      <dl className="grid gap-2.5 text-[14px]">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid gap-0.5 sm:grid-cols-[160px_1fr]">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
      </dl>
      {p.services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.services.map((s) => (
            <Tag key={s} tone="muted">
              {s}
            </Tag>
          ))}
        </div>
      )}
      <p className="text-[12.5px] text-ink-3">Demo preview: search and profile pages come later. Booking buttons appear here once clinics connect their calendars.</p>
    </div>
  );
}
