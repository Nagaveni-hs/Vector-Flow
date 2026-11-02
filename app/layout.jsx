import "./globals.css";
import Header from "@/components/Header";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata = {
  title: "Vector Flow",
  description: "Official website of Vector Flow, the CSE (AI and ML) club at VVCE Mysore.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1f3a",
};

export const viewport = {
  themeColor: "#0b1f3a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
