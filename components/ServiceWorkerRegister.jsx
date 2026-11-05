"use client";

import { useEffect } from "react";

// The PWA service worker is registered in production only. In
// development, remove this app's existing worker so it cannot
// interfere with local navigation. The worker itself is public/sw.js.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const workerUrl = new URL("/sw.js", window.location.origin).href;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistration("/")
        .then((registration) => {
          const scriptUrl =
            registration?.active?.scriptURL ||
            registration?.installing?.scriptURL ||
            registration?.waiting?.scriptURL;
          if (scriptUrl === workerUrl) return registration.unregister();
          return undefined;
        })
        .catch((error) => {
          console.error("Could not remove the Vector Flow service worker in development.", error);
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Could not register the Vector Flow service worker.", error);
    });
  }, []);
  return null;
}
