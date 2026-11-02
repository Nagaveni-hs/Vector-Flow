import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only, one certificate at a time. Only a FAILED
// certificate can be retried. It goes back to QUEUED with a new
// QUEUED mail row, so the next queue run tries it again. It does
// not send the mail itself.
export async function POST(request, { params }) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const certificate = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: { registration: true, event: true },
  });
  if (!certificate) return fail("CERTIFICATE_NOT_FOUND", 404);
  if (certificate.status !== "FAILED") return fail("CERTIFICATE_NOT_FAILED", 400);
  await prisma.certificate.update({
    where: { id: certificate.id },
    data: { status: "QUEUED", mailError: null },
  });
  await prisma.mailLog.create({
    data: {
      eventId: certificate.eventId,
      userId: certificate.userId,
      certificateId: certificate.id,
      toEmail: certificate.registration.email,
      type: "CERTIFICATE",
      subject: `Your certificate: ${certificate.event.title} - Vector Flow`,
      status: "QUEUED",
    },
  });
  return ok({ queued: true });
}
