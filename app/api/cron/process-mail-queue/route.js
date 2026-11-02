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
