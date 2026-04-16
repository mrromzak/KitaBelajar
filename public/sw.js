// =====================================================
//  KitaBelajar Service Worker
//  - Push Notifications
//  - PWA Offline Cache (shell + static assets)
// =====================================================

const CACHE_NAME    = 'kitabelajar-v2';
const SHELL_ASSETS  = [
  '/',
  '/belajar-seru.html',
  '/kita-latihan.html',
  '/kita-materi.html',
  '/zep-world.html',
  '/manifest.json',
  '/assets/icon.svg',
  '/assets/maskot.png',
];

// ── Install: pre-cache shell ──────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

// ── Activate: hapus cache lama ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// ── Fetch: Network-first untuk API, Cache-first untuk aset ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Lewati request non-GET, WebSocket, dan API calls (biarkan network handle)
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Untuk font Google, CDN, dsb. → stale-while-revalidate
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Aset lokal → Cache-first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ── Push Notification Handler ─────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { judul: 'KitaBelajar', pesan: event.data ? event.data.text() : 'Ada notifikasi baru!' };
  }

  const title = data.judul || 'KitaBelajar';
  const options = {
    body: data.pesan || 'Ada pesan baru untuk kamu!',
    icon: '/assets/icon.svg',
    badge: '/assets/icon.svg',
    tag: data.tag || 'kitabelajar-notif',
    data: { url: data.url || '/', dari: data.dari || null },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click Handler ────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
