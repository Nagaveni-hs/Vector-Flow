import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only, one certificate at a time. Only a FAILED
// certificate can be retried. It goes back to QUEUED with a new
// QUEUED mail row, so the next queue run tries it again. It does
// not send the mail itself.
// P2 (M9): same transaction as the send route -- the status change
// and the mail-row creation happen together, claimed atomically, so
// a retried certificate can never end up QUEUED with no mail row.
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const certificate = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: { registration: true, event: true },
  });
  if (!certificate) return fail("CERTIFICATE_NOT_FOUND", 404);
  if (certificate.status !== "FAILED") return fail("CERTIFICATE_NOT_FAILED", 400);
  // M3: re-check that the student is still REGISTERED and PRESENT
  // before queueing again, same as the send route. A student marked
  // absent or cancelled after the failed send must not be mailed.
  if (
    !certificate.registration ||
    certificate.registration.status !== "REGISTERED" ||
    certificate.registration.attendance !== "PRESENT"
  ) {
    return fail("NOT_ELIGIBLE_FOR_CERTIFICATE", 400);
  }
  try {
    const claimed = await prisma.$transaction(async (tx) => {
      const updated = await tx.certificate.updateMany({
        where: { id: certificate.id, status: "FAILED" },
        data: { status: "QUEUED", mailError: null },
      });
      if (updated.count !== 1) return false;
      await tx.mailLog.create({
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
      return true;
    });
    if (!claimed) return fail("CERTIFICATE_NOT_FAILED", 400);
  } catch {
    return fail("INVALID_FILE", 400);
  }
  return ok({ queued: true });
}
