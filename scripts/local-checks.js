// Sprint 6 local checks script. Run it after npm run dev is up,
// in a second terminal, with: node scripts/local-checks.js
// It only checks the public pages that need no login, plus the
// admin and cron refusal behaviour that needs no secret. It does
// NOT check mail sending, because mail needs a real SMTP password,
// and it does NOT claim anything about production, because this
// site is not deployed yet. A FAIL here means the local server
// is not running, or a route is broken. A PASS here does not
// mean the full manual checklist in TEST-CHECKLIST.md passed.
const BASE = process.env.APP_URL || "http://localhost:3000";

async function check(name, path, expected) {
  try {
    const res = await fetch(`${BASE}${path}`);
    const ok = expected.includes(res.status);
    console.log(`${ok ? "PASS" : "FAIL"} - ${name} - got ${res.status}, expected one of ${expected.join(", ")}`);
    return ok;
  } catch (e) {
    console.log(`FAIL - ${name} - could not reach the server. Is npm run dev running?`);
    return false;
  }
}

// P0: fetch() follows redirects by default, so this one asks for the
// redirect itself (redirect: "manual") and checks the status and the
// Location header, instead of the final page after following it.
async function checkRedirect(name, path, expectedStatus, expectedLocation) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const location = res.headers.get("location") || "";
    const ok =
      res.status === expectedStatus &&
      (expectedLocation === "" || location.endsWith(expectedLocation));
    console.log(
      `${ok ? "PASS" : "FAIL"} - ${name} - got ${res.status} -> ${location}, expected ${expectedStatus} -> ${expectedLocation}`
    );
    return ok;
  } catch (e) {
    console.log(`FAIL - ${name} - could not reach the server. Is npm run dev running?`);
    return false;
  }
}

async function main() {
  let all = true;
  all = (await check("Public events list", "/api/events", [200])) && all;
  all = (await check("Gallery list", "/api/gallery", [200])) && all;
  all = (await check("Team list", "/api/team", [200])) && all;
  all = (await check("Sign-in check, signed out is 401", "/api/auth/me", [401])) && all;
  all = (await check("Admin list, signed out is 401 or 403", "/api/admin/events", [401, 403])) && all;
  all = (await check("Cron queue without secret is 403", "/api/cron/process-mail-queue", [403])) && all;
  all = (await check("Cron reminders without secret is 403", "/api/cron/reminders", [403])) && all;
  // P0 middleware checks, signed out (no cookies are sent here, so
  // the server sees a signed-out visitor): /admin must redirect to
  // /signin, /participation must redirect to /signin, and /signin
  // itself must still load (200) for a signed-out visitor.
  all = (await checkRedirect("Admin page, signed out redirects to sign-in", "/admin", 307, "/signin")) && all;
  all = (await checkRedirect("Participation page, signed out redirects to sign-in", "/participation", 307, "/signin")) && all;
  all = (await check("Sign-in page, signed out loads", "/signin", [200])) && all;
  console.log(all ? "All local checks passed." : "Some local checks failed. See above.");
  process.exit(all ? 0 : 1);
}

main();
