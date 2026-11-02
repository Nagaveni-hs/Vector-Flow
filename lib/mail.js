import nodemailer from "nodemailer";

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

// Returns { sent: true } or { sent: false, error: string }.
// Never throws for a missing or failing mail setup, so callers can
// log a FAILED mail row without failing the user's own action.
// Never includes any secret in the returned error.
export async function sendMail({ to, subject, text, html, attachments }) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, error: "MAIL_NOT_CONFIGURED" };
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
