import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { certFontById } from "@/lib/certNames";
import { isCloudinaryUrl } from "@/lib/upload";

// PUT, admin only. Saves the certificate template setup for one
// event: the template image, the font picked for the event, and
// where the name goes. Body:
// { url, font, box: { x, y, w, h }, size }.
// The box is fractions (0..1) of the template image size, measured
// from the top-left corner, so the same setup works for any admin
// and any screen size. Only JPG and PNG templates are accepted:
// those are the only image types a PDF can embed. The template
// setup is read back through the existing attendance GET, which
// returns the full event row, so the certificates page needs no
// extra fetch for it.
function isFraction(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return fail("EVENT_NOT_FOUND", 404);
  const body = await request.json().catch(() => ({}));
  const url = String(body.url || "");
  const font = String(body.font || "");
  const box = body.box || {};
  const size = Number(body.size);
  if (!url.startsWith("https://")) return fail("INVALID_TEMPLATE_URL", 400);
  // m6 (minors): the CSP only allows images from res.cloudinary.com,
  // so a template on any other host would fail to render in the
  // placement preview and its fetch would be CSP-blocked. Refuse it
  // here with its own code instead of storing a URL that can never
  // be shown. fail() carries no message, so this refusal builds the
  // response directly, as the certificate route already does.
  if (!isCloudinaryUrl(url)) {
    return NextResponse.json(
      {
        ok: false,
        error: "TEMPLATE_HOST_NOT_ALLOWED",
        message: "The template image must be hosted on Cloudinary (res.cloudinary.com). Upload it with the template uploader instead of pasting a link from another site.",
      },
      { status: 400 }
    );
  }
  const lower = url.split("?")[0].toLowerCase();
  if (!lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".png")) {
    return fail("INVALID_TEMPLATE_URL", 400);
  }
  if (!certFontById(font)) return fail("INVALID_FONT", 400);
  if (!isFraction(box.x) || !isFraction(box.y) || !isFraction(box.w) || !isFraction(box.h)) {
    return fail("INVALID_BOX", 400);
  }
  if (box.w <= 0 || box.h <= 0 || box.x + box.w > 1 || box.y + box.h > 1) {
    return fail("INVALID_BOX", 400);
  }
  if (!Number.isFinite(size) || size < 8 || size > 200) return fail("INVALID_SIZE", 400);
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      certTemplate: {
        url,
        font,
        box: { x: box.x, y: box.y, w: box.w, h: box.h },
        size,
      },
    },
  });
  return ok({ certTemplate: updated.certTemplate });
}
