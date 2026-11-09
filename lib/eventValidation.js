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
  if (body.mode && body.mode !== "ONSITE" && body.mode !== "ONLINE") {
    return "INVALID_FILE";
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
