import nodemailer from "nodemailer";

// Mail for Vector Flow, Sprint 2 only: registration, announcement, reminder.
// No payment-verified, payment-rejected, or certificate mail is sent here;
// those are Sprint 3 / Sprint 4 work and are not wired in this file.
// Every value that could be a secret comes from environment variables only.
// Nothing here contains a password, a host credential, or a connection string.

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
export async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, error: "MAIL_NOT_CONFIGURED" };
  }
  try {
    await transport.sendMail({ from: mailFrom(), to, subject, text, html });
    return { sent: true };
  } catch (e) {
    const message = e && e.message ? String(e.message) : "MAIL_FAILED";
    return { sent: false, error: message.slice(0, 500) };
  }
}
