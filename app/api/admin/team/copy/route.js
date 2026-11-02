import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only. Body: { fromYear, toYear }.
// Copies every member of fromYear, usually the current year, into
// toYear, as a starting draft. The copies are created with
// isCurrentYear false, so the live team page does not change.
// If toYear already has members, this route refuses, so copying
// twice cannot make duplicate rows. The admin can then edit, add,
// remove, or reorder the draft, preview it, and publish it later.
export async function POST(request) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const body = await request.json().catch(() => ({}));
  const fromYear = String(body.fromYear || "").trim();
  const toYear = String(body.toYear || "").trim();
  if (!fromYear || !toYear || fromYear === toYear) return fail("INVALID_FILE", 400);
  const existing = await prisma.teamMember.findMany({ where: { academicYear: toYear } });
  if (existing.length > 0) return fail("YEAR_ALREADY_EXISTS", 400);
  const source = await prisma.teamMember.findMany({
    where: { academicYear: fromYear },
    orderBy: { orderIndex: "asc" },
  });
  if (source.length === 0) return fail("YEAR_NOT_FOUND", 404);
  await prisma.$transaction(
    source.map((m) =>
      prisma.teamMember.create({
        data: {
          name: m.name,
          designation: m.designation,
          photoUrl: m.photoUrl,
          bio: m.bio,
          orderIndex: m.orderIndex,
          academicYear: toYear,
          isCurrentYear: false,
        },
      })
    )
  );
  return ok({ copied: source.length, fromYear, toYear });
}
