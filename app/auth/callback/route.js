import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  exchangeGoogleCode,
  isCollegeEmail,
  sessionCookie,
  signSession,
} from "@/lib/auth";

export async function GET(request) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = cookies().get("vf_oauth_state")?.value;
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/signin?error=NOT_SIGNED_IN`);
  }
  try {
    const userinfo = await exchangeGoogleCode(code);
    if (!isCollegeEmail(userinfo.email)) {
      return NextResponse.redirect(`${appUrl}/signin?error=NOT_COLLEGE_EMAIL`);
    }
    if (userinfo.hd && userinfo.hd !== "vvce.ac.in") {
      return NextResponse.redirect(`${appUrl}/signin?error=NOT_COLLEGE_EMAIL`);
    }
    const user = await prisma.user.upsert({
      where: { email: userinfo.email.toLowerCase() },
      update: { name: userinfo.name || userinfo.email, lastLoginAt: new Date() },
      create: {
        name: userinfo.name || userinfo.email,
        email: userinfo.email.toLowerCase(),
      },
    });
    const token = signSession({ userId: user.id, role: user.role, email: user.email });
    const res = NextResponse.redirect(`${appUrl}/`);
    res.cookies.set(sessionCookie(token));
    res.cookies.set({ name: "vf_oauth_state", value: "", path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return NextResponse.redirect(`${appUrl}/signin?error=NOT_SIGNED_IN`);
  }
}
