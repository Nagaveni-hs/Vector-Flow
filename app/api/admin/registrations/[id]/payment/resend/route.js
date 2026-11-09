import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import {
  buildPaymentVerifiedMail,
  buildPaymentRejectedMail,
  sendMail,
} from "@/lib/mail";

// P1 (B9): mail-only resend for a payment decision. After VERIFY or
// REJECT the payment status leaves PENDING_REVIEW, so the original
// payment route refuses the same action forever -- and if the
// verified/rejected mail failed to send (SMTP is currently blocked),
// the student was never told the decision. This route changes
// NOTHING about the decision: it only re-sends the mail that matches
// the registration's current payment status, and records a new mail
// log row. It is the only way a failed payment mail can be re-sent.
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const registration = await prisma.registration.findUnique({
    where: { id: params.id },
    include: { event: true },
  });
  if (!registration) return fail("REGISTRATION_NOT_FOUND", 404);
  if (registration.status !== "REGISTERED") return fail("REGISTRATION_NOT_ACTIVE", 400);
  if (registration.paymentStatus !== "VERIFIED" && registration.paymentStatus !== "REJECTED") {
    // m20: this code used to say PAYMENT_NOT_PENDING, which means
    // the opposite -- the payment was never decided, so there is no
    // decision mail to re-send.
    return fail("PAYMENT_NOT_DECIDED", 400);
  }
  if (registration.event.feeType !== "PAID") {
    return fail("PAYMENT_NOT_REQUIRED", 400);
  }
  const isVerified = registration.paymentStatus === "VERIFIED";
  const mail = isVerified
    ? buildPaymentVerifiedMail(registration.event, registration)
    : buildPaymentRejectedMail(registration.event, registration, registration.rejectionReason);
  const result = await sendMail({
    to: registration.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  await prisma.mailLog.create({
    data: {
      eventId: registration.eventId,
      userId: registration.userId,
      toEmail: registration.email,
      type: isVerified ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED",
      subject: mail.subject,
      status: result.sent ? "SENT" : "FAILED",
      error: result.sent ? null : result.error,
      sentAt: result.sent ? new Date() : null,
    },
  });
  return ok({
    registration,
    mailStatus: result.sent ? "SENT" : "FAILED",
  });
}
