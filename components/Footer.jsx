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
        <p>Building, learning, and creating together at VVCE Mysore.</p>
      </div>
    </footer>
  );
}
