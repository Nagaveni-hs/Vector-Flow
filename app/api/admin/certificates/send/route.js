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
// Returns at once with the count, so the admin page does not wait
// for mails to go out.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.certificateIds) ? body.certificateIds : [];
  let queued = 0;
  let skipped = 0;
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
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: { status: "QUEUED", sendTicked: true, mailError: null },
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
    queued += 1;
  }
  return ok({ queued, skipped });
}
