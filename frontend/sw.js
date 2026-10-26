// Service worker: deixa o app abrir sem internet. A API nunca passa pelo cache.
const CACHE = 'qop-shell-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(chaves => Promise.all(chaves.filter(c => c !== CACHE).map(c => caches.delete(c))))
            .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

    // Rede primeiro (sempre a versão nova); sem rede, usa o que está guardado.
    e.respondWith(
        fetch(req).then(resp => {
            if (resp.ok) {
                const copia = resp.clone();
                caches.open(CACHE).then(c => c.put(req, copia));
            }
            return resp;
        }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error())));
});
