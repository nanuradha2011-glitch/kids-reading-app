// Minimal service worker, present only so the browser will treat this
// app as installable ("Add to Home Screen").
//
// It deliberately does NOT cache anything. This app's content (stories,
// news, quizzes) changes often, and a caching service worker is the
// classic way a PWA ends up showing kids stale/old content after an
// update ships. Every request just passes straight through to the
// network, exactly as if there were no service worker at all.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
