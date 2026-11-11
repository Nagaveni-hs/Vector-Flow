import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// P0 (B3): admin role is re-read from the DB by the shared
// requireAdmin() in lib/auth.js, not trusted from the JWT claim.
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { isCloudinaryUrl } from "@/lib/upload";

// GET, admin only: certificates for one event, with the registration
// and student details the admin page needs. Query: ?eventId=...
// If no eventId is given, the newest 100 certificates are returned.
export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const eventId = new URL(request.url).searchParams.get("eventId") || "";
  const where = eventId ? { eventId } : {};
  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { id: "asc" },
    include: {
      registration: { select: { name: true, usn: true, email: true, attendance: true, status: true } },
      event: { select: { title: true, slug: true } },
    },
    take: 100,
  });
  // m10 (minors): the list is capped at 100 with no pagination, so
  // the total is returned alongside it -- otherwise an event with
  // more than 100 certificates silently shows only the first 100.
  // The page reads data.certificates as before; `total` is additive
  // and breaks no caller. Full pagination UI is out of scope.
  const total = await prisma.certificate.count({ where });
  return ok({ certificates, total });
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
// so a wrong file can be corrected before it is ever sent. That
// only applies while the certificate is UPLOADED or FAILED: a
// QUEUED, HELD, or SENT certificate refuses the re-upload (see
// below), so a queued send is never dropped and a hold is never
// silently undone.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const registrationId = String(body.registrationId || "");
  const fileUrl = String(body.fileUrl || "");
  if (!registrationId || !fileUrl) return fail("INVALID_FILE", 400);
  // m6 (minors): https only now -- the old http:// allowance was
  // part of the same laxity, and the only producer of these URLs
  // is Cloudinary secure_url, which is always https.
  if (!fileUrl.startsWith("https://")) {
    return fail("INVALID_FILE", 400);
  }
  // m6 (minors): the CSP only allows files from res.cloudinary.com,
  // and the mail worker fetches this URL to attach the PDF, so a
  // file on any other host (or plain http) is refused here with its
  // own code and message, instead of being stored and failing later
  // in the preview or the mail send.
  if (!isCloudinaryUrl(fileUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: "CERTIFICATE_HOST_NOT_ALLOWED",
        message: "The certificate file must be hosted on Cloudinary (res.cloudinary.com). Upload it with the certificate uploader instead of pasting a link from another site.",
      },
      { status: 400 }
    );
  }
  const lower = fileUrl.split("?")[0].toLowerCase();
  if (!lower.endsWith(".pdf")) return fail("INVALID_FILE", 400);
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });
  if (!registration) return fail("REGISTRATION_NOT_FOUND", 404);
  if (registration.status !== "REGISTERED") return fail("REGISTRATION_NOT_ACTIVE", 400);
  if (registration.attendance !== "PRESENT") return fail("ATTENDANCE_NOT_PRESENT", 400);
  // M4: a certificate that was already SENT must not be silently
  // un-sent by a re-upload. The student already received the old
  // PDF by mail, so uploading again only corrects a file before it
  // is ever sent. To replace a sent certificate, hold or re-issue
  // it through a new flow, not this upload.
  const existing = await prisma.certificate.findUnique({ where: { registrationId } });
  if (existing && existing.status === "SENT") return fail("CERTIFICATE_ALREADY_SENT", 400);
  // M3: a re-upload must not bypass HOLD or drop a queued send.
  // The upsert below resets the row to UPLOADED, which would
  // silently un-hold a HELD certificate, and a QUEUED one would
  // leave its mail row orphaned (the worker would park it FAILED /
  // CERTIFICATE_NOT_QUEUED and the queued send would just vanish).
  // Refuse both, with a distinct code and message each, so the
  // admin page can tell the admin what to do instead. fail()
  // carries no message, so these two refusals build the response
  // directly in the same { ok: false, error, message } shape.
  if (existing && existing.status === "QUEUED") {
    return NextResponse.json(
      {
        ok: false,
        error: "CERTIFICATE_QUEUED",
        message: "This certificate is already queued to be sent. Wait for the mail to go out, or hold it first if it should not be sent.",
      },
      { status: 400 }
    );
  }
  if (existing && existing.status === "HELD") {
    return NextResponse.json(
      {
        ok: false,
        error: "CERTIFICATE_HELD",
        message: "This certificate is held. Unhold it before uploading a new file.",
      },
      { status: 400 }
    );
  }
  const certificate = await prisma.certificate.upsert({
    where: { registrationId },
    update: {
      fileUrl,
      fileName: body.fileName ? String(body.fileName).slice(0, 200) : null,
      status: "UPLOADED",
      sendTicked: false,
      emailedAt: null,
      mailError: null,
      uploadedById: auth.session.userId,
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
