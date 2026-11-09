import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/json";

// POST, admin only. Body: { certificateIds: [id, ...] }.
// This route ticks certificates for sending, and it creates a QUEUED
// mail row for each one. It does NOT send any mail itself. The queue
// worker, the cron mail-queue route, sends the mails in batches.
// Only certificates that are currently UPLOADED, or FAILED from a
// previous try, can be queued. Already sent or already queued
// certificates are counted as skipped, never queued twice.
// P2 (M9): the status change and the mail-row creation happen in one
// Prisma transaction, claimed atomically, so a certificate can never
// end up QUEUED with no mail row behind it. If the transaction fails,
// the certificate stays UPLOADED/FAILED and can be queued again.
// Returns at once with the count, so the admin page does not wait
// for mails to go out.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.certificateIds) ? body.certificateIds : [];
  let queued = 0;
  let skipped = 0;
  const refused = [];
  for (const id of ids) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: String(id) },
      include: { registration: true, event: true },
    });
    if (!certificate) {
      skipped += 1;
      continue;
    }
    if (certificate.status !== "UPLOADED" && certificate.status !== "FAILED") {
      skipped += 1;
      continue;
    }
    // M3: re-check that the student is still REGISTERED and PRESENT
    // before queueing. Attendance can change and a registration can
    // be cancelled after upload, and neither must be mailed a
    // certificate. Refused rows are listed so the admin can see why.
    if (
      !certificate.registration ||
      certificate.registration.status !== "REGISTERED" ||
      certificate.registration.attendance !== "PRESENT"
    ) {
      skipped += 1;
      refused.push({ certificateId: certificate.id, reason: "NOT_ELIGIBLE_FOR_CERTIFICATE" });
      continue;
    }
    // Claim the certificate and create its mail row together. The
    // conditional update is the claim: if another admin (or a retry)
    // already queued this certificate, it updates 0 rows and we skip
    // it instead of creating a second mail row for the same send.
    try {
      const claimed = await prisma.$transaction(async (tx) => {
        const updated = await tx.certificate.updateMany({
          where: { id: certificate.id, status: { in: ["UPLOADED", "FAILED"] } },
          data: { status: "QUEUED", sendTicked: true, mailError: null },
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
      if (claimed) queued += 1;
      else skipped += 1;
    } catch {
      // Transaction failed: nothing was written, so the certificate
      // is still UPLOADED/FAILED and the admin can queue it again.
      skipped += 1;
    }
  }
  return ok({ queued, skipped, refused });
}
