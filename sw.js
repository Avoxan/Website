/* Avoxan self-destruct service worker.
   The current site uses no service worker. This file exists only to
   neutralize any old service worker still registered in returning
   browsers: it skips waiting, deletes every cache, unregisters itself,
   and reloads open tabs so they pull fresh assets from the network. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) {}
  })());
});

/* Never serve from an old cache: always go to the network. */
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
