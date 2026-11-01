// Minimale service worker: nodig om de app te kunnen installeren. Cachet niets, de krant is altijd vers.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
