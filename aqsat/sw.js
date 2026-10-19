/* أقساط الطنطاوي: الأبلكيشن يفتح من غير نت من نسخة محفوظة على التليفون.
   لو فيه نت بنجيب الأحدث. البيانات نفسها مش هنا — بتيجي من سكربت جوجل وبتتحفظ آخر نسخة منها على التليفون. */
const CACHE = 'aqsat-v6';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('aqsat-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // سكربت جوجل مالوش دعوة بالكاش
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
