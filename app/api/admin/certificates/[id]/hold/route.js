import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

// POST, admin only. Body: { action: "HOLD" or "UNHOLD" }.
// Held means: no mail, and not shown on the student page. The student
// page only shows a download after a certificate is SENT, so holding
// is safe even if the file is already uploaded. Unholding puts the
// certificate back to UPLOADED, ready to be ticked for sending.
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();
  if (action !== "HOLD" && action !== "UNHOLD") return fail("INVALID_FILE", 400);
  const certificate = await prisma.certificate.findUnique({ where: { id: params.id } });
  if (!certificate) return fail("CERTIFICATE_NOT_FOUND", 404);
  if (action === "HOLD" && certificate.status === "SENT") {
    return fail("CERTIFICATE_ALREADY_SENT", 400);
  }
  const updated = await prisma.certificate.update({
    where: { id: certificate.id },
    data: {
      status: action === "HOLD" ? "HELD" : "UPLOADED",
      sendTicked: false,
    },
  });
  return ok({ certificate: updated });
}
