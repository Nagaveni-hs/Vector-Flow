import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { makeDownloadToken, downloadLinkExpiry } from "@/lib/download";

// GET, owner or admin only. Returns a short-lived signed download
// link, valid for 10 minutes, and its expiry time. It never returns
// the stored file address directly, and it only works when the
// certificate has been sent. Uploaded, held, queued, or failed
// certificates get no link here.
export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const certificate = await prisma.certificate.findUnique({ where: { id: params.id } });
  if (!certificate) return fail("CERTIFICATE_NOT_FOUND", 404);
  // M5: when the requester is not the owner, the admin check re-reads
  // the role from the DB instead of trusting the role baked into the
  // JWT at sign-in, so a demoted admin loses access at once and a
  // newly promoted admin is not locked out until their next sign-in.
  if (certificate.userId !== session.userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });
    if (!dbUser) return fail("NOT_SIGNED_IN", 401);
    if (dbUser.role !== "ADMIN") return fail("FORBIDDEN", 403);
  }
  if (certificate.status !== "SENT") return fail("CERTIFICATE_NOT_SENT", 400);
  const token = makeDownloadToken(certificate.id);
  return ok({
    downloadUrl: `/api/certificates/${certificate.id}/file?token=${token}`,
    expiresAt: downloadLinkExpiry(),
  });
}
