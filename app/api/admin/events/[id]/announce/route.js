import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { buildAnnouncementMail, sendMail, studentsGroupEmail } from "@/lib/mail";

// The admin edit page links with the event slug in this [id] position,
// while other admin routes use the event id, so accept either one.
async function findEvent(key) {
  const byId = await prisma.event.findUnique({ where: { id: key } });
  if (byId) return byId;
  return prisma.event.findUnique({ where: { slug: key } });
}

function requireAdmin() {
  const session = getSession();
  if (!session) return { error: fail("NOT_SIGNED_IN", 401) };
  if (session.role !== "ADMIN") return { error: fail("FORBIDDEN", 403) };
  return { session };
}

// GET: the exact preview the admin sees before sending. No mail is sent here.
export async function GET(request, { params }) {
  const auth = requireAdmin();
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
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const event = await findEvent(params.id);
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  if (event.announcementSentAt) {
    return fail("ANNOUNCEMENT_ALREADY_SENT", 400);
  }
  const mail = buildAnnouncementMail(event);
  const result = await sendMail({
    to: studentsGroupEmail(),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
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
  if (!result.sent) {
    // announcementSentAt is deliberately NOT set on failure, so the
    // admin can retry. Only a successful send marks the event sent.
    return fail("MAIL_FAILED", 502);
  }
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { announcementSentAt: new Date() },
  });
  return ok({ announcementSentAt: updated.announcementSentAt });
}
