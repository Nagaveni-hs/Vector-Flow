import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/json";
import { buildReminderMail, sendMail } from "@/lib/mail";
import { checkCronSecret } from "@/lib/cron";

// GET, called hourly by the external scheduler (cron-job.org, deferred
// until deploy). Registered students only, and only registrations with
// no reminderSentAt.
// P2 (M10) catch-up window: an event starting within the next 24 hours
// (startAt > now AND startAt <= now + 24h). The old window was only
// "starts in 24 to 25 hours", so if the scheduler missed that one
// hour, the reminder was lost forever. Now a late run still catches
// the event, as long as it has not started yet. Events that already
// started never get a reminder.
// At-most-once: reminderSentAt is claimed atomically (updateMany on
// reminderSentAt: null) BEFORE the mail is sent, so two runs racing
// each other cannot both send it. If the mail then fails, the claim
// is released (reminderSentAt set back to null) so the next run
// retries it; a sent mail is never resent.
export async function GET(request) {
  if (!checkCronSecret(request)) return fail("FORBIDDEN", 403);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      // m5 (minors): an event flipped to ONGOING before its start
      // still gets its 24h reminder; the old PUBLISHED-only filter
      // dropped it.
      status: { in: ["PUBLISHED", "ONGOING"] },
      startAt: { gt: now, lte: windowEnd },
    },
    include: {
      registrations: {
        // m5 (minors): only registrations whose payment is settled
        // are reminded. PENDING_REVIEW and REJECTED students are
        // not verified to attend, so they get no reminder.
        // PaymentStatus in the schema: NOT_REQUIRED, PENDING_REVIEW,
        // VERIFIED, REJECTED.
        where: {
          status: "REGISTERED",
          reminderSentAt: null,
          paymentStatus: { in: ["VERIFIED", "NOT_REQUIRED"] },
        },
      },
    },
  });
  let sent = 0;
  let failed = 0;
  for (const event of events) {
    for (const registration of event.registrations) {
      // Claim this reminder first: only the run that wins the claim
      // sends the mail. A cancelled registration never reaches here
      // (the query above only takes REGISTERED rows).
      const claimed = await prisma.registration.updateMany({
        where: {
          id: registration.id,
          reminderSentAt: null,
          status: "REGISTERED",
          // m5 (minors): the claim repeats the payment filter, so a
          // payment that flipped to REJECTED after the read cannot
          // be claimed and reminded by this run.
          paymentStatus: { in: ["VERIFIED", "NOT_REQUIRED"] },
        },
        data: { reminderSentAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      const mail = buildReminderMail(event, registration);
      const result = await sendMail({
        to: registration.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      // m4 (minors): the log write has its own try/catch, as the
      // announce/register routes already do. The reminder mail was
      // already sent (or failed on its own terms) and its claim is
      // already recorded; a log failure must not report the run as
      // failed or lose the sent/failed count.
      try {
        await prisma.mailLog.create({
          data: {
            eventId: event.id,
            userId: registration.userId,
            toEmail: registration.email,
            type: "REMINDER_24H",
            subject: mail.subject,
            status: result.sent ? "SENT" : "FAILED",
            error: result.sent ? null : result.error,
            sentAt: result.sent ? new Date() : null,
          },
        });
      } catch {
        // Only the log row is lost; the reminder itself stands.
      }
      if (result.sent) {
        sent += 1;
      } else {
        // Release the claim so the next hourly run retries the mail.
        await prisma.registration.updateMany({
          where: { id: registration.id },
          data: { reminderSentAt: null },
        });
        failed += 1;
      }
    }
  }
  return ok({ sent, failed });
}
