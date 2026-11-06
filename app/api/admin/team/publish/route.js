import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only. Body: { academicYear }.
// HARD RULE, in one transaction, so the team page can never be left
// half changed: every member that is currently marked current is
// set to not current, and every member of the given year is set to
// current. The previous current year is not deleted, it simply
// becomes History, and the public page can still show it through
// the year selector. If the given year has no members, this route
// refuses, so an empty year can never become the live team.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const academicYear = String(body.academicYear || "").trim();
  if (!academicYear) return fail("INVALID_FILE", 400);
  const draft = await prisma.teamMember.findMany({ where: { academicYear } });
  if (draft.length === 0) return fail("YEAR_NOT_FOUND", 404);
  const previous = await prisma.teamMember.findMany({ where: { isCurrentYear: true } });
  const previousYear = previous.length > 0 ? previous[0].academicYear : null;
  await prisma.$transaction([
    prisma.teamMember.updateMany({ where: { isCurrentYear: true }, data: { isCurrentYear: false } }),
    prisma.teamMember.updateMany({ where: { academicYear }, data: { isCurrentYear: true } }),
  ]);
  return ok({ publishedYear: academicYear, previousYear, members: draft.length });
}
