import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, student owner only. This is the Sprint 3 re-upload path: after
// a payment is rejected, the student can upload a new screenshot.
// It only works when the registration is still active, the payment
// was rejected, and the event is a paid event. On success the payment
// goes back to PENDING_REVIEW, the old rejection reason is cleared,
// and the admin sees the new screenshot for review. No other field
// on the registration is changed here.
export async function POST(request, { params }) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const registration = await prisma.registration.findUnique({
    where: { id: params.id },
    include: { event: true },
  });
  if (!registration) return fail("REGISTRATION_NOT_FOUND", 404);
  if (registration.userId !== session.userId) return fail("FORBIDDEN", 403);
  if (registration.status !== "REGISTERED") return fail("REGISTRATION_NOT_ACTIVE", 400);
  if (registration.paymentStatus !== "REJECTED") return fail("PAYMENT_NOT_REJECTED", 400);
  if (registration.event.feeType !== "PAID") return fail("PAYMENT_NOT_REQUIRED", 400);
  const body = await request.json().catch(() => ({}));
  const url = String(body.paymentScreenshotUrl || "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) return fail("INVALID_FILE", 400);
  if (url.length > 2000) return fail("INVALID_FILE", 400);
  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: {
      paymentScreenshotUrl: url,
      paymentStatus: "PENDING_REVIEW",
      rejectionReason: null,
    },
  });
  return ok({ registration: updated });
}
