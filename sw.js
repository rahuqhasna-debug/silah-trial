// نسخة التجربة: كاش منفصل. البيانات (supabase) دايمًا من النت.
const CACHE = 'selah-trial-v1';
const FILES = ['./', 'index.html', 'admin.html', 'teacher.html', 'common.js', 'common.css', 'config.js', 'manifest.json', 'teacher.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('selah-trial') && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // supabase/cdn: network
  // network-first عشان التحديثات توصل على طول
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
