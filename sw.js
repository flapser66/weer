// Service worker: app offline beschikbaar + pushmeldingen
const CACHE = "weer-v20";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/app.css",
  "./js/app.js", "./js/fx.js", "./js/sound.js", "./js/settings.js", "./js/push.js",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if(e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  const shell = url.origin === location.origin || url.hostname === "cdnjs.cloudflare.com" || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com";
  if(!shell) return; // weerdata altijd live
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});

/* ---------- pushmeldingen ---------- */
self.addEventListener("push", e => {
  let d = {}; try{ d = e.data.json(); }catch(err){ d = {title:"Weer", body:e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(d.title || "Weer", {
    body:d.body || "", icon:"icon-192.png", badge:"icon-192.png", tag:d.tag || "weer", renotify:true,
    vibrate:[80, 40, 80], data:{url:d.url || "./"}
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(list => {
    for(const c of list) if("focus" in c) return c.focus();
    return clients.openWindow(e.notification.data.url || "./");
  }));
});
