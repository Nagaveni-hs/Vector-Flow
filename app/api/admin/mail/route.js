// Standalone Mail section: admin-only, not tied to any event or
// slug. The admin supplies To, Subject, and Body. One mail is sent
// per recipient, so no recipient sees the others, and one MailLog
// row (type STANDALONE) is written per recipient. This route never
// touches the announcement, registration, payment, reminder, or
// certificate mails or their audiences.
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { sendMail } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 200;
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHtml(text) {
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return fail("INVALID_BODY", 400);
  }

  const rawTo = Array.isArray(payload.to) ? payload.to : [];
  const recipients = [
    ...new Set(
      rawTo
        .map((v) => String(v ?? "").trim().toLowerCase())
        .filter((v) => v !== "" && EMAIL_RE.test(v))
    ),
  ];
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (recipients.length === 0) return fail("NO_RECIPIENTS", 400);
  if (recipients.length > MAX_RECIPIENTS) return fail("TOO_MANY_RECIPIENTS", 400);
  if (!subject) return fail("SUBJECT_REQUIRED", 400);
  if (subject.length > MAX_SUBJECT) return fail("SUBJECT_TOO_LONG", 400);
  if (!body) return fail("BODY_REQUIRED", 400);
  if (body.length > MAX_BODY) return fail("BODY_TOO_LONG", 400);

  let sent = 0;
  const failedEmails = [];
  const logErrors = [];
  for (const toEmail of recipients) {
    const result = await sendMail({
      to: toEmail,
      subject,
      text: body,
      html: toHtml(body),
    });
    if (result.sent) sent += 1;
    else failedEmails.push(toEmail);
    try {
      await prisma.mailLog.create({
        data: {
          eventId: null,
          toEmail,
          type: "STANDALONE",
          subject,
          status: result.sent ? "SENT" : "FAILED",
          error: result.sent ? null : result.error,
          sentAt: result.sent ? new Date() : null,
        },
      });
    } catch {
      // The mail result stands: a log-write failure must not
      // reclassify a mail that was actually sent (or failed).
      logErrors.push(toEmail);
    }
  }

  return ok({
    sent,
    failed: recipients.length - sent,
    total: recipients.length,
    failedEmails,
    logErrors,
  });
}
