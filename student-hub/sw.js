const CACHE_PREFIX = 'lincoln-student-hub-shell-';
const CACHE_NAME = `${CACHE_PREFIX}skills-england-v8`;
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
  './logo.jpg',
  './careers.html',
  './careers.js',
  './careers.css',
  './career-core.js',
  './skills-england-reference.json',
  './skills-england-logo.svg'
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
    if (!response.ok) {
      const cached = await cache.match(fallbackURL);
      return cached || response;
    }
    await cache.put(fallbackURL, response.clone());
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

  const indexURL = scopedURL('./index.html');
  const rootURL = scopedURL('./');
  const careersURL = scopedURL('./careers.html');
  const referenceURL = scopedURL('./skills-england-reference.json');
  const allowed = shellURLs();

  if (request.mode === 'navigate') {
    url.hash = '';
    url.search = '';
    if (url.href === rootURL || url.href === indexURL) {
      event.respondWith(networkFirst(request, indexURL));
    } else if (url.href === careersURL) {
      event.respondWith(networkFirst(request, careersURL));
    }
    return;
  }

  if (!allowed.has(url.href)) return;
  event.respondWith(url.href === referenceURL
    ? networkFirst(request, referenceURL)
    : cachedAsset(request, url.href));
});
