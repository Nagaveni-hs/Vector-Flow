import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function Footer() {
  return (
    <footer className="site-footer">
      {/* Footer-only styles: the footer sits on a dark background, so
          its links need light colours, unlike the blue links on the
          light pages. Kept here, next to the markup, so no shared
          stylesheet has to change for the footer. */}
      <style>{`
        .site-footer__nav {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 20px;
        }
        .site-footer__nav a {
          color: rgb(235 232 255 / 85%);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
        }
        .site-footer__nav a:hover {
          color: #fff;
          text-decoration: underline;
        }
      `}</style>
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
      </div>
    </footer>
  );
}
