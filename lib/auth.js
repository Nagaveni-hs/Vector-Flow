import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/json";

const COOKIE = "vf_session";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function base64urlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signSession(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export async function verifySession(token) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || !token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    // m1: the header is checked, not trusted. Only tokens this app
    // signs (alg HS256) are accepted, and a token with no expiry is
    // rejected outright instead of living forever.
    const headerObj = JSON.parse(base64urlDecode(header));
    if (!headerObj || headerObj.alg !== "HS256") return null;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");
    // m10: timingSafeEqual throws when the two values differ in
    // length, so check lengths first (the try/catch below used to
    // be the only thing saving this call).
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    // M6: a token is only valid while its tokenVersion matches the
    // user row in the DB. Logout and role changes bump the stored
    // version, so a copied or old token stops working at once, even
    // though its 7-day expiry has not passed. A token issued before
    // tokenVersion existed carries no version, which counts as 0,
    // the DB default, so existing sessions keep working until the
    // next logout or role change.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    });
    if (!user) return null;
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = cookies().get(COOKIE)?.value;
  return verifySession(token);
}

// Admin redesign: the signed-in user for the root layout, so the
// Header can render with the right account state on the first paint
// instead of flashing the signed-out links while /api/auth/me loads.
// Same checks as getSession() (signature, expiry, tokenVersion),
// plus one DB read for the display name and role — the same read
// /api/auth/me already does on every navigation. Returns null when
// nobody is signed in. Display only: every admin page and API still
// re-checks the role server-side, so a wrong or stale prop here can
// never open anything.
export async function getSessionUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// M6: bump the stored token version for one user, invalidating every
// token issued to them so far. Called on logout, and must be called
// by any code that changes a user's role (there is no in-app
// role-change route today -- roles are set directly in the database
// by the site owner, so a role change done there must bump this
// column in the same step, or sign the user out and back in).
// Returns true when the bump was written; false when the user row
// could not be updated, in which case the caller must not assume
// the old token is dead.
export async function bumpTokenVersion(userId) {
  if (!userId) return false;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return true;
  } catch {
    return false;
  }
}

export function sessionCookie(value) {
  return {
    name: COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  };
}

export function clearSessionCookie() {
  // P0 (B4): a cookie must be cleared with the same attributes it was
  // set with, or the browser may keep the old one in production.
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

// P0 (B3): admin check that re-reads the role from the DB on every
// call, instead of trusting the role baked into the JWT at sign-in.
// A user promoted or demoted in Neon takes effect at once, with no
// sign-out / sign-in needed. Returns { error } on failure, exactly
// like the old per-file requireAdmin() helpers, so call sites only
// change from requireAdmin() to await requireAdmin().
export async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: fail("NOT_SIGNED_IN", 401) };
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  if (!user) return { error: fail("NOT_SIGNED_IN", 401) };
  if (user.role !== "ADMIN") return { error: fail("FORBIDDEN", 403) };
  return { session, user };
}

export function isCollegeEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@vvce.ac.in");
}

export function googleLoginUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) {
    throw new Error("GOOGLE_TOKEN_FAILED");
  }
  // m5: second check on the ID token Google returned with the code.
  // It came over TLS from Google's token endpoint with our client
  // secret, and its claims must still say it was issued to this app
  // (aud), by Google (iss), and has not expired (exp). A token that
  // fails any of these is refused before any user is created.
  // m11 (minors): when Google returns no id_token, the aud/iss/exp
  // checks below are skipped, so the userinfo response must be
  // verified properly instead -- and the gap is logged, not silent.
  // The id_token path is unchanged: a token that fails any check
  // is still refused before any user is created.
  const hasIdToken = Boolean(tokens.id_token);
  if (!hasIdToken) {
    console.warn(
      "Google sign-in returned no id_token; verifying the userinfo response only."
    );
  }
  if (tokens.id_token) {
    const idParts = String(tokens.id_token).split(".");
    if (idParts.length !== 3) throw new Error("GOOGLE_TOKEN_FAILED");
    const idPayload = JSON.parse(base64urlDecode(idParts[1]));
    const issuers = ["https://accounts.google.com", "accounts.google.com"];
    if (
      idPayload.aud !== process.env.GOOGLE_CLIENT_ID ||
      !issuers.includes(idPayload.iss) ||
      !idPayload.exp ||
      idPayload.exp < Math.floor(Date.now() / 1000)
    ) {
      throw new Error("GOOGLE_TOKEN_FAILED");
    }
  }
  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userinfo = await userRes.json();
  if (!userRes.ok || !userinfo.email) {
    throw new Error("GOOGLE_USERINFO_FAILED");
  }
  if (!hasIdToken) {
    // m11 (minors): with no id_token there is nothing corroborating
    // this response, so the same rules the callback enforces before
    // creating a user are checked here too: the email must be a
    // verified college address on the vvce.ac.in domain.
    if (
      !isCollegeEmail(userinfo.email) ||
      userinfo.email_verified !== true ||
      (userinfo.hd && userinfo.hd !== "vvce.ac.in")
    ) {
      throw new Error("GOOGLE_USERINFO_FAILED");
    }
  }
  return userinfo;
}
