import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
// P1 (M7, M11): shared validation, so POST and PUT cannot drift apart.
import { normaliseSlug, validateEvent } from "@/lib/eventValidation";

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
    console.error("Could not load public events.");
    return fail("EVENTS_UNAVAILABLE", 500);
  }
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json();
  // P1 (M11): store the normalised slug, never the raw typed one.
  body.slug = normaliseSlug(body.slug);
  const err = validateEvent(body);
  if (err) return fail(err, 400);
  try {
    const event = await prisma.event.create({
      data: {
        title: body.title.trim(),
        slug: body.slug,
        description: body.description.trim(),
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
        createdById: auth.session.userId,
      },
    });
    return ok({ event }, 201);
  } catch (e) {
    if (e && e.code === "P2002") return fail("INVALID_FILE", 400);
    return fail("INVALID_FILE", 400);
  }
}
