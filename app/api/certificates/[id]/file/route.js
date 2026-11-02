import { prisma } from "@/lib/db";
import { checkDownloadToken } from "@/lib/download";
import { fail } from "@/lib/json";

// GET, no login cookie needed, because the signed token is the check.
// The token must match this certificate and must not be expired.
// On success the browser is sent to the stored file. On failure,
// no file address is revealed at all.
export async function GET(request, { params }) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!checkDownloadToken(token, params.id)) return fail("FORBIDDEN", 403);
  const certificate = await prisma.certificate.findUnique({ where: { id: params.id } });
  if (!certificate || certificate.status !== "SENT") return fail("FORBIDDEN", 403);
  return Response.redirect(certificate.fileUrl, 302);
}
