/**
 * iList Service Worker v3.0
 * Estratégia híbrida: Stale-While-Revalidate (SWR) para assets
 * Network First com fallback para páginas
 * Offline-first para dados críticos
 */

const CACHE_VERSION = 'ilist-v3';
const CACHE_ASSETS = `${CACHE_VERSION}-assets`;
const CACHE_PAGES = `${CACHE_VERSION}-pages`;
const CACHE_API = `${CACHE_VERSION}-api`;

const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/player.js',
  './assets/js/pwa.js',
  './assets/js/categories.js',
  './assets/js/backup.js',
  './assets/js/ad-blocker.js',
  './assets/js/search-advanced.js',
  './assets/js/sidebar.js',
  './assets/js/equalizer.js'
];

const ASSET_EXTENSIONS = ['.css', '.js', '.woff2', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
const API_PATTERNS = ['youtube.com', 'googleapis.com', 'oembed'];
const NETWORK_ONLY = ['youtube.com/embed', 'youtu.be', 'googlevideo.com'];

// ─────────────────────────────────────────────────────────────────
// INSTALL
// ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      try {
        // Cachear assets críticos
        const cache = await caches.open(CACHE_ASSETS);
        await cache.addAll(CRITICAL_ASSETS);
        console.log('[SW] Critical assets cached');
      } catch (err) {
        console.error('[SW] Install error:', err);
      }
    })()
  );
});

// ─────────────────────────────────────────────────────────────────
// ACTIVATE
// ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const toDelete = cacheNames.filter(
        name => !name.includes(CACHE_VERSION)
      );

      await Promise.all(toDelete.map(name => {
        console.log(`[SW] Deleting old cache: ${name}`);
        return caches.delete(name);
      }));

      return self.clients.claim();
    })()
  );
});

// ─────────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1️⃣ NETWORK ONLY — Never cache
  if (NETWORK_ONLY.some(pattern => url.href.includes(pattern))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2️⃣ API CALLS — Network first with long cache
  if (API_PATTERNS.some(pattern => url.href.includes(pattern))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const cache = caches.open(CACHE_API);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3️⃣ STATIC ASSETS — Stale While Revalidate
  if (ASSET_EXTENSIONS.some(ext => url.pathname.includes(ext))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ASSETS);
        const cached = await cache.match(request);

        // Servir do cache imediatamente
        const fetchPromise = fetch(request)
          .then(response => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached || createOfflineAsset(request.url));

        return cached || fetchPromise;
      })()
    );
    return;
  }

  // 4️⃣ HTML PAGES — Network first, fallback to cache
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const cache = caches.open(CACHE_PAGES);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('./index.html'))
            .then(response => {
              if (response) return response;
              return createOfflinePageFallback();
            });
        })
    );
    return;
  }

  // 5️⃣ DEFAULT — Network with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const cache = caches.open(CACHE_ASSETS);
          cache.then(c => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request)
          .catch(() => createOfflineResponse(request.url));
      })
  );
});

// ─────────────────────────────────────────────────────────────────
// OFFLINE FALLBACKS
// ─────────────────────────────────────────────────────────────────

function createOfflinePageFallback() {
  return new Response(
    `<!DOCTYPE html>
     <html lang="pt-BR">
     <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>iList — Offline</title>
       <style>
         * { margin: 0; padding: 0; box-sizing: border-box; }
         body {
           background: #060B14;
           color: #f1f5f9;
           font-family: 'Syne', sans-serif;
           display: flex;
           align-items: center;
           justify-content: center;
           min-height: 100vh;
           padding: 20px;
         }
         .offline-box {
           text-align: center;
           max-width: 400px;
           background: #0B1623;
           border: 1px solid rgba(255,153,0,0.12);
           border-radius: 20px;
           padding: 40px 30px;
           box-shadow: 0 4px 32px rgba(0,0,0,0.5);
         }
         .offline-icon {
           font-size: 64px;
           margin-bottom: 20px;
           animation: pulse 2s infinite;
         }
         h1 {
           font-size: 24px;
           font-weight: 800;
           margin-bottom: 12px;
           letter-spacing: -0.5px;
         }
         p {
           font-size: 14px;
           color: #94a3b8;
           line-height: 1.6;
           margin-bottom: 24px;
         }
         .offline-tips {
           background: rgba(255,153,0,0.05);
           border-left: 3px solid #FF9900;
           padding: 12px;
           border-radius: 6px;
           text-align: left;
           font-size: 12px;
           color: #cbd5e1;
           margin-bottom: 20px;
         }
         .offline-tips strong {
           color: #FF9900;
           display: block;
           margin-bottom: 8px;
         }
         button {
           background: linear-gradient(135deg, #FF9900, #f59e0b);
           color: #000;
           border: none;
           padding: 12px 24px;
           border-radius: 8px;
           font-size: 14px;
           font-weight: 800;
           cursor: pointer;
           transition: all 0.2s;
         }
         button:hover {
           transform: translateY(-2px);
           box-shadow: 0 6px 20px rgba(255,153,0,0.3);
         }
         @keyframes pulse {
           0%, 100% { opacity: 0.8; }
           50% { opacity: 1; }
         }
       </style>
     </head>
     <body>
       <div class="offline-box">
         <div class="offline-icon">📡</div>
         <h1>Você está offline</h1>
         <p>Não conseguimos conectar à internet. Seus dados estão salvos localmente.</p>
         <div class="offline-tips">
           <strong>✓ Você pode:</strong>
           • Ver sua playlist salva<br>
           • Usar categorias<br>
           • Acessar histórico
         </div>
         <button onclick="location.reload()">🔄 Tentar novamente</button>
       </div>
     </body>
     </html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

function createOfflineAsset(url) {
  if (url.includes('.css')) {
    return new Response('/* Offline fallback CSS */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  if (url.includes('.js')) {
    return new Response('console.log("[SW] Offline: JS asset not available");', {
      headers: { 'Content-Type': 'application/javascript' }
    });
  }
  return new Response('', { status: 404 });
}

function createOfflineResponse(url) {
  if (url.includes('/api/') || url.includes('youtube.com')) {
    return new Response(JSON.stringify({ offline: true, error: 'No network connection' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response('Offline', { status: 503 });
}

// ─────────────────────────────────────────────────────────────────
// BACKGROUND SYNC (future feature)
// ─────────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-playlist') {
    event.waitUntil(syncPlaylist());
  }
});

async function syncPlaylist() {
  try {
    const response = await fetch('./');
    console.log('[SW] Playlist synced');
    return response;
  } catch (err) {
    console.log('[SW] Sync failed (expected offline)', err);
  }
}

console.log('[SW] iList Service Worker v3.0 loaded');
