import { getSession } from "@/lib/auth";
import { cloudinarySignature } from "@/lib/upload";
import { ok, fail } from "@/lib/json";

export async function POST(request) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const body = await request.json();
  const folder = String(body.folder || "");
  const allowed = [
    "vector-flow/posters",
    "vector-flow/qr",
    "vector-flow/screenshots",
    "vector-flow/certificates",
    "vector-flow/team",
  ];
  if (!allowed.includes(folder)) return fail("INVALID_FILE", 400);
  // Certificates and team photos are admin-only folders, like posters
  // and QR images. Payment screenshots stay open to any signed-in
  // student, because students must be able to upload their own.
  if (folder !== "vector-flow/screenshots" && session.role !== "ADMIN") {
    return fail("FORBIDDEN", 403);
  }
  try {
    return ok(cloudinarySignature(folder));
  } catch {
    return fail("INVALID_FILE", 500);
  }
}
