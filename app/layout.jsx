import "./globals.css";

export const metadata = {
  title: "Vector Flow",
  description: "Vector Flow, the CSE (AI & ML) club at VVCE Mysore.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <strong>Vector Flow</strong> — VVCE, CSE (AI &amp; ML)
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
