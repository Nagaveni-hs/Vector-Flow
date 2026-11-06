// P0 (B1/B2): the auth guard that did not exist anywhere in the repo.
// Runs in the Edge runtime, so it cannot import lib/auth.js (Node-only:
// node:crypto, Buffer, next/headers). It therefore verifies the same
// HS256 vf_session JWT with WebCrypto, using the same token format
// lib/auth.js signs (header.payload.signature, exp in seconds).
// - Signed-in user opening /signin -> / (fixes the screenshot bug:
//   the Header knew you were signed in while the page showed Sign in).
// - Signed-out user opening /admin/* -> /signin.
// - Signed-in non-admin opening /admin/* -> / (role here is the JWT
//   claim; the DB role is re-checked by requireAdmin() in every admin
//   API and by the admin layout, so a demotion still bites at once).
// - Signed-out user opening /participation -> /signin.
// Pages and APIs stay responsible for their own checks; this is the
// redirect layer only, never the only check.
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "vf_session";

function base64urlToBytes(input) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64urlToText(input) {
  return new TextDecoder().decode(base64urlToBytes(input));
}

// Returns the JWT payload, or null when there is no valid session.
// Any failure (missing secret, bad shape, bad signature, expired)
// means "not signed in" — never an exception out of middleware.
async function verifySessionEdge(token) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || !token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(signature),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(base64urlToText(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionEdge(request.cookies.get(COOKIE)?.value);

  if (pathname === "/signin" && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname.startsWith("/admin")) {
    if (!session) return NextResponse.redirect(new URL("/signin", request.url));
    if (session.role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/participation" && !session) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/signin", "/admin/:path*", "/participation"],
};
