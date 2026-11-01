// 離線快取：先用快取開啟，背景再抓新版（下次開啟就是新版）
const CACHE = 'vocab-v1.1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    if (req.mode === 'navigate'){
      // 有網路時先抓最新版（最多等 3 秒），沒網路就用快取
      const net = await Promise.race([
        fetch('./index.html', { cache: 'no-store' }).then(r => (r && r.ok) ? r : null).catch(() => null),
        new Promise(r => setTimeout(() => r(null), 3000))
      ]);
      if (net){ cache.put(key, net.clone()); return net; }
      if (cached) return cached;
    }
    const fresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached){ e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('離線中，請稍後再試', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
