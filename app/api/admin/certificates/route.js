import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/json";

function requireAdmin() {
  const session = getSession();
  if (!session) return { error: fail("NOT_SIGNED_IN", 401) };
  if (session.role !== "ADMIN") return { error: fail("FORBIDDEN", 403) };
  return { session };
}

// GET, admin only: certificates for one event, with the registration
// and student details the admin page needs. Query: ?eventId=...
// If no eventId is given, the newest 100 certificates are returned.
export async function GET(request) {
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const eventId = new URL(request.url).searchParams.get("eventId") || "";
  const certificates = await prisma.certificate.findMany({
    where: eventId ? { eventId } : {},
    orderBy: { id: "asc" },
    include: {
      registration: { select: { name: true, usn: true, email: true, attendance: true, status: true } },
      event: { select: { title: true, slug: true } },
    },
    take: 100,
  });
  return ok({ certificates });
}

// POST, admin only. Body: { registrationId, fileUrl, fileName }.
// This is the second half of the certificate upload. The first half
// happens in the browser: the admin uploads the PDF straight to
// Cloudinary with a signed upload, so a large PDF never goes through
// a server function body. This route only saves the resulting URL.
// Rules: the registration must exist, be active, and have attendance
// PRESENT. The file must be a PDF link. If a certificate already
// exists for this registration, uploading again replaces its file
// and resets it to UPLOADED, with send ticked off and no sent date,
// so a wrong file can be corrected before it is ever sent.
export async function POST(request) {
  const auth = requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const registrationId = String(body.registrationId || "");
  const fileUrl = String(body.fileUrl || "");
  if (!registrationId || !fileUrl) return fail("INVALID_FILE", 400);
  if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
    return fail("INVALID_FILE", 400);
  }
  const lower = fileUrl.split("?")[0].toLowerCase();
  if (!lower.endsWith(".pdf")) return fail("INVALID_FILE", 400);
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });
  if (!registration) return fail("REGISTRATION_NOT_FOUND", 404);
  if (registration.status !== "REGISTERED") return fail("REGISTRATION_NOT_ACTIVE", 400);
  if (registration.attendance !== "PRESENT") return fail("ATTENDANCE_NOT_PRESENT", 400);
  const certificate = await prisma.certificate.upsert({
    where: { registrationId },
    update: {
      fileUrl,
      fileName: body.fileName ? String(body.fileName).slice(0, 200) : null,
      status: "UPLOADED",
      sendTicked: false,
      emailedAt: null,
      mailError: null,
    },
    create: {
      eventId: registration.eventId,
      userId: registration.userId,
      registrationId,
      fileUrl,
      fileName: body.fileName ? String(body.fileName).slice(0, 200) : null,
      status: "UPLOADED",
      sendTicked: false,
      uploadedById: auth.session.userId,
    },
  });
  return ok({ certificate }, 201);
}
