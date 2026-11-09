import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/json";

// GET, public. Gallery is Upcoming plus History, both from events.
// Upcoming: events that have not ended yet and are published or
// ongoing, soonest first. History: only events that have ended --
// status COMPLETED, or an endAt in the past. Each card uses the
// event's own drive link, from the driveLink field on the event.
// P4 (M17): an ONGOING event that already started but has not ended
// yet is Upcoming, not History. The old rule put every started event
// in History even while it was still running. Upcoming and History
// are now mutually exclusive by the same "ended" test, so no event
// appears in both, and none disappears from both.
// The gallery_items table is NOT used in this version, because one
// drive link per event is enough for the gallery. That table stays
// in the database for later, if an event ever needs more than one
// drive link, but no code in this patch reads it, and that is
// written down here so no one thinks it is missing by accident.
// If an event has no drive link, the card says so plainly instead
// of showing a broken link.
export async function GET() {
  const now = new Date();
  let events;
  try {
    events = await prisma.event.findMany({
      where: { status: { in: ["PUBLISHED", "ONGOING", "COMPLETED"] } },
      orderBy: { startAt: "desc" },
      select: {
        id: true, title: true, slug: true, description: true,
        posterImageUrl: true, venue: true, startAt: true, endAt: true,
        status: true, driveLink: true,
      },
    });
  } catch {
    // Same { ok: false, error } shape as the other public routes, so
    // the gallery page can show its error state instead of crashing
    // on a database outage.
    return fail("GALLERY_UNAVAILABLE", 500);
  }
  const hasEnded = (e) =>
    e.status === "COMPLETED" || (e.endAt && new Date(e.endAt) < now);
  const upcoming = events
    .filter((e) => !hasEnded(e))
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const history = events
    .filter((e) => hasEnded(e))
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
  return ok({ upcoming, history });
}
