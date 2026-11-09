import crypto from "crypto";

// Short-lived signed download links for certificates, Sprint 4.
// How it works, in plain words: the download route first checks that
// the person asking is the certificate owner or an admin, and that the
// certificate has been sent. Only then does it make a link that works
// for 10 minutes. The link is a token, made with JWT_SECRET, that says
// which certificate it is for and when it stops working. The file route
// checks that token again before it redirects to the stored file.
// The stored file URL itself is never shown on a public page, and the
// Participation page only shows a Download button after a certificate
// has been sent. Note, honestly: the stored file is still a Cloudinary
// file, so if someone already knows its exact address they could open
// it directly. This token stops the site from handing that address out
// to anyone who should not have it, and it stops old links from working
// after 10 minutes. It does not make the Cloudinary file itself expire.

const LINK_MINUTES = 10;

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function makeDownloadToken(certificateId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const expiresAt = Date.now() + LINK_MINUTES * 60 * 1000;
  const payload = `${certificateId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${base64url(payload)}.${signature}`;
}

export function checkDownloadToken(token, certificateId) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || !token) return false;
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const payload = Buffer.from(parts[0], "base64url").toString("utf8");
    const [id, expiresAt] = payload.split(".");
    if (id !== certificateId) return false;
    if (!expiresAt || Number(expiresAt) < Date.now()) return false;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    // m10: timingSafeEqual throws when the two values differ in
    // length, so check lengths first instead of relying on the
    // try/catch below.
    const sigBuf = Buffer.from(parts[1]);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export function downloadLinkExpiry() {
  return new Date(Date.now() + LINK_MINUTES * 60 * 1000);
}
