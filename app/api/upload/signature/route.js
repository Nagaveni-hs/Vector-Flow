import { getSession } from "@/lib/auth";
import { cloudinarySignature } from "@/lib/upload";
import { ok, fail } from "@/lib/json";

export async function POST(request) {
  const session = getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  const body = await request.json();
  const folder = String(body.folder || "");
  const allowed = ["vector-flow/posters", "vector-flow/qr", "vector-flow/screenshots"];
  if (!allowed.includes(folder)) return fail("INVALID_FILE", 400);
  if ((folder === "vector-flow/posters" || folder === "vector-flow/qr") && session.role !== "ADMIN") {
    return fail("FORBIDDEN", 403);
  }
  try {
    return ok(cloudinarySignature(folder));
  } catch {
    return fail("INVALID_FILE", 500);
  }
}
