import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getSessionUser } from "@/lib/auth";

export const metadata = {
  title: "Vector Flow",
  description: "Official website of Vector Flow, the CSE (AI and ML) club at VVCE Mysore.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#15102f",
};

// Admin redesign: the layout reads the session on the server and
// hands the signed-in user (or null) to the Header, so the first
// paint already shows the right account state — name and Sign out
// for a signed-in user, Sign in for a signed-out one — with no
// signed-out flash in between. Trade-off, stated plainly: reading
// the session cookie here makes every page render on the server
// instead of being prerendered as static HTML. That is the price of
// a flicker-free header, and every page already loads live data
// from the server or the database, so nothing the user sees changes
// except the header no longer flashes.
export default async function RootLayout({ children }) {
  const initialUser = await getSessionUser();
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Header initialUser={initialUser} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
