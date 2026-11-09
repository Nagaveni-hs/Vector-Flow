import nodemailer from "nodemailer";
import { google } from "googleapis";

// Mail for Vector Flow, Sprints 2 to 4: registration, announcement,
// reminder, payment verified, payment rejected, and certificate mail.
// Every value that could be a secret comes from environment variables only.
// Nothing here contains a password, a host credential, or a connection string.
// Mail audiences, locked: announcement goes to the students group only;
// every other mail in this file goes to one registered student only,
// never to the group.
//
// Transports, in order:
// 1. Gmail API (preferred): if GMAIL_REFRESH_TOKEN is set, mail is sent
//    through the Gmail API as MAIL_FROM, using the same Google OAuth
//    client already used for sign-in (GOOGLE_CLIENT_ID /
//    GOOGLE_CLIENT_SECRET). This needs no App Password and no SMTP
//    password, which is what the college Workspace admin blocks.
//    Get the token once with `node scripts/get-gmail-token.mjs`.
// 2. SMTP (fallback): the old Nodemailer path, used only when no
//    Gmail refresh token is set. It needs SMTP_HOST / SMTP_PORT /
//    SMTP_USER / SMTP_PASS, which is currently blocked, so until the
//    Gmail token exists mail keeps logging FAILED, exactly as before.
// If neither transport is configured, sendMail returns
// MAIL_NOT_CONFIGURED instead of pretending the mail went out.

// Mail for Vector Flow, Sprints 2 to 4: registration, announcement,
// reminder, payment verified, payment rejected, and certificate mail.
// Every value that could be a secret comes from environment variables only.
// Nothing here contains a password, a host credential, or a connection string.
// Mail audiences, locked: announcement goes to the students group only;
// every other mail in this file goes to one registered student only,
// never to the group.

export const CLUB_NAME = "Vector Flow";

export function mailFrom() {
  return process.env.MAIL_FROM || "vectorflow@vvce.ac.in";
}

