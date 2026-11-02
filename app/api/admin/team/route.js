import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

function requireAdmin() {
  const session = getSession();
  if (!session) return { error: fail("NOT_SIGNED_IN", 401) };
  if (session.role !== "ADMIN") return { error: fail("FORBIDDEN", 403) };
  return { session };
}

// GET, admin only: every team member, grouped by the admin page.
// The public team route is separate and only shows one year at a time.
export async function GET() {
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const members = await prisma.teamMember.findMany({
    orderBy: [{ academicYear: "desc" }, { orderIndex: "asc" }],
  });
  return ok({ members });
}

// POST, admin only: add one member. New members are created with
// isCurrentYear false, even if their year will later become the
// current year. Only the Publish route can make a year current,
// so preparing a new year never changes the live team page.
export async function POST(request) {
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.designation || !body.academicYear) {
    return fail("INVALID_FILE", 400);
  }
  const member = await prisma.teamMember.create({
    data: {
      name: String(body.name).slice(0, 200),
      designation: String(body.designation).slice(0, 200),
      photoUrl: body.photoUrl ? String(body.photoUrl).slice(0, 2000) : null,
      bio: body.bio ? String(body.bio).slice(0, 1000) : null,
      orderIndex: body.orderIndex ? Number(body.orderIndex) : 0,
      academicYear: String(body.academicYear).slice(0, 20),
      isCurrentYear: false,
    },
  });
  return ok({ member }, 201);
}
