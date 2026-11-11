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
//
// M1: this worker claims its batch before sending. Two overlapping
// runs (a 5-minute schedule plus a slow batch, or a manual
// re-trigger) must never mail the same certificate twice. The claim
// is a conditional update to SENDING that only matches a row still
// QUEUED, so exactly one run wins each row; the run then re-fetches
// only the rows it claimed and sends those. The claim is one
// conditional update per row, not a single bulk updateMany: a bulk
// claim cannot say WHICH rows this run won when two runs read the
// same ids before either claims, and the re-fetch would then return
// the other run's rows too. Claiming per row (at most 20 tiny
// updates) closes that gap completely. Every status update after
// the claim is conditional too: the certificate only moves if it is
// still QUEUED, and the mail row only moves if it is still SENDING.
// A hold placed while a mail is in flight voids the row (see the
// hold route) and leaves the certificate HELD, so neither update
// can resurrect it to SENT or overwrite the void.
export async function GET(request) {
  if (!checkCronSecret(request)) return fail("FORBIDDEN", 403);
  const queuedIds = await prisma.mailLog.findMany({
    where: { type: "CERTIFICATE", status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true },
  });
  const ids = queuedIds.map((row) => row.id);
  // Claim, one row at a time: the conditional update only matches a
  // row still QUEUED, so a second run overlapping this one wins 0
  // of the same rows. Only ids whose update changed 1 row belong
  // to this run.
  const claimedIds = [];
  for (const id of ids) {
    const claimed = await prisma.mailLog.updateMany({
      where: { id, status: "QUEUED" },
      data: { status: "SENDING" },
    });
    if (claimed.count === 1) claimedIds.push(id);
  }
  // Only the rows this run claimed. Rows another run won, or a hold
  // voided between the claim and this read, are not SENDING here
  // and are never touched below.
  const queued = await prisma.mailLog.findMany({
    where: { id: { in: claimedIds }, status: "SENDING" },
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  let failed = 0;
  for (const row of queued) {
    if (!row.certificateId) {
      await prisma.mailLog.updateMany({
        where: { id: row.id, status: "SENDING" },
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
      await prisma.mailLog.updateMany({
        where: { id: row.id, status: "SENDING" },
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
    // The park is conditional on the row still being SENDING: if a
    // hold voided it first, the void stands.
    if (certificate.status !== "QUEUED") {
      await prisma.mailLog.updateMany({
        where: { id: row.id, status: "SENDING" },
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
    // can see it and retry it only after fixing the cause. Both
    // updates are conditional (certificate still QUEUED, row still
    // SENDING), so a hold placed just before this check is not
    // overwritten.
    if (
      !certificate.registration ||
      certificate.registration.status !== "REGISTERED" ||
      certificate.registration.attendance !== "PRESENT"
    ) {
      await prisma.certificate.updateMany({
        where: { id: certificate.id, status: "QUEUED" },
        data: { status: "FAILED", mailError: "NOT_ELIGIBLE_FOR_CERTIFICATE" },
      });
      await prisma.mailLog.updateMany({
        where: { id: row.id, status: "SENDING" },
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
      // Conditional on still QUEUED / still SENDING: a hold placed
      // during sendMail leaves the certificate HELD and the row
      // voided, and neither is overwritten here. The mail itself
      // did go out, so it still counts as sent below.
      await prisma.certificate.updateMany({
        where: { id: certificate.id, status: "QUEUED" },
        data: {
          status: "SENT",
          emailedAt: new Date(),
          issuedAt: certificate.issuedAt || new Date(),
          mailError: null,
        },
      });
      await prisma.mailLog.updateMany({
        where: { id: row.id, status: "SENDING" },
        data: { status: "SENT", error: null, sentAt: new Date() },
      });
      sent += 1;
    } else {
      // Same conditional guard on the failure path: a row voided by
      // a hold mid-flight stays voided, it does not become FAILED
      // with the mail error, and a held certificate stays HELD.
      await prisma.certificate.updateMany({
        where: { id: certificate.id, status: "QUEUED" },
        data: { status: "FAILED", mailError: result.error || "MAIL_FAILED" },
      });
      await prisma.mailLog.updateMany({
        where: { id: row.id, status: "SENDING" },
        data: { status: "FAILED", error: result.error || "MAIL_FAILED" },
      });
      failed += 1;
    }
  }
  return ok({ processed: queued.length, sent, failed });
}
