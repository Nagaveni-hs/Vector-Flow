import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET(request, { params }) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const registrations = await prisma.registration.findMany({
    where: { eventId: params.id },
    orderBy: { registeredAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return ok({ registrations });
}
