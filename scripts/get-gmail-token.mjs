// Get a Gmail API refresh token for Vector Flow, once, on the laptop.
// Run:  node scripts/get-gmail-token.mjs
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment
// (the same values already in the local .env for sign-in). It prints
// an auth URL, you open it and sign in as vectorflow@vvce.ac.in,
// paste the code back here, and it prints ONLY the refresh token.
// Put that token in the local .env as GMAIL_REFRESH_TOKEN and restart
// the dev server. The client secret and the access token are never
// printed. Never commit the token, never paste it in chat, never put
// it in Git. This script is local tooling only; the website never
// runs it.
import readline from "node:readline";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectUri = `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`;

if (!clientId || !clientSecret) {
  console.error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. " +
      "Set them in your environment first (they are the same values " +
      "already in your local .env for sign-in), then run this script again."
  );
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: SCOPES,
  access_type: "offline",
  prompt: "consent",
}).toString()}`;

console.log("1. Open this URL in your browser:");
console.log(authUrl);
console.log("");
console.log("2. Sign in as vectorflow@vvce.ac.in (the club account, not your personal account).");
console.log("   Google may show an unverified-app warning, because the app is in Testing mode.");
console.log("   That is expected. Continue, and approve 'Send email on your behalf'.");
console.log("3. Google will send you back to localhost, which will fail to load.");
console.log("   That is expected too. Copy the code from the address bar,");
console.log("   the part after ?code= (up to the next &), and paste it below.");
console.log("");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = await new Promise((resolve) => rl.question("Paste the code here: ", resolve));
rl.close();

if (!code.trim()) {
  console.error("No code pasted. Run the script again.");
  process.exit(1);
}

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code: code.trim(),
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }),
});
const tokens = await tokenRes.json();
if (!tokenRes.ok || !tokens.access_token) {
  console.error("Could not exchange the code for tokens. Google said:");
  console.error(tokens.error_description || tokens.error || "unknown error");
  console.error("Check that you pasted the full code, and that the redirect URI matches the one in Google Cloud.");
  process.exit(1);
}

// Show which account granted the token, without printing the token itself.
let grantedEmail = "";
try {
  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userinfo = await userRes.json();
  grantedEmail = userinfo.email || "";
} catch {
  grantedEmail = "";
}
console.log("");
console.log(`This token was granted by: ${grantedEmail || "(could not read the account)"}`);
if (grantedEmail && grantedEmail.toLowerCase() !== "vectorflow@vvce.ac.in") {
  console.log("WARNING: that is not the club account. Mail would be sent as that account instead.");
  console.log("Run this script again and sign in as vectorflow@vvce.ac.in.");
  process.exit(1);
}

if (!tokens.refresh_token) {
  console.error("Google did not return a refresh token. This happens when the club account");
  console.error("already approved this app before. Fix: open https://myaccount.google.com/permissions");
  console.error("as vectorflow@vvce.ac.in, remove access for 'Vector Flow', then run this script again.");
  process.exit(1);
}

console.log("");
console.log("4. Add this ONE line to your local .env file (no spaces around =), then restart the dev server:");
console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
console.log("");
console.log("Do not share this token, do not paste it in chat, and do not commit the .env file.");
