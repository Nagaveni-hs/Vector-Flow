import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/json";

// GET, public. Team page data. Without a year, this returns the
// current year team, ordered by orderIndex, plus the list of years
// that exist, newest first, for the History selector. With a year,
// for example ?year=2026-27, it returns that year's team instead.
// Past years are never changed by this route; it only reads.
export async function GET(request) {
  const year = new URL(request.url).searchParams.get("year") || "";
  let allYears;
  let current = null;
  let members = [];
  try {
    allYears = await prisma.teamMember.findMany({
      select: { academicYear: true },
    });
  } catch {
    // Same { ok: false, error } shape as the other public routes.
    return fail("TEAM_UNAVAILABLE", 500);
  }
  // Years are de-duplicated in code, not with a database distinct
  // query, so this route does not depend on a database-specific
  // distinct plus order combination.
  const yearList = [...new Set(allYears.map((y) => y.academicYear))].sort().reverse();
  let currentYear = year;
  if (!currentYear) {
    try {
      current = await prisma.teamMember.findFirst({
        where: { isCurrentYear: true },
        orderBy: { academicYear: "desc" },
      });
    } catch {
      return fail("TEAM_UNAVAILABLE", 500);
    }
    currentYear = current ? current.academicYear : yearList[0] || "";
  }
  if (currentYear) {
    try {
      members = await prisma.teamMember.findMany({
        where: { academicYear: currentYear },
        orderBy: { orderIndex: "asc" },
      });
    } catch {
      return fail("TEAM_UNAVAILABLE", 500);
    }
  }
  return ok({ year: currentYear, years: yearList, members });
}
