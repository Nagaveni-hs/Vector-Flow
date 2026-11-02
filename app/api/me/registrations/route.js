import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET() {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const registrations = await prisma.registration.findMany({
    where: { userId: session.userId },
    orderBy: { registeredAt: "desc" },
    include: { event: { select: { title: true, slug: true, startAt: true, feeType: true, feeAmount: true } } },
  });
  return ok({ registrations });
}
