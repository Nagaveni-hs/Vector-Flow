import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/json";
import { buildCertificateMail, sendMail } from "@/lib/mail";
import { checkCronSecret } from "@/lib/cron";

// GET, cron only, protected by CRON_SECRET. Sprint 4 replaces the
// Sprint 2 empty stub with a real worker. Each call takes at most
// 20 QUEUED certificate mails, oldest first, and sends them one by
// one, in order. On success: the certificate becomes SENT, emailedAt
// is set, and its mail row becomes SENT. On failure: the certificate
// becomes FAILED with the error saved, its mail row becomes FAILED,
// and the worker keeps going with the next mail. One failure never
// blocks the rest of the batch. Mails that are already SENT or
// FAILED are never retried by this route; use the admin Retry
// button for a failed certificate, which queues it again.
// The scheduler should call this route every 5 minutes, with the
// x-cron-secret header, after the site is deployed. Locally, it can
// be called by hand with the same header for testing.
export async function GET(request) {
  if (!checkCronSecret(request)) return fail("FORBIDDEN", 403);
  const queued = await prisma.mailLog.findMany({
    where: { type: "CERTIFICATE", status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let sent = 0;
  let failed = 0;
  for (const row of queued) {
    if (!row.certificateId) {
      await prisma.mailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: "NO_CERTIFICATE" },
      });
      failed += 1;
      continue;
    }
    const certificate = await prisma.certificate.findUnique({
      where: { id: row.certificateId },
      include: { registration: true, event: true },
    });
    if (!certificate) {
      await prisma.mailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: "CERTIFICATE_NOT_FOUND" },
      });
      failed += 1;
      continue;
    }
    // M2: never send a row whose certificate is not QUEUED at send
    // time. A held certificate (or one already sent another way)
    // must not be mailed just because its old QUEUED row still
    // exists. The row is parked as FAILED so it is not retried, and
    // the certificate itself is left alone (a HELD one stays HELD).
    if (certificate.status !== "QUEUED") {
      await prisma.mailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: "CERTIFICATE_NOT_QUEUED" },
      });
      failed += 1;
      continue;
    }
    // M3: re-check that the student is still REGISTERED and PRESENT
    // at send time. Attendance can change and a registration can be
    // cancelled after the certificate was queued, and neither must
    // be mailed a certificate. The row is parked as FAILED and the
    // certificate goes back to FAILED with the reason, so the admin
    // can see it and retry it only after fixing the cause.
    if (
      !certificate.registration ||
      certificate.registration.status !== "REGISTERED" ||
      certificate.registration.attendance !== "PRESENT"
    ) {
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: "FAILED", mailError: "NOT_ELIGIBLE_FOR_CERTIFICATE" },
      });
      await prisma.mailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: "NOT_ELIGIBLE_FOR_CERTIFICATE" },
      });
      failed += 1;
      continue;
    }
    const mail = buildCertificateMail(certificate.event, certificate.registration);
    const result = await sendMail({
      to: row.toEmail,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: [
        {
          filename: certificate.fileName || "certificate.pdf",
          path: certificate.fileUrl,
        },
      ],
    });
    if (result.sent) {
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: {
          status: "SENT",
          emailedAt: new Date(),
          issuedAt: certificate.issuedAt || new Date(),
          mailError: null,
        },
      });
      await prisma.mailLog.update({
        where: { id: row.id },
        data: { status: "SENT", error: null, sentAt: new Date() },
      });
      sent += 1;
    } else {
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: "FAILED", mailError: result.error || "MAIL_FAILED" },
      });
      await prisma.mailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: result.error || "MAIL_FAILED" },
      });
      failed += 1;
    }
  }
  return ok({ processed: queued.length, sent, failed });
}
