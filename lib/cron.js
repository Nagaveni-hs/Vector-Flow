import crypto from "crypto";

// Shared by both cron routes: compare in constant time, never log the
// secret, and refuse outright when no secret is configured at all, so
// a cron job can never run unprotected by accident.
export function checkCronSecret(request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const provided = request.headers.get("x-cron-secret") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
