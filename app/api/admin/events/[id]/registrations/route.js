import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// GET, admin only. Sprint 3 dashboard list for one event.
// Query, all optional:
//   search: matches name, USN, or email, case-insensitive, partial.
//   payment: one PaymentStatus, for example PENDING_REVIEW or VERIFIED.
//   attendance: one Attendance value, for example PRESENT or UNMARKED.
//   format: when it is "csv", the same filtered list is returned as a
//     CSV download instead of JSON, with the same rows and order.
// Without format, the response also includes counts for the filtered
// list and for the whole event, so the dashboard can show totals
// without a second request. The original behaviour, no query at all,
// still returns every registration for the event, oldest first.
function csvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const payment = url.searchParams.get("payment") || "";
  const attendance = url.searchParams.get("attendance") || "";
  // m13: filter values go straight into the Prisma where, so an
  // invalid enum value used to throw an unhandled 500. Only real
  // enum values are accepted; anything else is ignored.
  const validPayments = ["NOT_REQUIRED", "PENDING_REVIEW", "VERIFIED", "REJECTED"];
  const validAttendances = ["UNMARKED", "PRESENT", "ABSENT"];
  const where = { eventId: event.id };
  if (payment && validPayments.includes(payment)) where.paymentStatus = payment;
  if (attendance && validAttendances.includes(attendance)) where.attendance = attendance;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { usn: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const registrations = await prisma.registration.findMany({
    where,
    orderBy: { registeredAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });
  if (url.searchParams.get("format") === "csv") {
    const header = ["Name", "USN", "Email", "Branch", "Semester", "Phone", "Payment", "Attendance", "Status", "Registered at"];
    const rows = registrations.map((r) => [
      r.name, r.usn, r.email, r.branch, r.semester, r.phone,
      r.paymentStatus, r.attendance, r.status, r.registeredAt,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="registrations-${event.slug}.csv"`,
      },
    });
  }
  const all = await prisma.registration.findMany({ where: { eventId: event.id } });
  function count(list, key, value) {
    return list.filter((r) => r[key] === value).length;
  }
  // m12: cancelled registrations are kept out of the breakdown
  // counts and shown on their own line. `total` stays the size of
  // the whole list, because the admin page shows it as
  // "Showing {filtered} of {total}" against the list itself, which
  // still includes cancelled rows; `filtered` likewise still
  // matches the list shown.
  const active = all.filter((r) => r.status !== "CANCELLED");
  const counts = {
    total: all.length,
    cancelled: all.length - active.length,
    filtered: registrations.length,
    paid: event.feeType === "PAID" ? active.length : 0,
    free: event.feeType === "FREE" ? active.length : 0,
    verified: count(active, "paymentStatus", "VERIFIED"),
    pendingReview: count(active, "paymentStatus", "PENDING_REVIEW"),
    rejected: count(active, "paymentStatus", "REJECTED"),
    notRequired: count(active, "paymentStatus", "NOT_REQUIRED"),
    present: count(active, "attendance", "PRESENT"),
    absent: count(active, "attendance", "ABSENT"),
    unmarked: count(active, "attendance", "UNMARKED"),
  };
  return ok({ event, registrations, counts });
}
