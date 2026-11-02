import { NextResponse } from "next/server";

export function ok(data, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
