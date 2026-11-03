/* برنامج العهدة بيفتح من غير نت: بنحفظ نسخة من الصفحة على التليفون.
   لو فيه نت بنجيب الأحدث، ولو مفيش بنفتح المحفوظ. البيانات نفسها مش هنا — دي في localStorage. */
const CACHE = 'custody-dd1c454ffd';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('custody-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.includes('/custody/')) return;   // المزامنة مع جوجل مالهاش دعوة بالكاش
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
