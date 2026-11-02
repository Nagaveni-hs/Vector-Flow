// Simple service worker for the Vector Flow PWA, Sprint 5.
// On install it saves the offline page, so that page is available
// even with no internet. When a page request fails because there
// is no internet, the browser is sent to that saved offline page.
// Signed-in pages, API calls, and uploads are not cached here,
// because they must always be fresh. The worker is only registered
// in a production build, through the layout.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("vf-v1").then((cache) => cache.add("/offline"))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline"))
    );
  }
});
