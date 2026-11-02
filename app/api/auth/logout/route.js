import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/json";

export async function POST() {
  const res = NextResponse.json({ ok: true, data: {} });
  res.cookies.set(clearSessionCookie());
  return res;
}
