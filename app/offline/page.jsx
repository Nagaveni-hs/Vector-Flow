"use client";

import Link from "next/link";

// M10: the service worker only caches this page's HTML, never the
// built CSS, so the offline page carries its own minimal inline
// styles instead of depending on globals.css. It also gives the
// reader a way back: a Try again button (reloads the page) and a
// link home.
export default function Offline() {
  return (
    <div>
      <style>{`
        .offline-page { font-family: system-ui, sans-serif; max-width: 560px; margin: 48px auto; padding: 0 20px; color: #1a1a2e; line-height: 1.6; }
        .offline-page h1 { font-size: 28px; margin-bottom: 12px; }
        .offline-page p { margin: 0 0 12px; }
        .offline-page button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
        .offline-page a { color: #1a3a8a; }
      `}</style>
      <div className="offline-page">
        <h1>You are offline</h1>
        <p>
          The Vector Flow site needs the internet to load events, sign in,
          and register. Please check your connection and try again.
        </p>
        <p>
          If you were reading a page before, you can go back and try to
          reload it once you are back online.
        </p>
        <p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>{" "}
          <Link href="/">Back to Vector Flow home</Link>
        </p>
      </div>
    </div>
  );
}
