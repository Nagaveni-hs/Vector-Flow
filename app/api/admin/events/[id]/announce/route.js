import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { buildAnnouncementMail, sendMail, studentsGroupEmail } from "@/lib/mail";

// The admin edit page links with the event slug in this [id] position,
// while other admin routes use the event id, so accept either one.
async function findEvent(key) {
  const byId = await prisma.event.findUnique({ where: { id: key } });
  if (byId) return byId;
  return prisma.event.findUnique({ where: { slug: key } });
}

// GET: the exact preview the admin sees before sending. No mail is sent here.
export async function GET(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const event = await findEvent(params.id);
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const mail = buildAnnouncementMail(event);
  return ok({
    to: studentsGroupEmail(),
    subject: mail.subject,
    body: mail.text,
    alreadySent: Boolean(event.announcementSentAt),
    announcementSentAt: event.announcementSentAt,
  });
}

// POST: send the announcement once. Editing the event afterwards does not
// resend it, because the edit endpoint never touches announcementSentAt
// and this route refuses when it is already set.
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const event = await findEvent(params.id);
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  // M1: only a published or ongoing event may be announced to the
  // whole college. Announcing a draft (or cancelled) event mails
  // students about an event nobody can see or register for.
  if (event.status !== "PUBLISHED" && event.status !== "ONGOING") {
    return fail("EVENT_NOT_PUBLISHED", 400);
  }
  if (event.announcementSentAt) {
    return fail("ANNOUNCEMENT_ALREADY_SENT", 400);
  }
  // P1 (B7): claim the send atomically BEFORE sending the mail. The
  // old code checked the flag, sent the mail, then set the flag, so
  // two concurrent POSTs (two admins, or a retry racing the first)
  // both passed the check and the whole student group got the mail
  // twice. This conditional update succeeds for exactly one caller:
  // only the caller whose update changed 1 row may send.
  const claimedAt = new Date();
  const claimed = await prisma.event.updateMany({
    where: { id: event.id, announcementSentAt: null },
    data: { announcementSentAt: claimedAt },
  });
  if (claimed.count !== 1) {
    return fail("ANNOUNCEMENT_ALREADY_SENT", 400);
  }
  const mail = buildAnnouncementMail(event);
  const result = await sendMail({
    to: studentsGroupEmail(),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  // The mail log is record-keeping: if writing it fails, the send
  // result above is still the truth, so a log failure must not turn
  // a sent mail into a 500, and must not leave the claim held after
  // a failed send.
  try {
    await prisma.mailLog.create({
      data: {
        eventId: event.id,
        toEmail: studentsGroupEmail(),
        type: "ANNOUNCEMENT",
        subject: mail.subject,
        status: result.sent ? "SENT" : "FAILED",
        error: result.sent ? null : result.error,
        sentAt: result.sent ? new Date() : null,
      },
    });
  } catch {
    console.error("Could not write the announcement mail log.");
  }
  if (!result.sent) {
    // The claim is released on failure, so the admin can retry.
    // Only a successful send keeps the event marked as sent.
    await prisma.event.updateMany({
      where: { id: event.id, announcementSentAt: claimedAt },
      data: { announcementSentAt: null },
    });
    return fail("MAIL_FAILED", 502);
  }
  return ok({ announcementSentAt: claimedAt });
}
