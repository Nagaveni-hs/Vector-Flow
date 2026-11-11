import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

// Shown when a page does not exist. Rendered inside the normal site
// layout, so the header and footer still show.
export default function NotFound() {
  return (
    <div className="page-heading">
      <div style={{ width: "96px", height: "96px" }}>
        <BrandLogo />
      </div>
      <p className="page-eyebrow">404</p>
      <h1>Page not found</h1>
      <p>
        This page does not exist, or it may have moved. Check the address,
        or go back to the home page to find what you were looking for.
      </p>
      <p>
        <Link href="/">Go home</Link> · <Link href="/#upcoming-events">Browse events</Link>
      </p>
    </div>
  );
}
