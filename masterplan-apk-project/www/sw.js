importScripts('reminder-core.js');
const CACHE = 'masterplan-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'reminder-core.js', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN = ['https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') { // mạng trước, offline thì dùng bản đã lưu
    e.respondWith(fetch(req).then(r => { caches.open(CACHE).then(c => c.put('index.html', r.clone())); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  if (url.origin === location.origin || CDN_HOSTS.includes(url.hostname)) { // dùng cache ngay, cập nhật ngầm
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

const showReminder = (title, body) => self.registration.showNotification(title, {
  body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
  tag: 'masterplan-daily', renotify: true, data: { url: './' }
});
self.addEventListener('periodicsync', e => {
  if (e.tag === 'masterplan-reminder') e.waitUntil(MP.checkReminders(showReminder));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  })());
});
