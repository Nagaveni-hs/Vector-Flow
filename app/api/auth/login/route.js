import crypto from "crypto";
import { NextResponse } from "next/server";
import { googleLoginUrl } from "@/lib/auth";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleLoginUrl(state));
  res.cookies.set({
    name: "vf_oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // m2: same secure-in-production flag as the session cookie.
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
  });
  return res;
}
