import "./globals.css";
import Header from "@/components/Header";

export const metadata = { title: "Vector Flow" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
