import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// GET, admin only: every registration for one event, for the
// attendance page. Sorted by name, so the admin can work down the list.
export async function GET(request, { params }) {
  const auth = await requireAdmin();
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
// M9: attendance locks once any certificate for the event is SENT --
// after that, no mark can be changed, so a sent certificate can never
// end up belonging to a now-absent student. And nobody can be marked
// PRESENT before the event has started.
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const sentCertificate = await prisma.certificate.findFirst({
    where: { eventId: event.id, status: "SENT" },
    select: { id: true },
  });
  if (sentCertificate) return fail("ATTENDANCE_LOCKED", 400);
  const body = await request.json().catch(() => ({}));
  const marks = Array.isArray(body.marks) ? body.marks : [];
  // m9 (minors): cap the batch at 200, matching the mail cap, so
  // one call cannot save an unbounded number of marks.
  if (marks.length > 200) return fail("TOO_MANY_MARKS", 400);
  const allowed = ["PRESENT", "ABSENT", "UNMARKED"];
  const refused = [];
  const updates = [];
  const eventStarted = new Date(event.startAt) <= new Date();
  for (const mark of marks) {
    // m19: no row is dropped silently any more. Every skipped row
    // is listed in `refused` with its reason, and a CANCELLED
    // registration refuses any mark at all, not just PRESENT.
    if (!mark || !mark.registrationId) {
      refused.push({ registrationId: (mark && mark.registrationId) || null, reason: "INVALID_MARK" });
      continue;
    }
    if (!allowed.includes(mark.attendance)) {
      refused.push({ registrationId: mark.registrationId, reason: "INVALID_ATTENDANCE" });
      continue;
    }
    const registration = await prisma.registration.findUnique({
      where: { id: mark.registrationId },
    });
    if (!registration) {
      refused.push({ registrationId: mark.registrationId, reason: "REGISTRATION_NOT_FOUND" });
      continue;
    }
    if (registration.eventId !== event.id) {
      refused.push({ registrationId: registration.id, reason: "WRONG_EVENT" });
      continue;
    }
    if (registration.status !== "REGISTERED") {
      refused.push({
        registrationId: registration.id,
        reason:
          mark.attendance === "PRESENT"
            ? "CANCELLED_CANNOT_BE_PRESENT"
            : "CANCELLED_CANNOT_BE_MARKED",
      });
      continue;
    }
    if (mark.attendance === "PRESENT" && !eventStarted) {
      refused.push({ registrationId: registration.id, reason: "EVENT_NOT_STARTED" });
      continue;
    }
    updates.push({ id: registration.id, attendance: mark.attendance });
  }
  // m13 (minors): the SENT lock is re-checked inside the write
  // transaction, immediately before the marks are applied, so a
  // certificate that became SENT after the first check at the top
  // still blocks the save. This narrows the race to the instant
  // between the re-check and the commit; it cannot close it fully
  // with Prisma alone (that would need a row lock), and the worker's
  // own pre-send eligibility re-check stays the backstop.
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.certificate.findFirst({
        where: { eventId: event.id, status: "SENT" },
        select: { id: true },
      });
      if (locked) throw new Error("ATTENDANCE_LOCKED");
      for (const u of updates) {
        await tx.registration.update({
          where: { id: u.id },
          data: { attendance: u.attendance },
        });
      }
    });
  } catch (e) {
    if (e && e.message === "ATTENDANCE_LOCKED") return fail("ATTENDANCE_LOCKED", 400);
    throw e;
  }
  return ok({ saved: updates.length, refused });
}
