import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
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
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const payment = url.searchParams.get("payment") || "";
  const attendance = url.searchParams.get("attendance") || "";
  const where = { eventId: event.id };
  if (payment) where.paymentStatus = payment;
  if (attendance) where.attendance = attendance;
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
  const counts = {
    total: all.length,
    filtered: registrations.length,
    paid: event.feeType === "PAID" ? all.length : 0,
    free: event.feeType === "FREE" ? all.length : 0,
    verified: count(all, "paymentStatus", "VERIFIED"),
    pendingReview: count(all, "paymentStatus", "PENDING_REVIEW"),
    rejected: count(all, "paymentStatus", "REJECTED"),
    notRequired: count(all, "paymentStatus", "NOT_REQUIRED"),
    present: count(all, "attendance", "PRESENT"),
    absent: count(all, "attendance", "ABSENT"),
    unmarked: count(all, "attendance", "UNMARKED"),
  };
  return ok({ event, registrations, counts });
}
