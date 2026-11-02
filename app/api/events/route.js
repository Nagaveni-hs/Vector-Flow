import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { startAt: "asc" },
      select: {
        id: true, title: true, slug: true, description: true,
        posterImageUrl: true, venue: true, mode: true, startAt: true, endAt: true,
        feeType: true, feeAmount: true, registrationMode: true,
      },
    });
    return ok({ events });
  } catch {
    return ok({ events: [] });
  }
}

function validateEvent(body) {
  if (!body.title || !body.slug || !body.description || !body.startAt) {
    return "INVALID_FILE";
  }
  if (body.feeType === "PAID") {
    if (!body.feeAmount || !body.paymentReceiverName || !body.paymentReceiverContact || !body.paymentQrImageUrl) {
      return "PAYMENT_REQUIRED";
    }
  }
  if (body.registrationMode === "EXTERNAL" && !body.externalRegistrationUrl) {
    return "INVALID_FILE";
  }
  return null;
}

export async function POST(request) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  if (session.role !== "ADMIN") return fail("FORBIDDEN", 403);
  const body = await request.json();
  const err = validateEvent(body);
  if (err) return fail(err, 400);
  try {
    const event = await prisma.event.create({
      data: {
        title: body.title,
        slug: body.slug,
        description: body.description,
        posterImageUrl: body.posterImageUrl || null,
        venue: body.venue || null,
        mode: body.mode || "ONSITE",
        startAt: new Date(body.startAt),
        endAt: body.endAt ? new Date(body.endAt) : null,
        registrationOpensAt: body.registrationOpensAt ? new Date(body.registrationOpensAt) : null,
        registrationClosesAt: body.registrationClosesAt ? new Date(body.registrationClosesAt) : null,
        feeType: body.feeType || "FREE",
        feeAmount: body.feeAmount ? Number(body.feeAmount) : null,
        paymentReceiverName: body.paymentReceiverName || null,
        paymentReceiverContact: body.paymentReceiverContact || null,
        paymentQrImageUrl: body.paymentQrImageUrl || null,
        registrationMode: body.registrationMode || "SITE",
        externalRegistrationUrl: body.externalRegistrationUrl || null,
        driveLink: body.driveLink || null,
        status: body.status || "DRAFT",
        createdById: session.userId,
      },
    });
    return ok({ event }, 201);
  } catch (e) {
    if (e && e.code === "P2002") return fail("INVALID_FILE", 400);
    return fail("INVALID_FILE", 400);
  }
}