export function studentsGroupEmail() {
  return process.env.STUDENTS_GROUP_EMAIL || "vvcestudents@vvce.ac.in";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventLines(event) {
  return [
    `Event: ${event.title}`,
    `Date and time: ${formatDate(event.startAt)}`,
    event.venue ? `Venue: ${event.venue}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function toHtml(text) {
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

// Registration mail: to the registering student only, never to the group.
export function buildRegistrationMail(event, registration) {
  const subject = `Registration received: ${event.title} - ${CLUB_NAME}`;
  const text = [
    `Hello ${registration.name},`,
    "",
    "Thank you for registering. We have received your registration.",
    "",
    eventLines(event),
    registration.paymentStatus === "PENDING_REVIEW"
      ? "Your payment screenshot is under review. We will confirm it soon."
      : "",
    "",
    `From the ${CLUB_NAME} team, VVCE, CSE (AI & ML).`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject, text, html: toHtml(text) };
}

// Announcement mail: to the whole students group, sent once per event.
export function buildAnnouncementMail(event) {
  const subject = `${CLUB_NAME}: ${event.title}`;
  const text = [
    `Hello everyone,`,
    "",
    `${CLUB_NAME}, the CSE (AI & ML) club at VVCE Mysore, is happy to announce a new event.`,
    "",
    eventLines(event),
    "",
    event.description || "",
    "",
    "Please register on the Vector Flow website if you would like to take part.",
    "",
    `From the ${CLUB_NAME} team.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject, text, html: toHtml(text) };
}

// Payment verified mail: to one registered student only, never to the group.
// The admin must already have checked the payment screenshot against
// this event's receiver name and amount. This code cannot check a
// screenshot automatically, and it never claims to.
export function buildPaymentVerifiedMail(event, registration) {
  const subject = `Payment verified: ${event.title} - ${CLUB_NAME}`;
  const text = [
    `Hello ${registration.name},`,
    "",
    "Good news. Your payment for this event has been verified.",
    "",
    eventLines(event),
    "",
    "You do not need to upload your payment screenshot again for this event.",
    "",
    `From the ${CLUB_NAME} team.`,
  ].join("\n");
  return { subject, text, html: toHtml(text) };
}

// Payment rejected mail: to one registered student only, never to the group.
// The reason comes from the admin, and the student can upload a new
// screenshot after a rejection.
export function buildPaymentRejectedMail(event, registration, reason) {
  const subject = `Payment needs attention: ${event.title} - ${CLUB_NAME}`;
  const text = [
    `Hello ${registration.name},`,
    "",
    "Your payment screenshot for this event could not be verified.",
    reason ? `Reason given by the admin: ${reason}` : "",
    "",
    "Please check the payment receiver and amount for this event, and upload a new screenshot on the Participation page.",
    "",
    eventLines(event),
    "",
    `From the ${CLUB_NAME} team.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject, text, html: toHtml(text) };
}

// Certificate mail: to one registered student only, never to the group.
// The PDF is attached by the caller, through the queue worker, not here.
export function buildCertificateMail(event, registration) {
  const subject = `Your certificate: ${event.title} - ${CLUB_NAME}`;
  const text = [
    `Hello ${registration.name},`,
    "",
    "Thank you for taking part. Your certificate for this event is attached to this mail.",
    "",
    eventLines(event),
    "",
    "You can also download it from the Participation page on the website.",
    "",
    `From the ${CLUB_NAME} team.`,
  ].join("\n");
  return { subject, text, html: toHtml(text) };
}

// Reminder mail: to one registered student only, about 24 hours before.
export function buildReminderMail(event, registration) {
  const subject = `Reminder: ${event.title} starts tomorrow - ${CLUB_NAME}`;
  const text = [
    `Hello ${registration.name},`,
    "",
    "This is a reminder that the event you registered for starts in about 24 hours.",
    "",
    eventLines(event),
    "",
    "Please reach on time. See you there.",
    "",
    `From the ${CLUB_NAME} team.`,
  ].join("\n");
  return { subject, text, html: toHtml(text) };
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// --- Gmail API transport -------------------------------------------------

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function getGmailClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`
  );
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function mimeTypeFor(filename) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function base64Text(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64");
}

// A subject with non-ASCII characters must be RFC 2047 encoded,
// or Gmail may reject the message.
function encodeSubject(subject) {
  const value = String(subject ?? "");
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// Attachment content: the certificate worker passes { filename, path }
// where path is a Cloudinary URL, so a remote URL is fetched here.
// A local path is read from disk. { content } (Buffer or string) is
// used as-is. Returns null when the attachment has no usable source.
async function attachmentContent(att) {
  if (!att) return null;
  if (att.content != null) {
    if (Buffer.isBuffer(att.content)) return att.content;
    return Buffer.from(String(att.content), att.encoding || "utf8");
  }
  const path = att.path || att.href;
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`ATTACHMENT_FETCH_FAILED: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const fs = await import("fs/promises");
  return fs.readFile(path);
}

// Builds the full RFC 822 message for the Gmail API, as a string.
// Exported only so it can be unit-tested without a Gmail account:
// sendMail is the only function callers should use.
// - text + html together become multipart/alternative.
// - attachments become multipart/mixed, and are never dropped:
//   a missing or unfetchable attachment fails the send, so a
//   certificate PDF can never silently go out without its file.
export async function buildGmailRawMessage({ to, subject, text, html, attachments }) {
  const boundaryAlt = `vf-alt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const boundaryMixed = `vf-mixed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const list = attachments || [];

  let bodyPart;
  if (text && html) {
    bodyPart = [
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
      "",
      `--${boundaryAlt}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(text),
      `--${boundaryAlt}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(html),
      `--${boundaryAlt}--`,
    ].join("\r\n");
  } else if (html) {
    bodyPart = [
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(html),
    ].join("\r\n");
  } else {
    bodyPart = [
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(text),
    ].join("\r\n");
  }

  if (list.length === 0) {
    return [
      `From: ${mailFrom()}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      "MIME-Version: 1.0",
      bodyPart,
    ].join("\r\n");
  }

  const parts = [
    `From: ${mailFrom()}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
    "",
    `--${boundaryMixed}`,
    bodyPart,
  ];
  for (const att of list) {
    const content = await attachmentContent(att);
    if (!content) throw new Error("ATTACHMENT_EMPTY");
    const filename = att.filename || "attachment";
    parts.push(
      `--${boundaryMixed}`,
      `Content-Type: ${mimeTypeFor(filename)}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      content.toString("base64")
    );
  }
  parts.push(`--${boundaryMixed}--`);
  return parts.join("\r\n");
}

async function sendViaGmail(message) {
  const gmail = getGmailClient();
  if (!gmail) {
    return {
      sent: false,
      error: "GMAIL_NOT_CONFIGURED: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing",
    };
  }
  const raw = await buildGmailRawMessage(message);
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(raw, "utf8").toString("base64url") },
  });
  return { sent: true };
}

// Returns { sent: true } or { sent: false, error: string }.
// Never throws for a missing or failing mail setup, so callers can
// log a FAILED mail row without failing the user's own action.
// Never includes any secret in the returned error.
export async function sendMail({ to, subject, text, html, attachments }) {
  // Gmail API first, when its refresh token is set. If Gmail itself
  // fails, do NOT fall through to SMTP: the mail may already have
  // been sent, and a second send would deliver it twice.
  if (process.env.GMAIL_REFRESH_TOKEN) {
    try {
      return await sendViaGmail({ to, subject, text, html, attachments });
    } catch (e) {
      const message = e && e.message ? String(e.message) : "MAIL_FAILED";
      return { sent: false, error: message.slice(0, 500) };
    }
  }
  const transport = getTransport();
  if (!transport) {
    return {
      sent: false,
      error:
        "MAIL_NOT_CONFIGURED: set GMAIL_REFRESH_TOKEN (Gmail API) or SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS",
    };
  }
  try {
    await transport.sendMail({
      from: mailFrom(),
      to,
      subject,
      text,
      html,
      attachments: attachments || [],
    });
    return { sent: true };
  } catch (e) {
    const message = e && e.message ? String(e.message) : "MAIL_FAILED";
    return { sent: false, error: message.slice(0, 500) };
  }
}
