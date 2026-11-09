import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only. Body: { orders: [{ id, orderIndex }] }.
// Saves a new order for a list of members, in one transaction.
// The admin page sends the whole list after the admin moves rows
// up or down, so the order on the public page matches the admin page.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const orders = Array.isArray(body.orders) ? body.orders : [];
  // m21: bad ids and bad numbers are a 400, not an unhandled 500.
  // Number() on a non-number gives NaN, which Prisma rejects, so
  // every order is checked before the transaction runs.
  for (const o of orders) {
    if (
      !o ||
      typeof o.id !== "string" ||
      !o.id.trim() ||
      !Number.isInteger(Number(o.orderIndex))
    ) {
      return fail("INVALID_FILE", 400);
    }
  }
  try {
    await prisma.$transaction(
      orders.map((o) =>
        prisma.teamMember.update({
          where: { id: String(o.id) },
          data: { orderIndex: Number(o.orderIndex) },
        })
      )
    );
  } catch {
    // An unknown id throws P2025 inside the transaction; that is
    // still a bad request, not a server error.
    return fail("INVALID_FILE", 400);
  }
  return ok({ updated: orders.length });
}
