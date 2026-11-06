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

// POST, admin only. Body: { action: "VERIFY" or "REJECT", reason: string }.
// Verify: payment status becomes VERIFIED, and a verified mail goes to
// that student only. Reject: payment status becomes REJECTED, a reason
// is required, and a rejected mail goes to that student only.
// Human check, stated plainly: the admin must check the payment
// screenshot against this event's receiver name and amount before
// pressing Verify. This code cannot check a screenshot automatically,
// and it never claims to. It only checks that the registration, the
// event, and the screenshot link belong together.
// A mail failure does not undo the payment decision. It is recorded
// as a FAILED mail log, and the response says so, so the admin can
// see it and try the mail again by re-doing the same action only if
// the payment status allows it.
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();
  if (action !== "VERIFY" && action !== "REJECT") return fail("INVALID_FILE", 400);
  if (action === "REJECT" && !String(body.reason || "").trim()) {
    return fail("REASON_REQUIRED", 400);
  }
  const registration = await prisma.registration.findUnique({
    where: { id: params.id },
    include: { event: true },
  });
  if (!registration) return fail("REGISTRATION_NOT_FOUND", 404);
  if (registration.status !== "REGISTERED") return fail("REGISTRATION_NOT_ACTIVE", 400);
  if (registration.paymentStatus !== "PENDING_REVIEW") {
    return fail("PAYMENT_NOT_PENDING", 400);
  }
  if (action === "VERIFY" && registration.event.feeType !== "PAID") {
    return fail("PAYMENT_NOT_REQUIRED", 400);
  }
  const reason = action === "REJECT" ? String(body.reason).trim().slice(0, 500) : null;
  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: action === "VERIFY" ? "VERIFIED" : "REJECTED",
      rejectionReason: reason,
    },
  });
  const mail =
    action === "VERIFY"
      ? buildPaymentVerifiedMail(registration.event, updated)
      : buildPaymentRejectedMail(registration.event, updated, reason);
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
      type: action === "VERIFY" ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED",
      subject: mail.subject,
      status: result.sent ? "SENT" : "FAILED",
      error: result.sent ? null : result.error,
      sentAt: result.sent ? new Date() : null,
    },
  });
  return ok({ registration: updated, mailStatus: result.sent ? "SENT" : "FAILED" });
}
