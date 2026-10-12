import { requireAuth } from "@/server/auth";
import { uploadPatientFile } from "@/server/clinic/router";
import { bad, handler } from "@/server/http";

export const POST = handler<RouteContext<"/api/clinic/[clinicId]/patients-upload/[patientId]">>(async (req, ctx) => {
  const { clinicId, patientId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw bad("Choose a file.");
  return Response.json(uploadPatientFile(requireAuth(req), clinicId, patientId, new Uint8Array(await file.arrayBuffer()), form?.get("title")), { status: 201 });
});
