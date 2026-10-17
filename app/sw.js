// app/sw.js — Service Worker for Quick Art Photography Academy LMS App
const CACHE_NAME = 'qaa-lms-cache-v31';
const STATIC_ASSETS = [
  '/app/',
  '/app/index.html',
  '/app/app.css',
  '/app/app.js',
  '/app/manifest.json',
  '/home-assets/qa-logo-96.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// Push Notification Event Listener (Works even when app is closed)
self.addEventListener('push', (event) => {
  let data = {
    title: '🔴 Your Class is Live Now — Tap to Join',
    body: 'Mentor Anil Sharma is broadcasting live on Quick Art Academy. Tap to join now!',
    url: '/app/?tab=live',
    tag: 'qaa-live-class'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    } catch (_) {
      try {
        data.body = event.data.text() || data.body;
      } catch (_) {}
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/home-assets/ec55a6be3747a9.webp',
    badge: data.badge || '/home-assets/ec55a6be3747a9.webp',
    vibrate: [300, 150, 300, 150, 450],
    tag: data.tag || 'qaa-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/app/?tab=live'
    },
    actions: [
      { action: 'join', title: '🔴 Join Live Now' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler (Directly opens the Live Class)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/app/?tab=live';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing app window is open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes('/app/')) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // If no window is open, open a new window directly into the live class
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Fetch handler: Network-first for dynamic API and cached fallback for app shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for API calls and external video streams
  if (url.pathname.includes('/api/') || url.hostname.includes('mediadelivery.net') || url.hostname.includes('youtube.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/app/index.html');
          }
        });
      })
  );
});
