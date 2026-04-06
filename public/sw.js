// =====================================================
//  KitaBelajar Service Worker — Push Notifications
//  File: public/sw.js
// =====================================================

const CACHE_NAME = 'kitabelajar-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
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
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-96.png',
    tag: data.tag || 'kitabelajar-notif',
    data: { url: data.url || '/', dari: data.dari || null },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click Handler ────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Coba fokus ke tab yang sudah terbuka
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Kalau tidak ada tab yang terbuka, buka tab baru
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Background Sync (opsional, untuk kirim pesan saat online kembali) ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    // Handled by the main app
  }
});
