import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const registrations = await prisma.registration.findMany({
    where: { userId: session.userId },
    orderBy: { registeredAt: "desc" },
    include: {
      event: { select: { title: true, slug: true, startAt: true, feeType: true, feeAmount: true, venue: true, posterImageUrl: true, mode: true, status: true } },
      certificate: { select: { id: true, status: true, emailedAt: true, issuedAt: true } },
    },
  });
  // Sprint 4 rule, enforced here, not just in the page: a certificate
  // is only shown to the student after it has been sent. An uploaded,
  // held, queued, or failed certificate is replaced with null, so the
  // student page cannot show a download for it, even if the page code
  // is changed later.
  const safe = registrations.map((r) => ({
    ...r,
    certificate: r.certificate && r.certificate.status === "SENT" ? r.certificate : null,
  }));
  return ok({ registrations: safe });
}
