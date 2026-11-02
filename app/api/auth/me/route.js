import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET() {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, usn: true, branch: true, semester: true, phone: true },
  });
  if (!user) return fail("NOT_SIGNED_IN", 401);
  return ok({ user });
}
