import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { buildRegistrationMail, sendMail } from "@/lib/mail";

export async function POST(request, { params }) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const event = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  if (event.status !== "PUBLISHED") return fail("REGISTRATION_CLOSED", 400);
  const now = new Date();
  if (event.registrationOpensAt && now < event.registrationOpensAt) return fail("REGISTRATION_CLOSED", 400);
  if (event.registrationClosesAt && now > event.registrationClosesAt) return fail("REGISTRATION_CLOSED", 400);
  const body = await request.json();
  if (!body.name || !body.usn || !body.email) return fail("INVALID_FILE", 400);
  const isPaid = event.feeType === "PAID";
  if (isPaid && !body.paymentScreenshotUrl) return fail("PAYMENT_REQUIRED", 400);
  if (body.paymentScreenshotUrl) {
    const u = String(body.paymentScreenshotUrl);
    if (!u.startsWith("http://") && !u.startsWith("https://")) return fail("INVALID_FILE", 400);
    if (u.length > 2000) return fail("INVALID_FILE", 400);
  }
  try {
    const registration = await prisma.registration.create({
      data: {
        eventId: event.id,
        userId: session.userId,
        name: body.name,
        usn: body.usn,
        email: body.email,
        branch: body.branch || null,
        semester: body.semester ? Number(body.semester) : null,
        phone: body.phone || null,
        paymentStatus: isPaid ? "PENDING_REVIEW" : "NOT_REQUIRED",
        paymentScreenshotUrl: body.paymentScreenshotUrl || null,
      },
    });
    // Registration mail: to this student only, never to the group.
    // A mail failure must NOT fail the registration itself, so any
    // mail error is recorded as a FAILED mail log and we still return
    // the registration. A duplicate attempt never reaches here: it
    // returns ALREADY_REGISTERED below, with no mail at all.
    let mailStatus = "FAILED";
    try {
      const mail = buildRegistrationMail(event, registration);
      const result = await sendMail({
        to: registration.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      mailStatus = result.sent ? "SENT" : "FAILED";
      await prisma.mailLog.create({
        data: {
          eventId: event.id,
          userId: registration.userId,
          toEmail: registration.email,
          type: "REGISTRATION",
          subject: mail.subject,
          status: mailStatus,
          error: result.sent ? null : result.error,
          sentAt: result.sent ? new Date() : null,
        },
      });
    } catch {
      mailStatus = "FAILED";
    }
    return ok({ registration, mailStatus }, 201);
  } catch (e) {
    if (e && e.code === "P2002") return fail("ALREADY_REGISTERED", 400);
    return fail("INVALID_FILE", 400);
  }
}
