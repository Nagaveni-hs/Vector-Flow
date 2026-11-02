import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

function requireAdmin() {
  const session = getSession();
  if (!session) return { error: fail("NOT_SIGNED_IN", 401) };
  if (session.role !== "ADMIN") return { error: fail("FORBIDDEN", 403) };
  return { session };
}

// GET, admin only: every registration for one event, for the
// attendance page. Sorted by name, so the admin can work down the list.
export async function GET(request, { params }) {
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const registrations = await prisma.registration.findMany({
    where: { eventId: event.id },
    orderBy: { name: "asc" },
  });
  return ok({ event, registrations });
}

// POST, admin only. Body: { marks: [{ registrationId, attendance }] }
// where attendance is PRESENT, ABSENT, or UNMARKED. All marks are
// saved in one go. One hard rule: a CANCELLED registration can never
// be marked PRESENT. In this schema that means the registration status
// must be REGISTERED. A cancelled registration sent as PRESENT is
// refused for that row, and the response lists it, while the other
// valid rows are still saved. Attendance does not depend on payment
// status here; payment and attendance are separate checks.
export async function POST(request, { params }) {
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const body = await request.json().catch(() => ({}));
  const marks = Array.isArray(body.marks) ? body.marks : [];
  const allowed = ["PRESENT", "ABSENT", "UNMARKED"];
  const refused = [];
  const updates = [];
  for (const mark of marks) {
    if (!mark || !mark.registrationId || !allowed.includes(mark.attendance)) continue;
    const registration = await prisma.registration.findUnique({
      where: { id: mark.registrationId },
    });
    if (!registration || registration.eventId !== event.id) continue;
    if (mark.attendance === "PRESENT" && registration.status !== "REGISTERED") {
      refused.push({ registrationId: registration.id, reason: "CANCELLED_CANNOT_BE_PRESENT" });
      continue;
    }
    updates.push(
      prisma.registration.update({
        where: { id: registration.id },
        data: { attendance: mark.attendance },
      })
    );
  }
  await prisma.$transaction(updates);
  return ok({ saved: updates.length, refused });
}
