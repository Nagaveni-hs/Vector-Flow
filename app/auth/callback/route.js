import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  exchangeGoogleCode,
  getSession,
  isCollegeEmail,
  sessionCookie,
  signSession,
} from "@/lib/auth";

// P0 (M4): the vf_oauth_state cookie is now cleared on EVERY exit
// path, not only on success, so a stale state value can never strand
// a later sign-in attempt. And on any failure, a user who already has
// a valid session is sent to Home, not dumped on the sign-in page.
function redirectWithClearedState(url) {
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: "vf_oauth_state",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // m2: a clearing cookie must carry the same attributes as the
    // cookie it clears, including secure in production.
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}

export async function GET(request) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = cookies().get("vf_oauth_state")?.value;
  if (!code || !state || state !== savedState) {
    if (await getSession()) return redirectWithClearedState(`${appUrl}/`);
    return redirectWithClearedState(`${appUrl}/signin?error=NOT_SIGNED_IN`);
  }
  try {
    const userinfo = await exchangeGoogleCode(code);
    if (!isCollegeEmail(userinfo.email)) {
      if (await getSession()) return redirectWithClearedState(`${appUrl}/`);
      return redirectWithClearedState(`${appUrl}/signin?error=NOT_COLLEGE_EMAIL`);
    }
    // m5: Google must confirm this email address is verified before
    // a user row is created from it.
    if (userinfo.email_verified !== true) {
      if (await getSession()) return redirectWithClearedState(`${appUrl}/`);
      return redirectWithClearedState(`${appUrl}/signin?error=NOT_SIGNED_IN`);
    }
    if (userinfo.hd && userinfo.hd !== "vvce.ac.in") {
      if (await getSession()) return redirectWithClearedState(`${appUrl}/`);
      return redirectWithClearedState(`${appUrl}/signin?error=NOT_COLLEGE_EMAIL`);
    }
    const user = await prisma.user.upsert({
      where: { email: userinfo.email.toLowerCase() },
      update: { name: userinfo.name || userinfo.email, lastLoginAt: new Date() },
      create: {
        name: userinfo.name || userinfo.email,
        email: userinfo.email.toLowerCase(),
      },
    });
    const token = signSession({ userId: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion ?? 0 });
    const res = NextResponse.redirect(`${appUrl}/`);
    res.cookies.set(sessionCookie(token));
    res.cookies.set({
      name: "vf_oauth_state",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // m2: same secure-in-production flag as when the state cookie
      // was set, or the browser may keep the old one.
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
    return res;
  } catch (e) {
    if (await getSession()) return redirectWithClearedState(`${appUrl}/`);
    return redirectWithClearedState(`${appUrl}/signin?error=NOT_SIGNED_IN`);
  }
}
