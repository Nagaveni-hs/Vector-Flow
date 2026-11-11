// P1 (M7, M11): shared event validation, used by both the POST
// (create) and PUT (edit) event routes so the two cannot drift apart
// again. Slug rules: lowercase, letters/numbers/dashes only, no
// leading/trailing dash, no double dash. The same normalisation is
// applied on the client in EventForm, but the server is the authority:
// a direct API call with a bad slug is refused, never stored.

// "My Event!" -> "my-event"; "  Test__Slug  " -> "test-slug".
export function normaliseSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// m1 (minors): a datetime string must carry its timezone, or the
// server reads it as its own local time (UTC on Vercel = 5h30 off
// IST). The form always sends +05:30; a direct API caller sending
// a bare "2026-11-10T10:00" is refused with INVALID_DATETIME
// instead of being stored shifted. A Date object (the PUT merge
// carries the stored values as Dates) is already an absolute
// instant, so it passes.
const DATETIME_WITH_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function hasTimezoneOffset(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string") return false;
  return DATETIME_WITH_OFFSET_RE.test(value);
}

// m2 (minors): the enum values an event may carry. Only `mode` was
// checked before; feeType, status and registrationMode passed
// straight to Prisma, where an invalid value surfaced as the
// misleading INVALID_FILE.
const MODES = ["ONSITE", "ONLINE"];
const FEE_TYPES = ["FREE", "PAID"];
const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"];
const REGISTRATION_MODES = ["SITE", "EXTERNAL"];

function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

// Returns an error code string, or null when the body is valid.
// Error codes reuse the ones the event form already understands:
// INVALID_FILE for bad/missing fields, PAYMENT_REQUIRED for a paid
// event missing payment details.
export function validateEvent(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const slug = normaliseSlug(body.slug);
  if (!title || !description || !body.startAt) {
    return "INVALID_FILE";
  }
  // m10: length caps, so a huge title or description cannot be
  // stored unchecked.
  if (title.length > 200 || description.length > 5000) return "INVALID_FILE";
  // A slug was typed but nothing usable is left after normalising
  // ("!!!", "---") is an invalid slug, not a missing one.
  if (!slug) return body.slug ? "INVALID_SLUG" : "INVALID_FILE";
  if (!SLUG_RE.test(slug) || slug.length > 100) {
    return "INVALID_SLUG";
  }
  // m17: mode is only ever ONSITE or ONLINE; the API used to accept
  // any string the form never sends.
  if (body.mode && !MODES.includes(body.mode)) {
    return "INVALID_MODE";
  }
  // m2 (minors): feeType, status and registrationMode are enums too.
  // Each gets its own code, so a bad value is named instead of
  // surfacing as the misleading INVALID_FILE from the Prisma catch.
  // Absent values are fine: the routes apply their defaults.
  if (body.feeType && !FEE_TYPES.includes(body.feeType)) {
    return "INVALID_FEE_TYPE";
  }
  if (body.status && !EVENT_STATUSES.includes(body.status)) {
    return "INVALID_STATUS";
  }
  if (body.registrationMode && !REGISTRATION_MODES.includes(body.registrationMode)) {
    return "INVALID_REGISTRATION_MODE";
  }
  // m1 (minors): every datetime must carry a timezone offset (or be
  // an already-stored Date on the PUT merge). A bare wall-clock
  // string is refused, not silently read as server-local time.
  for (const field of ["startAt", "endAt", "registrationOpensAt", "registrationClosesAt"]) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== "" && !hasTimezoneOffset(value)) {
      return "INVALID_DATETIME";
    }
  }
  if (!isValidDate(body.startAt)) return "INVALID_FILE";
  if (body.endAt && !isValidDate(body.endAt)) return "INVALID_FILE";
  if (body.endAt && new Date(body.endAt) <= new Date(body.startAt)) {
    return "INVALID_FILE";
  }
  if (body.registrationOpensAt && !isValidDate(body.registrationOpensAt)) {
    return "INVALID_FILE";
  }
  if (body.registrationClosesAt && !isValidDate(body.registrationClosesAt)) {
    return "INVALID_FILE";
  }
  if (
    body.registrationOpensAt &&
    body.registrationClosesAt &&
    new Date(body.registrationClosesAt) <= new Date(body.registrationOpensAt)
  ) {
    return "INVALID_FILE";
  }
  // m18: registration must close by the time the event starts, or
  // a student could register after it has already begun.
  if (
    body.registrationClosesAt &&
    new Date(body.registrationClosesAt) > new Date(body.startAt)
  ) {
    return "INVALID_FILE";
  }
  // m16: a fee amount is only meaningful on a PAID event, and it
  // must never be negative. A FREE event keeps feeAmount null (the
  // routes force that); here any negative amount is refused.
  if (body.feeAmount !== undefined && body.feeAmount !== null && body.feeAmount !== "") {
    const fee = Number(body.feeAmount);
    if (!Number.isFinite(fee) || fee < 0) return "INVALID_FILE";
    // m10: upper bound, so a typo cannot store a nonsense fee.
    if (fee > 100000) return "INVALID_FILE";
  }
  if (body.feeType === "PAID") {
    const amount = Number(body.feeAmount);
    if (!Number.isInteger(amount) || amount <= 0) return "PAYMENT_REQUIRED";
    if (!body.paymentReceiverName || !body.paymentReceiverContact || !body.paymentQrImageUrl) {
      return "PAYMENT_REQUIRED";
    }
  }
  if (body.registrationMode === "EXTERNAL" && !body.externalRegistrationUrl) {
    return "INVALID_FILE";
  }
  // m10: an external registration link must be a real http(s) URL,
  // like the payment screenshot URL already is, and within a sane length.
  if (body.externalRegistrationUrl) {
    const u = String(body.externalRegistrationUrl);
    if (!u.startsWith("http://") && !u.startsWith("https://")) return "INVALID_FILE";
    if (u.length > 2000) return "INVALID_FILE";
  }
  return null;
}
