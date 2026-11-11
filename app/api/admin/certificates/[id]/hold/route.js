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
  // M2: UNHOLD is only a way back from HELD. Unholding a SENT
  // certificate would silently un-send it (back to UPLOADED, ready
  // to be ticked and mailed a second time) while emailedAt still
  // says it was sent. Any other status is refused the same way.
  if (action === "UNHOLD" && certificate.status !== "HELD") {
    return fail("CERTIFICATE_NOT_HELD", 400);
  }
  // M2: holding must also void any pending QUEUED mail row for this
  // certificate, in the same step. Without this the worker would
  // still send the held certificate, because it only looks at the
  // mail row. Unhold keeps its current behaviour (back to UPLOADED):
  // the voided row is gone, so unholding never re-sends a mail the
  // admin did not tick again.
  // M1: the void also covers SENDING rows, i.e. rows the worker
  // already claimed and is sending. Without this, a hold placed
  // while a mail is in flight could not void the row, and the
  // worker's post-send update would flip it back to SENT. The mail
  // itself may already have gone out, but the certificate stays
  // HELD and is never resurrected to SENT.
  const updated = await prisma.$transaction(async (tx) => {
    if (action === "HOLD") {
      await tx.mailLog.updateMany({
        where: { certificateId: certificate.id, status: { in: ["QUEUED", "SENDING"] } },
        data: { status: "FAILED", error: "CERTIFICATE_HELD" },
      });
    }
    return tx.certificate.update({
      where: { id: certificate.id },
      data: {
        status: action === "HOLD" ? "HELD" : "UPLOADED",
        sendTicked: false,
        // A row returned to UPLOADED must not carry a SENT
        // emailedAt: a HELD certificate was never sent, so null is
        // the truthful value. HOLD leaves emailedAt alone, since
        // any row that can be held was never sent either.
        ...(action === "UNHOLD" ? { emailedAt: null } : {}),
      },
    });
  });
  return ok({ certificate: updated });
}
