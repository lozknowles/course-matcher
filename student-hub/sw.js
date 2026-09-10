const CACHE_PREFIX = 'lincoln-student-hub-shell-';
const CACHE_NAME = `${CACHE_PREFIX}final-audit-v3`;
const SHELL_PATHS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './adapter.js',
  './core.js',
  './data.js',
  './manifest.webmanifest',
  './icon.svg',
  './logo.jpg'
];

const scopedURL = path => new URL(path, self.registration.scope).href;
const shellURLs = () => new Set(SHELL_PATHS.map(scopedURL));

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_PATHS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackURL) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(fallbackURL, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackURL);
    if (cached) return cached;
    throw error;
  }
}

async function cachedAsset(request, cacheURL) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheURL);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(cacheURL, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;
  url.hash = '';

  const indexURL = scopedURL('./index.html');
  const rootURL = scopedURL('./');
  const allowed = shellURLs();

  if (request.mode === 'navigate') {
    if (url.href !== rootURL && url.href !== indexURL) return;
    event.respondWith(networkFirst(request, indexURL));
    return;
  }

  if (!allowed.has(url.href)) return;
  event.respondWith(cachedAsset(request, url.href));
});
