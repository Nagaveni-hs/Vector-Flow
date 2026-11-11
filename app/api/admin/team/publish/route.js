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
  // m8 (minors): the strongest guard Prisma allows, short of the
  // database constraint (see the slice report for the manual
  // partial-unique-index SQL -- a migration file cannot apply it,
  // because `prisma db push` ignores checked-in migration SQL).
  // The switch runs in one interactive transaction that (a) takes a
  // transaction-scoped advisory lock, so two concurrent publishes
  // run one after the other instead of interleaving, and (b) reads
  // back the current years after the switch and rolls the whole
  // thing back unless exactly the published year is current.
  // A lock failure or an invariant failure answers 500 with no
  // partial switch left behind.
  try {
    await prisma.$transaction(async (tx) => {
      // Fixed key, used only by this route. Released automatically
      // when the transaction ends, so a failed publish never holds
      // the lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2026111101)`;
      await tx.teamMember.updateMany({
        where: { isCurrentYear: true },
        data: { isCurrentYear: false },
      });
      await tx.teamMember.updateMany({
        where: { academicYear },
        data: { isCurrentYear: true },
      });
      const current = await tx.teamMember.findMany({
        where: { isCurrentYear: true },
        select: { academicYear: true },
      });
      const years = [...new Set(current.map((m) => m.academicYear))];
      if (years.length !== 1 || years[0] !== academicYear) {
        throw new Error("TEAM_PUBLISH_INVARIANT");
      }
    });
  } catch {
    // Either the invariant failed (rolled back, nothing switched)
    // or the transaction itself failed: either way the team is
    // left exactly as it was, and the admin can try again.
    return fail("TEAM_PUBLISH_FAILED", 500);
  }
  return ok({ publishedYear: academicYear, previousYear, members: draft.length });
}
