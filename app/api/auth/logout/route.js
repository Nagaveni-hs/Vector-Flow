import { NextResponse } from "next/server";
import { bumpTokenVersion, clearSessionCookie, getSession } from "@/lib/auth";
import { ok } from "@/lib/json";

// POST, signed-in or not. Clears the browser cookie and bumps the
// user's token version (M6), so a token copied before logout stops
// working at once instead of staying valid for its 7-day life.
// Bumping first and clearing second: if the bump fails, logout
// still clears the cookie, but the old token is not assumed dead.
export async function POST() {
  const session = await getSession();
  if (session) await bumpTokenVersion(session.userId);
  const res = NextResponse.json({ ok: true, data: {} });
  res.cookies.set(clearSessionCookie());
  return res;
}
