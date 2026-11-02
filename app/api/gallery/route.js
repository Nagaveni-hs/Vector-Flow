import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";

// GET, public. Gallery is Upcoming plus History, both from events.
// Upcoming: events that have not started yet and are published or
// ongoing, soonest first. History: events that are completed, or
// that have already started, newest first. Each card uses the
// event's own drive link, from the driveLink field on the event.
// The gallery_items table is NOT used in this version, because one
// drive link per event is enough for the gallery. That table stays
// in the database for later, if an event ever needs more than one
// drive link, but no code in this patch reads it, and that is
// written down here so no one thinks it is missing by accident.
// If an event has no drive link, the card says so plainly instead
// of showing a broken link.
export async function GET() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { status: { in: ["PUBLISHED", "ONGOING", "COMPLETED"] } },
    orderBy: { startAt: "desc" },
    select: {
      id: true, title: true, slug: true, description: true,
      posterImageUrl: true, venue: true, startAt: true, endAt: true,
      status: true, driveLink: true,
    },
  });
  const upcoming = events
    .filter((e) => e.startAt >= now && e.status !== "COMPLETED")
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const history = events
    .filter((e) => e.status === "COMPLETED" || e.startAt < now)
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
  return ok({ upcoming, history });
}
