import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET(request, { params }) {
  const event = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const session = getSession();
  if (event.status !== "PUBLISHED" && session?.role !== "ADMIN") {
    return fail("EVENT_NOT_FOUND", 404);
  }
  return ok({ event });
}

export async function PUT(request, { params }) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const existing = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!existing) return fail("EVENT_NOT_FOUND", 404);
  const body = await request.json();
  if (body.feeType === "PAID") {
    if (!body.feeAmount || !body.paymentReceiverName || !body.paymentReceiverContact || !body.paymentQrImageUrl) {
      return fail("PAYMENT_REQUIRED", 400);
    }
  }
  if (body.registrationMode === "EXTERNAL" && !body.externalRegistrationUrl) {
    return fail("INVALID_FILE", 400);
  }
  const data = {};
  const fields = [
    "title", "slug", "description", "posterImageUrl", "venue", "mode",
    "feeType", "paymentReceiverName", "paymentReceiverContact",
    "paymentQrImageUrl", "registrationMode", "externalRegistrationUrl",
    "driveLink", "status",
  ];
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
  if (body.feeAmount !== undefined) data.feeAmount = body.feeAmount ? Number(body.feeAmount) : null;
  if (body.startAt) data.startAt = new Date(body.startAt);
  if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.registrationOpensAt !== undefined) data.registrationOpensAt = body.registrationOpensAt ? new Date(body.registrationOpensAt) : null;
  if (body.registrationClosesAt !== undefined) data.registrationClosesAt = body.registrationClosesAt ? new Date(body.registrationClosesAt) : null;
  try {
    const event = await prisma.event.update({ where: { id: existing.id }, data });
    return ok({ event });
  } catch (e) {
    if (e && e.code === "P2002") return fail("INVALID_FILE", 400);
    return fail("INVALID_FILE", 400);
  }
}
