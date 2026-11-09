import { prisma } from "@/lib/db";
import { getSession, requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, signed-in student or admin. Cancels one registration.
// Rules (M5, implemented, not removed):
// - A student can only cancel their OWN registration. An admin can
//   cancel any registration, using the same route.
// - Only a registration that is still REGISTERED can be cancelled.
//   Already-cancelled rows return ALREADY_CANCELLED, and a row
//   marked PRESENT (attendance already recorded) cannot be cancelled
//   at all -- the student attended, so a certificate may follow.
// - Only before the event starts. Once the event has started, the
//   registration is locked.
// - The row is NOT deleted. It stays with status CANCELLED and
//   cancelledAt set, so the admin dashboard still shows it, and the
//   student can register again later (the register route re-activates
//   a CANCELLED row instead of hitting the unique guard).
// - Paid registrations: there is NO automatic refund in this patch.
//   Payment is manual UPI, so a cancelled paid registration is
//   flagged in the response and must be refunded by hand, outside
//   the site, by the admin. The response says so plainly.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const registration = await prisma.registration.findUnique({
    where: { id: params.id },
    include: { event: true },
  });
  if (!registration) return fail("REGISTRATION_NOT_FOUND", 404);
  if (registration.userId !== session.userId) {
    // Not the owner: only an admin may cancel someone else's row.
    const auth = await requireAdmin();
    if (auth.error) return fail("FORBIDDEN", 403);
  }
  if (registration.status === "CANCELLED") return fail("ALREADY_CANCELLED", 400);
  if (registration.attendance === "PRESENT") return fail("CANNOT_CANCEL_ATTENDED", 400);
  if (registration.event && new Date(registration.event.startAt) <= new Date()) {
    return fail("REGISTRATION_CLOSED", 400);
  }
  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  const paidRefundNote =
    registration.event.feeType === "PAID"
      ? "This was a paid registration. Cancelling does not refund the money automatically -- payment was manual UPI, so the admin must refund it by hand outside the site."
      : null;
  return ok({ registration: updated, paidRefundNote });
}
