import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET() {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });
  return ok({ events });
}
