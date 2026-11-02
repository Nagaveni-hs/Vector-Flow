"use client";

import { useEffect } from "react";

// Registers the service worker for the PWA, Sprint 5. This only
// runs in the browser, and only in a production build. In local
// development the worker is not used, so the site still works
// normally while you test. The worker itself is in public/sw.js.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
