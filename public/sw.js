// Simple service worker for the Vector Flow PWA, Sprint 5.
// On install it saves the offline page, so that page is available
// even with no internet. When a page request fails because there
// is no internet, the browser is sent to that saved offline page.
// Signed-in pages, API calls, and uploads are not cached here,
// because they must always be fresh. The worker is only registered
// in a production build, through the layout.
self.addEventListener("install", (event) => {
  // P3 (M12): if caching the offline page fails (for example the
  // dev server is down for a second), the install used to fail and
  // skipWaiting() never ran, so the worker never activated at all.
  // Now a failed cache add is caught and the worker still activates;
  // the offline page is simply fetched again on the next install.
  event.waitUntil(
    caches
      .open("vf-v1")
      .then((cache) =>
        cache.add("/offline").catch((error) => {
          console.error("Could not cache the offline page during install:", error);
        })
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // P3 (M12): delete old vf-* caches from earlier versions, so a
  // user never gets a stale offline page after an update.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("vf-") && key !== "vf-v1")
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async (error) => {
        // m8: any navigation fetch failure means offline for the
        // reader, even when the browser still reports itself
        // online -- navigator.onLine is unreliable and can say
        // "online" while the network is actually down, which used
        // to show a bare browser error instead of the offline page.
        const offlinePage = await caches.match("/offline");
        if (offlinePage) return offlinePage;

        console.error("Offline page is not cached; navigation request failed:", error);
        throw error;
      })
    );
  }
});
