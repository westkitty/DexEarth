import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
// Production-only, finite build manifest. Never caches API/proxy responses or secrets.
export function offlineAssetsPlugin() {
  return {
    name: 'dexearth-offline-assets',
    apply: 'build',
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const root = 'dist'
        function walk(dir) {
          return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
            e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
          )
        }
        const files = walk(root).filter(f => !f.endsWith('.map') && !f.endsWith('sw.js'))
        const hash = createHash('sha256')
        files.forEach(f => hash.update(readFileSync(f)))
        const name = 'dexearth-shell-' + hash.digest('hex').slice(0, 12)
        const urls = files.map(f => '/' + relative(root, f))
        writeFileSync(
          join(root, 'sw.js'),
          `/* Generated offline app assets only. Remote data belongs in IndexedDB. */
const NAME = ${JSON.stringify(name)};
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(NAME);
  const queue = [...URLS];
  await Promise.all(Array.from({length: 6}, async () => { while(queue.length) { const url = queue.pop(); await cache.add(new Request(url, {cache: 'reload'})); } }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('dexearth-shell-') && key !== NAME) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = event.request.mode === 'navigate' ? '/index.html' : url.pathname;
  if (!URLS.includes(path)) return;
  event.respondWith(caches.open(NAME).then(async cache => (await cache.match(path)) || fetch(event.request)));
});
`
        )
      },
    },
  }
}
