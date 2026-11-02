import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// GET, admin only. Query: ?year=2026-27. Returns that year's
// members, ordered, plus the live current year and its members,
// for comparison. This route never changes anything. It is only
// a preview, so the admin can check a draft before publishing it.
export async function GET(request) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const year = new URL(request.url).searchParams.get("year") || "";
  if (!year) return fail("INVALID_FILE", 400);
  const draft = await prisma.teamMember.findMany({
    where: { academicYear: year },
    orderBy: { orderIndex: "asc" },
  });
  const live = await prisma.teamMember.findMany({
    where: { isCurrentYear: true },
    orderBy: { orderIndex: "asc" },
  });
  const liveYear = live.length > 0 ? live[0].academicYear : null;
  return ok({ year, draft, liveYear, live });
}
