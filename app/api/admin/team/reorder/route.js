import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only. Body: { orders: [{ id, orderIndex }] }.
// Saves a new order for a list of members, in one transaction.
// The admin page sends the whole list after the admin moves rows
// up or down, so the order on the public page matches the admin page.
export async function POST(request) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const body = await request.json().catch(() => ({}));
  const orders = Array.isArray(body.orders) ? body.orders : [];
  await prisma.$transaction(
    orders.map((o) =>
      prisma.teamMember.update({
        where: { id: String(o.id) },
        data: { orderIndex: Number(o.orderIndex) },
      })
    )
  );
  return ok({ updated: orders.length });
}
