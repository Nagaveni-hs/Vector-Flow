import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET() {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { registrations: true } },
      registrations: { select: { paymentStatus: true, attendance: true } },
    },
  });
  // Sprint 3 dashboard counts, computed here so the admin page can
  // show them without fetching every registration list. Paid and free
  // come from the event fee type, not from a per-registration fee.
  const withCounts = events.map((event) => {
    const regs = event.registrations || [];
    const counts = {
      total: regs.length,
      paid: event.feeType === "PAID" ? regs.length : 0,
      free: event.feeType === "FREE" ? regs.length : 0,
      verified: regs.filter((r) => r.paymentStatus === "VERIFIED").length,
      pendingReview: regs.filter((r) => r.paymentStatus === "PENDING_REVIEW").length,
      rejected: regs.filter((r) => r.paymentStatus === "REJECTED").length,
      present: regs.filter((r) => r.attendance === "PRESENT").length,
      absent: regs.filter((r) => r.attendance === "ABSENT").length,
    };
    const { registrations, ...rest } = event;
    return { ...rest, counts };
  });
  return ok({ events: withCounts });
}
