import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// PUT, admin only: edit one member. The academic year can be
// changed here, but isCurrentYear cannot be set through this route.
// Only Publish can change which year is current, so an edit can
// never accidentally make a draft year live.
export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
  if (!existing) return fail("TEAM_MEMBER_NOT_FOUND", 404);
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).slice(0, 200);
  if (body.designation !== undefined) data.designation = String(body.designation).slice(0, 200);
  if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl ? String(body.photoUrl).slice(0, 2000) : null;
  if (body.bio !== undefined) data.bio = body.bio ? String(body.bio).slice(0, 1000) : null;
  if (body.orderIndex !== undefined) data.orderIndex = Number(body.orderIndex);
  if (body.academicYear !== undefined) data.academicYear = String(body.academicYear).slice(0, 20);
  const member = await prisma.teamMember.update({ where: { id: params.id }, data });
  return ok({ member });
}

// DELETE, admin only: remove one member. This only removes that one
// row. Publishing a new year never deletes the old year; this delete
// is only for fixing a wrong row, and the admin page asks for
// confirmation before calling it.
export async function DELETE(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
  if (!existing) return fail("TEAM_MEMBER_NOT_FOUND", 404);
  await prisma.teamMember.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
