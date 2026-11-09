import { prisma } from "@/lib/db";
import { getSession, isCollegeEmail } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { buildRegistrationMail, sendMail } from "@/lib/mail";

export async function POST(request, { params }) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const event = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  if (event.status !== "PUBLISHED") return fail("REGISTRATION_CLOSED", 400);
  // P1 (M8): an EXTERNAL-form event has no on-site registration.
  // The event page hides the form for these, but the API must refuse
  // a direct POST too, or the check is only cosmetic.
  if (event.registrationMode === "EXTERNAL") return fail("REGISTRATION_CLOSED", 400);
  const now = new Date();
  if (event.registrationOpensAt && now < event.registrationOpensAt) return fail("REGISTRATION_CLOSED", 400);
  if (event.registrationClosesAt && now > event.registrationClosesAt) return fail("REGISTRATION_CLOSED", 400);
  const body = await request.json();
  if (!body.name || !body.usn) return fail("INVALID_FILE", 400);
  // P1 (B8): the email is the signed-in user's own college email,
  // read from the DB, not whatever the browser typed. A student can
  // no longer register with a Gmail, or register on someone else's
  // behalf -- the confirmation mail would have gone to that address.
  const dbUser = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!dbUser) return fail("NOT_SIGNED_IN", 401);
  const email = String(dbUser.email || "").trim().toLowerCase();
  if (!isCollegeEmail(email)) return fail("NOT_COLLEGE_EMAIL", 400);
  const typedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (typedEmail && typedEmail !== email) return fail("NOT_COLLEGE_EMAIL", 400);
  const name = String(body.name).trim() || dbUser.name;
  const usn = String(body.usn).trim();
  if (!usn) return fail("INVALID_FILE", 400);
  const isPaid = event.feeType === "PAID";
  if (isPaid && !body.paymentScreenshotUrl) return fail("PAYMENT_REQUIRED", 400);
  if (body.paymentScreenshotUrl) {
    const u = String(body.paymentScreenshotUrl);
    if (!u.startsWith("http://") && !u.startsWith("https://")) return fail("INVALID_FILE", 400);
    if (u.length > 2000) return fail("INVALID_FILE", 400);
  }
  const semester = body.semester ? Number(body.semester) : null;
  // M5: a CANCELLED row does not block a fresh registration. The
  // unique [eventId, userId] guard would otherwise throw P2002 on a
  // student who cancelled and wants to register again. So a cancelled
  // row is re-activated below (status back to REGISTERED, payment and
  // attendance reset, new screenshot kept) instead of creating a
  // second row. A still-REGISTERED row is refused as before.
  const existingRegistration = await prisma.registration.findFirst({
    where: { eventId: event.id, userId: session.userId },
  });
  if (existingRegistration && existingRegistration.status === "REGISTERED") {
    return fail("ALREADY_REGISTERED", 400);
  }
  try {
    const registrationData = {
      eventId: event.id,
      userId: session.userId,
      name,
      usn,
      email,
      branch: body.branch ? String(body.branch).trim().slice(0, 100) : null,
      semester: Number.isInteger(semester) && semester >= 1 && semester <= 12 ? semester : null,
      phone: body.phone ? String(body.phone).trim().slice(0, 20) : null,
      paymentStatus: isPaid ? "PENDING_REVIEW" : "NOT_REQUIRED",
      paymentScreenshotUrl: body.paymentScreenshotUrl || null,
    };
    const registration = existingRegistration
      ? await prisma.registration.update({
          where: { id: existingRegistration.id },
          data: {
            ...registrationData,
            status: "REGISTERED",
            attendance: "UNMARKED",
            reminderSentAt: null,
            cancelledAt: null,
            rejectionReason: null,
            registeredAt: new Date(),
          },
        })
      : await prisma.registration.create({ data: registrationData });
    // P1 (M6): save the profile fields to the User row, so the next
    // event's form is prefilled instead of empty forever. This is
    // best-effort and must never fail the registration: a USN that
    // already belongs to someone else is skipped, and any other
    // profile-save error is ignored.
    try {
      const profile = {};
      if (body.branch) profile.branch = String(body.branch).trim().slice(0, 100);
      if (Number.isInteger(semester) && semester >= 1 && semester <= 12) profile.semester = semester;
      if (body.phone) profile.phone = String(body.phone).trim().slice(0, 20);
      const usnOwner = await prisma.user.findUnique({ where: { usn } });
      if (!usnOwner || usnOwner.id === session.userId) profile.usn = usn;
      if (Object.keys(profile).length > 0) {
        await prisma.user.update({ where: { id: session.userId }, data: profile });
      }
    } catch {
      // Profile prefill is a convenience, not part of the registration.
    }
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
