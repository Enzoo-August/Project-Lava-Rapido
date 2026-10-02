/* Service worker do Lava Rápido
   - permite "instalar" como aplicativo (celular e computador)
   - abre mesmo sem internet (usa a última versão guardada)
   Estratégia: arquivos do app → rede primeiro (sempre pega a versão nova);
   biblioteca externa (Supabase) → cache primeiro.
   Os dados do banco NUNCA passam por aqui: vão sempre direto para a nuvem. */
const CACHE = 'lava-rapido-v2';
const BASE = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/config.js', './js/util.js', './js/catalogo.js', './js/store.js', './js/demo.js', './js/nuvem.js', './js/db.js', './js/app.js',
  './js/telas/balcao.js', './js/telas/entrada.js', './js/telas/patio.js', './js/telas/clientes.js', './js/telas/inicio.js',
  './js/telas/resultados.js', './js/telas/financeiro.js', './js/telas/ajustes.js', './js/telas/admin.js', './js/telas/agenda.js', './js/telas/ajuda.js',
  './c/index.html', './assets/icons/icon-192.png', './assets/icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(BASE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // rede primeiro; sem internet, usa o que está guardado
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match(url.pathname.includes('/c/') ? './c/index.html' : './index.html') : Response.error()))));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
  }
});
