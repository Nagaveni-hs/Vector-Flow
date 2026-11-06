import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
// P1 (M7, M11): shared validation, so POST and PUT cannot drift apart.
import { normaliseSlug, validateEvent } from "@/lib/eventValidation";

export async function GET(request, { params }) {
  const event = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  // Drafts are admin-only; published events are public. The admin
  // check re-reads the role from the DB (P0, B3), so a failure here
  // just means "not an admin" and the draft stays hidden.
  const auth = await requireAdmin();
  if (event.status !== "PUBLISHED" && auth.error) {
    return fail("EVENT_NOT_FOUND", 404);
  }
  return ok({ event });
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  // P1 (B6): params.slug is the ORIGINAL slug -- EventForm PUTs to
  // the slug the event had when the form opened, so changing the slug
  // field still finds (and saves) the event instead of 404ing.
  const existing = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!existing) return fail("EVENT_NOT_FOUND", 404);
  const body = await request.json();
  // P1 (M11): normalise the new slug before validating or storing it.
  if (body.slug !== undefined) body.slug = normaliseSlug(body.slug);
  // P1 (M7): PUT is validated exactly like POST now. The form always
  // sends a full event, so the required-field checks apply here too.
  const merged = { ...existing, ...body };
  const err = validateEvent(merged);
  if (err) return fail(err, 400);
  const data = {};
  const fields = [
    "title", "slug", "description", "posterImageUrl", "venue", "mode",
    "feeType", "paymentReceiverName", "paymentReceiverContact",
    "paymentQrImageUrl", "registrationMode", "externalRegistrationUrl",
    "driveLink", "status",
  ];
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
  if (data.title !== undefined) data.title = String(data.title).trim();
  if (data.description !== undefined) data.description = String(data.description).trim();
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
