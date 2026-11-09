import { requireAuth } from "@/server/auth";
import { bad, handler } from "@/server/http";
import { listRecords, uploadRecord } from "@/server/records";

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams;
  return Response.json(listRecords(requireAuth(req), { type: q.get("type") ?? undefined, clinic: q.get("clinic") ?? undefined, episode: q.get("episode") ?? undefined }));
});

/** multipart/form-data: "file" + metadata fields. Size, type and quota are enforced server-side. */
export const POST = handler(async (req) => {
  const a = requireAuth(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw bad("Choose a file to upload.");
  const meta = Object.fromEntries([...form.entries()].filter(([k, v]) => k !== "file" && typeof v === "string"));
  return Response.json(uploadRecord(a, new Uint8Array(await file.arrayBuffer()), meta), { status: 201 });
});
