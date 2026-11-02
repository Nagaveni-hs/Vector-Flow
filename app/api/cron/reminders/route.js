import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/json";
import { buildReminderMail, sendMail } from "@/lib/mail";
import { checkCronSecret } from "@/lib/cron";

// GET, called hourly by the external scheduler (cron-job.org, deferred
// until deploy). Events starting in 24 to 25 hours only, registered
// students only, and only registrations with no reminderSentAt.
// reminderSentAt is set on success only, so a failed mail is retried
// on the next run and a sent mail is never resent.
export async function GET(request) {
  if (!checkCronSecret(request)) return fail("FORBIDDEN", 403);
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      startAt: { gte: windowStart, lt: windowEnd },
    },
    include: {
      registrations: {
        where: { status: "REGISTERED", reminderSentAt: null },
      },
    },
  });
  let sent = 0;
  let failed = 0;
  for (const event of events) {
    for (const registration of event.registrations) {
      const mail = buildReminderMail(event, registration);
      const result = await sendMail({
        to: registration.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
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
      if (result.sent) {
        await prisma.registration.update({
          where: { id: registration.id },
          data: { reminderSentAt: new Date() },
        });
        sent += 1;
      } else {
        failed += 1;
      }
    }
  }
  return ok({ sent, failed });
}
