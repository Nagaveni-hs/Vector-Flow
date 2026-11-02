import { ok, fail } from "@/lib/json";
import { checkCronSecret } from "@/lib/cron";

// SAFE EMPTY STUB, Sprint 2 only. This route exists so Sprint 4 does
// not forget the mail queue, and so the scheduler job can be set up
// in Sprint 2. It sends NO mail and processes nothing.
export async function GET(request) {
  if (!checkCronSecret(request)) return fail("FORBIDDEN", 403);
  return ok({ processed: 0 });
}
