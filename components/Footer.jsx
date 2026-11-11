import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Link className="site-footer__brand" href="/" aria-label="Vector Flow home">
          <BrandLogo className="site-footer__logo" />
          <span>
            <strong>Vector Flow</strong>
            <span>VVCE · CSE (AI &amp; ML)</span>
          </span>
        </Link>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link href="/">Home</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/team">Team</Link>
          <Link href="/participation">Participation</Link>
          <a href="mailto:vectorflow@vvce.ac.in">vectorflow@vvce.ac.in</a>
        </nav>
        <p>Building, learning, and creating together at VVCE Mysore.</p>
        <p>© 2026 Vector Flow, VVCE · CSE (AI &amp; ML)</p>
      </div>
    </footer>
  );
}
