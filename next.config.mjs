/** @type {import('next').NextConfig} */
const nextConfig = {
  // P3 (M13): security headers on every page. The Content-Security-
  // Policy is deliberately permissive where Next.js and Google
  // sign-in need it, and strict everywhere else:
  // - 'unsafe-inline' for scripts/styles: Next.js inlines small
  //   scripts and styles of its own; without it the site breaks.
  // - accounts.google.com / oauth2.googleapis.com: Google sign-in
  //   is a redirect to accounts.google.com, and the callback exchanges
  //   the code at oauth2.googleapis.com (server-side, listed here so
  //   a browser fetch to it is never blocked by mistake).
  // - res.cloudinary.com: event posters, QR codes, screenshots and
  //   certificate files are served from Cloudinary.
  // - frame-ancestors 'none' (plus X-Frame-Options DENY): no page
  //   of this site may be framed by another site. Google sign-in
  //   does not use an iframe, it redirects, so this does not break
  //   sign-in.
  // - object-src 'none', base-uri 'self': no plugins, no base hijack.
  async headers() {
    // P3 fix: Next.js development mode runs its own code with eval
    // (webpack hot reload / fast refresh). A CSP without 'unsafe-eval'
    // blocks that, so NO client JavaScript runs at all in dev: the
    // header never shows the signed-in user and the Participation
    // page stays on "Loading..." forever, even though the server
    // and the APIs answer fine. Production builds do not use eval,
    // so 'unsafe-eval' is added only outside production.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://accounts.google.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://res.cloudinary.com https://api.cloudinary.com",
      "font-src 'self' data:",
      "frame-src https://accounts.google.com https://res.cloudinary.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
