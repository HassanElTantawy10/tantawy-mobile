#!/usr/bin/env python3
"""يجمّع البرنامج: src/* ← budget/index.html + budget/sw.js + budget/apps-script/Code.gs"""
import hashlib, os, re, datetime
H = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(H)
rd = lambda p: open(os.path.join(H, p), encoding='utf8').read()
core, css, logo = rd('core.js'), rd('app.css'), rd('logo.b64').strip()
app = '\n'.join(rd(f) for f in ['app1.js', 'app2.js', 'app3.js', 'app4.js'])
ver = datetime.datetime.now().strftime('%Y.%m.%d')
js = core + '\n' + app.replace('__LOGO__', logo)
h = hashlib.sha1((css + js).encode()).hexdigest()[:10]
js = js.replace('__VER__', ver + '-' + h[:4])
html = rd('index.tpl.html').replace('/*CSS*/', css).replace('/*JS*/', js)
open(os.path.join(B, 'index.html'), 'w', encoding='utf8').write(html)
sw = f"""/* البرنامج يفتح من غير نت: نسخة من الصفحة على الجهاز. لو فيه نت بنجيب الأحدث. البيانات نفسها في localStorage. */
const CACHE = 'budget-{h}';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); }});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('budget-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
}});
self.addEventListener('fetch', e => {{
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.includes('/budget/')) return;   // المزامنة مع جوجل مالهاش دعوة بالكاش
  e.respondWith(fetch(e.request).then(r => {{
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }}).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
}});
"""
open(os.path.join(B, 'sw.js'), 'w', encoding='utf8').write(sw)
os.makedirs(os.path.join(B, 'apps-script'), exist_ok=True)
gs = rd('server.js') + '\n\n' + core
open(os.path.join(B, 'apps-script', 'Code.gs'), 'w', encoding='utf8').write(gs)
print('built', ver, h, len(html)//1024, 'KB html', len(gs)//1024, 'KB gs')
