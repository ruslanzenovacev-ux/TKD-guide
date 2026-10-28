/* Сервис-воркер: офлайн + автообновление. Версия подставляется при сборке. */
const V = "tkd-0.21.1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(["./", "index.html", "manifest.webmanifest", "icon-192.png"]).catch(() => {}))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== "tkd-video" && k !== "tkd-media").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const pu = new URL(e.request.url);
  if (pu.pathname.includes("/video/")) { e.respondWith(vid(e.request)); return; }
  if (pu.pathname.includes("/img/")) { e.respondWith(img(e.request)); return; }
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match("index.html"))));
});

/* Видео: кэшируем целиком и сами отдаём куски (Range) — иначе Safari не играет ролики из кэша */
async function vid(req) {
  const c = await caches.open("tkd-video"), key = req.url.split("#")[0];
  let res = await c.match(key);
  if (!res) {
    try { const net = await fetch(key); if (!net.ok) return net; await c.put(key, net.clone()); res = net; }
    catch (err) { return new Response("", {status: 504}); }
  }
  const range = req.headers.get("range"); if (!range) return res;
  const buf = await res.arrayBuffer(), m = /bytes=(\d+)-(\d*)/.exec(range);
  if (!m) return new Response(buf, {status: 200, headers: {"Content-Type": "video/mp4"}});
  const a = +m[1], b = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(a, b + 1), {status: 206, headers: {"Content-Type": "video/mp4", "Content-Range": `bytes ${a}-${b}/${buf.byteLength}`, "Content-Length": String(b - a + 1)}});
}

/* Фото: сеть в приоритете, при её отсутствии — из постоянного кэша (адрес без ?v=) */
async function img(req) {
  const u = new URL(req.url), key = u.origin + u.pathname, c = await caches.open("tkd-media");
  try { const net = await fetch(key); if (net.ok) { await c.put(key, net.clone()); } return net; }
  catch (err) { const m = await c.match(key); return m || new Response("", {status: 504}); }
}
