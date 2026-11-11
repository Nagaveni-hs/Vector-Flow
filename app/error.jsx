"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page fails to load. Next.js passes `reset`, which
// tries to load the page again. Rendered inside the normal site
// layout, so the header and footer still show.
export default function Error({ error, reset }) {
  // m31: the caught error is logged once, so a page crash leaves a
  // trace for debugging instead of failing silently.
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);
  return (
    <div className="page-heading">
      <p className="page-eyebrow">Error</p>
      <h1>Something went wrong</h1>
      <p>
        This page could not be loaded. It may be a short problem, so
        please try again. If it keeps happening, come back later.
      </p>
      <p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>{" "}
        <Link href="/">Go home</Link>
      </p>
    </div>
  );
}
